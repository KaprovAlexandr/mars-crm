import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLE = "journal_bookings";

const INITIAL_JOURNAL_BOOKINGS = [
  { id: "b1", boxId: "1", masterId: "m1", startTime: "2026-05-03T09:00:00", endTime: "2026-05-03T10:00:00" },
  { id: "b2", boxId: "1", masterId: "m1", startTime: "2026-05-03T10:20:00", endTime: "2026-05-03T11:40:00" },
  { id: "b3", boxId: "1", masterId: "m1", startTime: "2026-05-03T12:00:00", endTime: "2026-05-03T13:20:00" },
  { id: "b4", boxId: "2", masterId: "m2", startTime: "2026-05-03T09:00:00", endTime: "2026-05-03T11:20:00" },
  { id: "b5", boxId: "2", masterId: "m2", startTime: "2026-05-03T13:20:00", endTime: "2026-05-03T15:00:00" },
  { id: "b13", boxId: "2", masterId: "m2", startTime: "2026-05-03T15:20:00", endTime: "2026-05-03T16:40:00" },
  { id: "b6", boxId: "3", masterId: "m3", startTime: "2026-05-03T10:00:00", endTime: "2026-05-03T11:20:00" },
  { id: "b8", boxId: "3", masterId: "m3", startTime: "2026-05-03T15:20:00", endTime: "2026-05-03T19:00:00" },
  { id: "b9", boxId: "4", masterId: "m4", startTime: "2026-05-03T09:00:00", endTime: "2026-05-03T09:40:00" },
  { id: "b10", boxId: "4", masterId: "m4", startTime: "2026-05-03T10:00:00", endTime: "2026-05-03T10:40:00" },
  { id: "b11", boxId: "4", masterId: "m4", startTime: "2026-05-03T11:00:00", endTime: "2026-05-03T11:40:00" },
];

const INITIAL_JOURNAL_CARD_META = {
  b1: { clientTitle: "Иванов Артём Сергеевич", service: "Замена масла + фильтр", car: "Toyota Camry  123ВС777", status: "Подтверждена", statusActor: "manager" },
  b2: { clientTitle: "Смирнов Дмитрий Олегович", service: "Замена тормозных колодок", car: "LADA Vesta  T320PT197", status: "Подтверждена", statusActor: "manager" },
  b3: { clientTitle: "Фролов Алексей Андреевич", service: "Диагностика ходовой", car: "Kia Rio  Y654CK777", status: "Ожидает клиента", statusActor: "system" },
  b4: { clientTitle: "Кузнецов Евгений Павлович", service: "Ремонт крыла", car: "Hyundai Solaris  M456KX199", status: "В работе", statusActor: "master" },
  b5: { clientTitle: "Морозов Егор Викторович", service: "Ремонт подвески", car: "Hyundai Tucson  P445TT799", status: "Подтверждена", statusActor: "manager" },
  b6: { clientTitle: "Петров Сергей Иванович", service: "Диагностика двигателя", car: "BMW X5  P111MP178", status: "Подтверждена", statusActor: "manager" },
  b8: { clientTitle: "Новикова Марина Игоревна", service: "Ремонт подвески", car: "Nissan Qashqai  E222CC750", status: "В работе", statusActor: "master" },
  b9: { clientTitle: "Сидоров Кирилл Андреевич", service: "Замена 2-х колес", car: "Kia Rio  E789EH750", status: "Подтверждена", statusActor: "manager" },
  b10: { clientTitle: "Алексеева Мария Сергеевна", service: "Сезонная смена шин", car: "Skoda Octavia  X333OP777", status: "Ожидает клиента", statusActor: "system" },
  b11: { clientTitle: "Воробьева Марина Викторовна", service: "Сезонная смена шин", car: "Nissan Qashqai  E222CC750", status: "Ожидает клиента", statusActor: "system" },
  b13: { clientTitle: "Соколов Павел Николаевич", service: "Диагностика ходовой", car: "Hyundai Solaris  M456KX199", status: "Завершена", statusActor: "system" },
};

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

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTodayIso(iso) {
  const day = todayYmd();
  return `${day}${iso.slice(10)}`;
}

async function run() {
  const env = parseEnvFile();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: existingRows, error: selectError } = await supabase.from(TABLE).select("id");
  if (selectError) throw selectError;
  const existingIds = new Set((existingRows ?? []).map((r) => String(r.id)));

  const payload = INITIAL_JOURNAL_BOOKINGS
    .filter((booking) => !existingIds.has(booking.id))
    .map((booking) => {
      const meta = INITIAL_JOURNAL_CARD_META[booking.id];
      const clientPhone = PHONE_BY_CLIENT_TITLE[meta.clientTitle] ?? "";
      return {
        id: booking.id,
        box_id: booking.boxId,
        master_id: booking.masterId,
        start_time: toTodayIso(booking.startTime),
        end_time: toTodayIso(booking.endTime),
        client_title: meta.clientTitle,
        client_phone: clientPhone,
        service: meta.service,
        car: meta.car,
        status: meta.status,
        status_actor: meta.statusActor,
      };
    });

  if (payload.length === 0) {
    console.log("No rows to migrate: all default journal bookings already exist in Supabase.");
    return;
  }

  const { error: insertError } = await supabase.from(TABLE).insert(payload);
  if (insertError) throw insertError;

  console.log(`Migration completed. Inserted ${payload.length} journal bookings into '${TABLE}'.`);
}

run().catch((error) => {
  console.error("Migration failed:", error?.message ?? error);
  process.exit(1);
});
