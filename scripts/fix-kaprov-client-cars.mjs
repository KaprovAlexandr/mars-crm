import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:123456@localhost:5432/crm_autoservice",
});

const FULL_NAME = "Капров Александр Николаевич";

try {
  const wo = await pool.query(
    `update work_orders set car = $1 where id = $2 and client = $3 returning id, car`,
    ["Toyota Camry", "989936", FULL_NAME],
  );
  console.log("Updated work order:", wo.rows);

  const journal = await pool.query(
    `
    delete from journal_bookings
    where client_title ilike '%Капров%'
      and trim(car) in ('—', '-', '–')
    returning id, client_title, car
    `,
  );
  console.log(`Deleted ${journal.rowCount ?? 0} journal booking(s) with dash car:`, journal.rows);

  const remaining = await pool.query(
    `
    select distinct car from work_orders where client = $1
    union
    select distinct car from journal_bookings where client_title ilike '%Капров%'
    `,
    [FULL_NAME],
  );
  console.log("Distinct cars after fix:", remaining.rows);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
