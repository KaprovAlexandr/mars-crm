import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLE = "work_orders";

const INITIAL_WORK_ORDERS = [
  { id: "294894", client: "Иванов Артём Сергеевич", car: "BMW M5 F90", plate: "А123ВС777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "18 500 ₽", dueDate: "02.04.2026", urgent: false, archived: false },
  { id: "593423", client: "Смирнова Наталья Викторовна", car: "BMW M5 Competition", plate: "М456КХ199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Новый", amount: "12 300 ₽", dueDate: "04.04.2026", urgent: false, archived: false },
  { id: "839022", client: 'ООО "Сад"', car: "Lada Priora", plate: "О789ЕН750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", status: "Ожидание запчастей", amount: "25 800 ₽", dueDate: "06.04.2026", urgent: false, archived: false },
  { id: "847952", client: "ИП Лебедев Максим Олегович", car: "Toyota Camry", plate: "Т321ОР197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "В работе", amount: "9 700 ₽", dueDate: "08.04.2026", urgent: false, archived: false },
  { id: "495783", client: 'ООО "ЭкоМобил"', car: "Skoda Octavia", plate: "У654НС777", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Закрыт", amount: "31 400 ₽", dueDate: "10.04.2026", urgent: false, archived: false },
  { id: "987384", client: "Белов Алексей Игоревич", car: "Hyundai Solaris", plate: "В222ОО177", master: "Романова Л.", masterPhoto: "https://i.pravatar.cc/80?img=5", status: "Новый", amount: "7 200 ₽", dueDate: "12.04.2026", urgent: false, archived: false },
  { id: "284750", client: "Фролова Алина Андреевна", car: "Renault Duster", plate: "Р988РР799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "14 900 ₽", dueDate: "14.04.2026", urgent: false, archived: false },
  { id: "847597", client: "Журавлёв Михаил Дмитриевич", car: "VW Polo", plate: "С555КК77", master: "Кузнецов Е.", masterPhoto: "https://i.pravatar.cc/80?img=52", status: "Закрыт", amount: "22 000 ₽", dueDate: "16.04.2026", urgent: false, archived: false },
  { id: "658472", client: 'ООО "ГрузСервис"', car: "MAN TGS", plate: "Е100ХХ750", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "56 700 ₽", dueDate: "18.04.2026", urgent: false, archived: false },
  { id: "309845", client: 'ООО "ТехноТрак"', car: "Mercedes Actros", plate: "Н777АА116", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Готово", amount: "43 900 ₽", dueDate: "20.04.2026", urgent: false, archived: false },
  { id: "208476", client: "Гаврилова Ирина Михайловна", car: "Mazda 6", plate: "У001УР199", master: "Захарова И.", masterPhoto: "https://i.pravatar.cc/80?img=58", status: "Ожидание запчастей", amount: "17 600 ₽", dueDate: "22.04.2026", urgent: false, archived: false },
  { id: "989923", client: 'ООО "ЭкспрессТранс"', car: "Ford Transit", plate: "Р454КХ799", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Закрыт", amount: "28 300 ₽", dueDate: "24.04.2026", urgent: false, archived: false },
  { id: "923117", client: "Кузнецов Павел Андреевич", car: "Nissan X-Trail", plate: "Х878ТТ177", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "19 400 ₽", dueDate: "26.04.2026", urgent: false, archived: false },
  { id: "731550", client: 'ООО "Магистраль"', car: "Scania R450", plate: "М320СС97", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "Отказ клиента", amount: "63 200 ₽", dueDate: "28.04.2026", urgent: false, archived: false },
  { id: "615004", client: "Орлова Анна Вячеславовна", car: "Kia Sportage", plate: "Р600РО177", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "Закрыт", amount: "11 800 ₽", dueDate: "30.04.2026", urgent: false, archived: false },
  { id: "771208", client: "Савельев Кирилл Романович", car: "Audi A6", plate: "А701АА77", master: "Кузнецов Е.", masterPhoto: "https://i.pravatar.cc/80?img=52", status: "В работе", amount: "35 100 ₽", dueDate: "02.05.2026", urgent: false, archived: false },
  { id: "842661", client: "Павлова Ольга Дмитриевна", car: "Skoda Kodiaq", plate: "Н442НР799", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Ожидание запчастей", amount: "21 500 ₽", dueDate: "03.05.2026", urgent: false, archived: false },
  { id: "904552", client: 'ООО "ЛогистикПлюс"', car: "DAF XF", plate: "Р909РЕ750", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Готово", amount: "47 000 ₽", dueDate: "04.05.2026", urgent: false, archived: false },
  { id: "956740", client: "Тихонов Максим Сергеевич", car: "BMW X5", plate: "Е212ЕР199", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "39 600 ₽", dueDate: "05.05.2026", urgent: false, archived: false },
  { id: "118390", client: "Егорова Мария Игоревна", car: "Toyota RAV4", plate: "К811КК777", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "Закрыт", amount: "13 200 ₽", dueDate: "06.05.2026", urgent: false, archived: false },
  { id: "552701", client: "Киселёв Андрей Петрович", car: "BMW 320i", plate: "В777ВВ799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "16 800 ₽", dueDate: "07.05.2026", urgent: false, archived: false },
  { id: "552702", client: "Лаврова Дарья Олеговна", car: "Skoda Rapid", plate: "Р333РР799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "Закрыт", amount: "11 400 ₽", dueDate: "05.05.2026", urgent: false, archived: false },
];

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
  const { data: existingRows, error: selectError } = await supabase.from(TABLE).select("id");
  if (selectError) throw selectError;
  const existingIds = new Set((existingRows ?? []).map((r) => String(r.id)));
  const payload = INITIAL_WORK_ORDERS.filter((row) => !existingIds.has(row.id)).map((row) => ({
    id: row.id,
    status: row.status,
    client: row.client,
    car: row.car,
    plate: row.plate,
    master: row.master,
    master_photo: row.masterPhoto,
    amount: row.amount,
    due_date: row.dueDate,
    archived: Boolean(row.archived),
    urgent: Boolean(row.urgent),
  }));
  if (payload.length === 0) {
    console.log("No rows to migrate: all default work orders already exist in Supabase.");
    return;
  }
  const { error: insertError } = await supabase.from(TABLE).insert(payload);
  if (insertError) throw insertError;
  console.log(`Migration completed. Inserted ${payload.length} work orders into '${TABLE}'.`);
}

run().catch((error) => {
  console.error("Migration failed:", error?.message ?? error);
  process.exit(1);
});
