import dotenv from "dotenv";
import pg from "pg";
import { resolveEmployeeRoleFromEmail } from "../server/employee-roles.mjs";

dotenv.config();

const { Pool } = pg;

const SEED = [
  { email: "nagiseighiro259@gmail.com", fullName: "" },
];

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL.trim()) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : undefined,
});

async function main() {
  await pool.query(`
    create table if not exists pending_access_requests (
      email text primary key,
      full_name text not null default '',
      registered_at timestamptz not null default now()
    );
  `);

  for (const item of SEED) {
    const email = item.email.trim().toLowerCase();
    if (resolveEmployeeRoleFromEmail(email) !== "pending") {
      console.log(`skip ${email} (already has role)`);
      continue;
    }
    if (!item.fullName.trim()) {
      console.log(`skip ${email} (empty fullName — use sync on login)`);
      continue;
    }
    await pool.query(
      `
        insert into pending_access_requests (email, full_name, registered_at)
        values ($1, $2, now())
        on conflict (email) do update
        set full_name = excluded.full_name
      `,
      [email, item.fullName],
    );
    await pool.query(
      `
        insert into user_profiles (email, full_name, updated_at)
        values ($1, $2, now())
        on conflict (email) do update
        set full_name = excluded.full_name,
            updated_at = now()
      `,
      [email, item.fullName],
    );
    console.log(`seeded pending access: ${email}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => pool.end());
