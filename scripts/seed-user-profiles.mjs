import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const PROFILES = [
  { email: "sanejkstrronger@gmail.com", fullName: "Капров Александр Николаевич" },
  { email: "sasharicky99@gmail.com", fullName: "Алексеев Дмитрий Сергеевич" },
  { email: "n0zicsgo@gmail.com", fullName: "Журавлёв Михаил Дмитриевич" },
  { email: "angel16yoo@gmail.com", fullName: "Орлова Анна Вячеславовна" },
];

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL.trim()) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.PGSSL === "disable"
      ? false
      : process.env.PGSSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,
});

async function main() {
  await pool.query(`
    create table if not exists user_profiles (
      email text primary key,
      full_name text not null default '',
      updated_at timestamptz not null default now()
    );
  `);

  for (const profile of PROFILES) {
    await pool.query(
      `
        insert into user_profiles (email, full_name, updated_at)
        values ($1, $2, now())
        on conflict (email) do update
        set full_name = excluded.full_name,
            updated_at = now()
      `,
      [profile.email, profile.fullName],
    );
    console.log(`seeded ${profile.email} -> ${profile.fullName}`);
  }

  console.log(`Done. Seeded ${PROFILES.length} profiles.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
