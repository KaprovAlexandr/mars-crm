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
  return Math.abs(hash) + 1;
}

function formatWorkPrice(price) {
  return `${price.toLocaleString("ru-RU")} ₽`;
}

function getCatalogWorkPrice(title) {
  return 1500 + title.length * 120;
}

function extractWorkCatalogTitles(fileContent) {
  const startMarker = "const workCatalogSections = [";
  const endMarker = "] as const;";
  const start = fileContent.indexOf(startMarker);
  if (start === -1) {
    throw new Error("Не найден блок workCatalogSections в WorkOrdersDetailsPage.tsx");
  }
  const rest = fileContent.slice(start);
  const end = rest.indexOf(endMarker);
  if (end === -1) {
    throw new Error("Не найден конец блока workCatalogSections в WorkOrdersDetailsPage.tsx");
  }
  const block = rest.slice(0, end);

  const matches = [...block.matchAll(/"([^"\n]+)"/g)].map((m) => m[1]);
  const banned = new Set([
    "Все работы",
    "Диагностика",
    "Техническое обслуживание",
    "Тормозная система",
    "Подвеска",
    "Двигатель",
    "Коробка передач",
    "Рулевое управление",
    "Электрика",
    "Система охлаждения",
    "Выхлопная система",
    "Шиномонтаж",
    "Кузовные работы",
    "Доп. работы",
  ]);

  const titles = matches.filter((s) => !banned.has(s));
  return Array.from(new Set(titles));
}

function generateWorkRowsByOrderId(orderId, workTitles) {
  const rand = seededRandom(makeOrderSeed(orderId));
  const shuffled = [...workTitles].sort(() => rand() - 0.5);
  const totalCount = 1 + Math.floor(rand() * 7);
  const completedCount = Math.min(totalCount - 1, Math.floor(rand() * 3));
  const currentCount = Math.max(1, totalCount - completedCount);
  const currentTitles = shuffled.slice(0, currentCount);
  const completedTitles = shuffled.slice(currentCount, currentCount + completedCount);
  const dayBase = 1 + Math.floor(rand() * 20);
  const toDate = (offset) => `${String(Math.max(1, dayBase - offset)).padStart(2, "0")}.05.2026`;

  const worksCurrent = currentTitles.map((title, index) => {
    const kind = rand() > 0.28 ? "progress" : "wait";
    const statusLabel = kind === "progress" ? "В работе" : "Ожидает";
    return [
      title,
      statusLabel,
      formatWorkPrice(getCatalogWorkPrice(title)),
      kind,
      toDate(index % 10),
      `current-${orderId}-${index}`,
    ];
  });

  const worksCompleted = completedTitles.map((title, index) => [
    title,
    "Готово",
    formatWorkPrice(getCatalogWorkPrice(title)),
    "closed",
    toDate(2 + (index % 10)),
    `completed-${orderId}-${index}`,
  ]);

  return { worksCurrent, worksCompleted, worksArchived: [] };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const sourcePath = path.resolve(process.cwd(), "src/components/pages/WorkOrdersDetailsPage.tsx");
  const source = await fs.readFile(sourcePath, "utf-8");
  const workTitles = extractWorkCatalogTitles(source);
  if (workTitles.length === 0) {
    throw new Error("Справочник работ пуст. Нечего генерировать.");
  }

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
      const generated = generateWorkRowsByOrderId(orderId, workTitles);
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
        values ($1, $2::jsonb, $3::jsonb, $4::jsonb, '[]'::jsonb, '[]'::jsonb)
        on conflict (work_order_id)
        do update set
          works_current = excluded.works_current,
          works_completed = excluded.works_completed,
          works_archived = excluded.works_archived,
          updated_at = now()
        `,
        [
          orderId,
          JSON.stringify(generated.worksCurrent),
          JSON.stringify(generated.worksCompleted),
          JSON.stringify(generated.worksArchived),
        ],
      );
      updated += 1;
    }

    console.log(`Готово. Обновлены работы для ${updated} заказ-нарядов.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Ошибка при рандомизации работ заказ-нарядов:", error);
  process.exitCode = 1;
});

