import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeOrderSeed(orderId) {
  let hash = 0;
  for (let i = 0; i < orderId.length; i += 1) {
    hash = (hash * 31 + orderId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 7;
}

function formatPartLineTotalRub(unitPrice, quantity) {
  const total = Math.round(unitPrice * quantity * 100) / 100;
  const hasFraction = !Number.isInteger(total);
  return `${total.toLocaleString("ru-RU", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })} ₽`;
}

function extractPartsCatalog(source) {
  const startMarker = "const partsCatalogSections";
  const endMarker = "function findPartsCatalogCategoryForTitle";
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error("Не найден блок partsCatalogSections.");
  const rest = source.slice(start);
  const end = rest.indexOf(endMarker);
  if (end === -1) throw new Error("Не найден конец блока partsCatalogSections.");
  const block = rest.slice(0, end);

  const items = [...block.matchAll(/\{\s*title:\s*"([^"\n]+)"\s*,\s*price:\s*(\d+)\s*\}/g)].map((m) => ({
    title: m[1],
    price: Number(m[2]),
  }));
  if (items.length === 0) throw new Error("Справочник запчастей пуст.");
  const dedup = new Map();
  for (const item of items) {
    if (!dedup.has(item.title)) dedup.set(item.title, item.price);
  }
  return [...dedup.entries()].map(([title, price]) => ({ title, price }));
}

function generatePartRowsByOrderId(orderId, partsCatalog) {
  const rand = seededRandom(makeOrderSeed(orderId));
  const shuffled = [...partsCatalog].sort(() => rand() - 0.5);
  const count = 1 + Math.floor(rand() * 4);
  const selected = shuffled.slice(0, count);
  const dayBase = 1 + Math.floor(rand() * 20);
  const toDate = (offset) => `${String(Math.max(1, dayBase - offset)).padStart(2, "0")}.05.2026`;

  return selected.map((item, index) => {
    const qty = 1 + Math.floor(rand() * 4);
    return [
      item.title,
      String(qty),
      formatPartLineTotalRub(item.price, qty),
      toDate(index % 10),
      `parts-current-${orderId}-${index}`,
    ];
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const sourcePath = path.resolve(process.cwd(), "src/components/pages/WorkOrdersDetailsPage.tsx");
  const source = await fs.readFile(sourcePath, "utf-8");
  const partsCatalog = extractPartsCatalog(source);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : false,
  });

  try {
    const { rows } = await pool.query("select id from work_orders order by id desc");
    if (rows.length === 0) {
      console.log("В таблице work_orders нет строк. Нечего обновлять.");
      return;
    }

    let updated = 0;
    for (const row of rows) {
      const orderId = String(row.id);
      const partsCurrent = generatePartRowsByOrderId(orderId, partsCatalog);

      await pool.query(
        `
        insert into work_order_detail_state (
          work_order_id,
          works_current,
          works_completed,
          works_archived,
          parts_current,
          parts_archived
        )
        values ($1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $2::jsonb, '[]'::jsonb)
        on conflict (work_order_id)
        do update set
          parts_current = excluded.parts_current,
          parts_archived = '[]'::jsonb,
          updated_at = now()
        `,
        [orderId, JSON.stringify(partsCurrent)],
      );
      updated += 1;
    }

    console.log(`Готово. Обновлены запчасти для ${updated} заказ-нарядов.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Ошибка при рандомизации запчастей заказ-нарядов:", error);
  process.exitCode = 1;
});

