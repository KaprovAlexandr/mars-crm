import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLE = "journal_bookings";

const PHONE_BY_CLIENT_TITLE = {
  "Иванов Артём Сергеевич": "+7 (999) 111-22-33",
  "Смирнов Дмитрий Олегович": "+7 (999) 333-44-55",
  "Фролов Алексей Андреевич": "+7 (999) 444-55-66",
  "Кузнецов Евгений Павлович": "+7 (999) 555-66-77",
  "Морозов Егор Викторович": "+7 (999) 666-77-88",
  "Петров Сергей Иванович": "+7 (999) 123-45-67",
  "Новикова Марина Игоревна": "+7 (999) 777-88-99",
  "Сидоров Кирилл Андреевич": "+7 (999) 101-22-33",
  "Алексеева Мария Сергеевна": "+7 (999) 202-33-44",
  "Воробьева Марина Викторовна": "+7 (999) 303-44-55",
  "Соколов Павел Николаевич": "+7 (999) 404-55-66",
};

function parseEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  const envRaw = fs.readFileSync(envPath, "utf8");
  const map = {};
  for (const line of envRaw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    map[key] = value;
  }
  return map;
}

async function run() {
  const env = parseEnvFile();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: rows, error: selectError } = await supabase.from(TABLE).select("id, client_title, client_phone");
  if (selectError) throw selectError;

  const targets = (rows ?? []).filter((row) => {
    const currentPhone = String(row.client_phone ?? "").trim();
    const mappedPhone = PHONE_BY_CLIENT_TITLE[String(row.client_title ?? "").trim()];
    return Boolean(mappedPhone) && currentPhone !== mappedPhone;
  });

  if (targets.length === 0) {
    console.log("No rows to backfill: all journal bookings already have phones.");
    return;
  }

  let affected = 0;
  for (const row of targets) {
    const phone = PHONE_BY_CLIENT_TITLE[String(row.client_title ?? "").trim()];
    const { data: updatedRows, error: updateError } = await supabase
      .from(TABLE)
      .update({ client_phone: phone })
      .eq("id", row.id)
      .select("id");
    if (updateError) throw updateError;
    affected += (updatedRows ?? []).length;
  }

  if (affected === 0) {
    console.log(
      `Backfill attempted for ${targets.length} rows, but 0 rows were actually updated. Most likely missing RLS UPDATE policy for '${TABLE}'.`,
    );
    return;
  }

  console.log(`Backfill completed. Updated ${affected} journal bookings with client_phone.`);
}

run().catch((error) => {
  console.error("Backfill failed:", error?.message ?? error);
  process.exit(1);
});
