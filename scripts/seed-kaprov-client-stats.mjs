import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:123456@localhost:5432/crm_autoservice" });

const FULL_NAME = "Капров Александр Николаевич";
const REQUESTS_COUNT = 6;
const TOTAL_AMOUNT = "1 143 174 ₽";

const KAPROV_WORK_ORDERS = [
  {
    id: "881600",
    client: FULL_NAME,
    car: "BMW M5",
    plate: "A21213X7",
    master: "Алексеев Д.",
    master_photo: "https://i.pravatar.cc/80?img=12",
    status: "Закрыт",
    amount: "250 000 ₽",
    due_date: "10.05.2026",
    archived: false,
    urgent: false,
  },
  {
    id: "881601",
    client: FULL_NAME,
    car: "BMW M5",
    plate: "A21213X7",
    master: "Журавлёв М.",
    master_photo: "https://i.pravatar.cc/80?img=41",
    status: "Закрыт",
    amount: "131 058 ₽",
    due_date: "15.06.2026",
    archived: false,
    urgent: false,
  },
  {
    id: "881602",
    client: FULL_NAME,
    car: "BMW M5",
    plate: "A21213X7",
    master: "Алексеев Д.",
    master_photo: "https://i.pravatar.cc/80?img=12",
    status: "Закрыт",
    amount: "250 000 ₽",
    due_date: "20.06.2026",
    archived: false,
    urgent: false,
  },
  {
    id: "881603",
    client: FULL_NAME,
    car: "BMW M5",
    plate: "A21213X7",
    master: "Журавлёв М.",
    master_photo: "https://i.pravatar.cc/80?img=41",
    status: "В работе",
    amount: "131 058 ₽",
    due_date: "25.06.2026",
    archived: false,
    urgent: false,
  },
  {
    id: "881604",
    client: FULL_NAME,
    car: "BMW M5",
    plate: "A21213X7",
    master: "Алексеев Д.",
    master_photo: "https://i.pravatar.cc/80?img=12",
    status: "В работе",
    amount: "250 000 ₽",
    due_date: "28.06.2026",
    archived: false,
    urgent: false,
  },
  {
    id: "881605",
    client: FULL_NAME,
    car: "BMW M5",
    plate: "A21213X7",
    master: "Журавлёв М.",
    master_photo: "https://i.pravatar.cc/80?img=41",
    status: "В работе",
    amount: "131 058 ₽",
    due_date: "30.06.2026",
    archived: false,
    urgent: false,
  },
];

try {
  const clientResult = await pool.query(
    `
    update clients
    set requests_count = $1, total_amount = $2
    where full_name = $3
    `,
    [REQUESTS_COUNT, TOTAL_AMOUNT, FULL_NAME],
  );
  console.log(`Updated ${clientResult.rowCount ?? 0} client row(s) for ${FULL_NAME}.`);

  for (const row of KAPROV_WORK_ORDERS) {
    await pool.query(
      `
      insert into work_orders (id, client, car, plate, master, master_photo, status, amount, due_date, archived, urgent)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      on conflict (id) do update set
        client = excluded.client,
        car = excluded.car,
        plate = excluded.plate,
        master = excluded.master,
        master_photo = excluded.master_photo,
        status = excluded.status,
        amount = excluded.amount,
        due_date = excluded.due_date,
        archived = excluded.archived,
        urgent = excluded.urgent
      `,
      [
        row.id,
        row.client,
        row.car,
        row.plate,
        row.master,
        row.master_photo,
        row.status,
        row.amount,
        row.due_date,
        row.archived,
        row.urgent,
      ],
    );
  }
  console.log(`Upserted ${KAPROV_WORK_ORDERS.length} work order(s) for ${FULL_NAME}.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
