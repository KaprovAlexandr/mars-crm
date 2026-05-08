import process from "node:process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

function parseRubAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".")
    .trim();
  if (!normalized) return 0;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function calcTotal(worksCurrent, worksCompleted, partsCurrent) {
  const works = [...(Array.isArray(worksCurrent) ? worksCurrent : []), ...(Array.isArray(worksCompleted) ? worksCompleted : [])];
  const worksSubtotal = works.reduce((sum, row) => sum + parseRubAmount(Array.isArray(row) ? row[2] : 0), 0);
  const partsSubtotal = (Array.isArray(partsCurrent) ? partsCurrent : []).reduce(
    (sum, row) => sum + parseRubAmount(Array.isArray(row) ? row[2] : 0),
    0,
  );
  const grossSubtotal = worksSubtotal + partsSubtotal;
  const discountAmount = Math.round(grossSubtotal * 0.07);
  return grossSubtotal - discountAmount;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : false,
  });

  try {
    const { rows } = await pool.query(`
      select
        w.id,
        s.works_current,
        s.works_completed,
        s.parts_current
      from work_orders w
      left join work_order_detail_state s
        on s.work_order_id = w.id
      order by w.id desc
    `);

    let updated = 0;
    for (const row of rows) {
      const total = calcTotal(row.works_current, row.works_completed, row.parts_current);
      const amount = formatCurrency(total);
      await pool.query("update work_orders set amount = $2 where id = $1", [String(row.id), amount]);
      updated += 1;
    }

    console.log(`Готово. Синхронизирована сумма для ${updated} заказ-нарядов.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Ошибка при синхронизации сумм заказ-нарядов:", error);
  process.exitCode = 1;
});

