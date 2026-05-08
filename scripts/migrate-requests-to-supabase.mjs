import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REQUESTS_TABLE = "requests";

const initialRequestRows = [
  { id: "294894", status: "Новая", client: "Иванов Артём Сергеевич", phone: "+7 (999) 111-22-33", manager: null, managerPhoto: null, source: "Сайт", createdAt: "04.04.2026", lastActivityAt: "04.04.2026", archived: false, comment: "Стучит подвеска, нужна диагностика ходовой." },
  { id: "593423", status: "В запись", client: "Смирнова Наталья Викторовна", phone: "+7 (999) 222-33-44", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Сайт", createdAt: "07.04.2026", lastActivityAt: "08.04.2026", archived: false, comment: "Просит записать на замену масла и фильтров." },
  { id: "839022", status: "Отказ", client: "ООО \"Сад\"", phone: "+7 (999) 333-44-55", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Сайт", createdAt: "10.04.2026", lastActivityAt: "10.04.2026", archived: false, comment: "Проблема с кондиционером, не охлаждает." },
  { id: "847952", status: "Отказ", client: "ИП Лебедев Максим Олегович", phone: "+7 (999) 444-55-66", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Сайт", createdAt: "14.04.2026", lastActivityAt: "14.04.2026", archived: false, comment: "Горит чек двигателя, нужна диагностика." },
  { id: "495783", status: "В обработке", client: "ООО \"ЭкоМобил\"", phone: "+7 (999) 555-66-77", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Сайт", createdAt: "16.04.2026", lastActivityAt: "18.04.2026", archived: false, comment: "Интересуется стоимостью ремонта тормозной системы." },
  { id: "987384", status: "Новая", client: "Белов Алексей Игоревич", phone: "+7 (999) 666-77-88", manager: null, managerPhoto: null, source: "Звонок", createdAt: "19.04.2026", lastActivityAt: "19.04.2026", archived: false, comment: "Звонил, интересуется ремонтом коробки, сказал “подумаю”." },
  { id: "284750", status: "Отказ", client: "Фролова Алина Андреевна", phone: "+7 (999) 777-88-99", manager: "Романова Лилия", managerPhoto: "https://i.pravatar.cc/80?img=5", source: "Звонок", createdAt: "21.04.2026", lastActivityAt: "21.04.2026", archived: false, comment: "Обсудили ТО, попросил перезвонить позже." },
  { id: "847597", status: "В обработке", client: "Журавлёв Михаил Дмитриевич", phone: "+7 (999) 888-99-00", manager: "Журавлёв Михаил", managerPhoto: "https://i.pravatar.cc/80?img=41", source: "Звонок", createdAt: "23.04.2026", lastActivityAt: "24.04.2026", archived: false, comment: "Уточнил цену ремонта подвески, взял время на решение." },
  { id: "658472", status: "В запись", client: "ООО \"ГрузСервис\"", phone: "+7 (999) 000-11-22", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Звонок", createdAt: "25.04.2026", lastActivityAt: "26.04.2026", archived: false, comment: "Интересовался диагностикой двигателя, пока не готов записаться." },
  { id: "309845", status: "Отказ", client: "ООО \"ТехноТрак\"", phone: "+7 (999) 101-22-33", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Звонок", createdAt: "27.04.2026", lastActivityAt: "27.04.2026", archived: false, comment: "Сказал, что сравнит цены с другими сервисами." },
  { id: "208476", status: "Новая", client: "Гаврилова Ирина Михайловна", phone: "+7 (999) 202-33-44", manager: null, managerPhoto: null, source: "Визит", createdAt: "29.04.2026", lastActivityAt: "29.04.2026", archived: false, comment: "Заезжал лично, интересовался ремонтом тормозов, ушёл подумать." },
  { id: "989923", status: "Отказ", client: "ООО \"ЭкспрессТранс\"", phone: "+7 (999) 303-44-55", manager: "Алексеев Дмитрий", managerPhoto: "https://i.pravatar.cc/80?img=12", source: "Визит", createdAt: "01.05.2026", lastActivityAt: "01.05.2026", archived: false, comment: "Приехал на консультацию, цену услышал, записываться не стал." },
  { id: "923117", status: "В запись", client: "Кузнецов Павел Андреевич", phone: "+7 (999) 404-55-66", manager: "Алексеев Дмитрий", managerPhoto: "https://i.pravatar.cc/80?img=12", source: "Визит", createdAt: "03.05.2026", lastActivityAt: "03.05.2026", archived: false, comment: "Был в сервисе, осмотрели визуально, клиент взял паузу." },
  { id: "731550", status: "В обработке", client: "ООО \"Магистраль\"", phone: "+7 (999) 505-66-77", manager: "Семёнова Елена", managerPhoto: "https://i.pravatar.cc/80?img=32", source: "Звонок", createdAt: "04.05.2026", lastActivityAt: "04.05.2026", archived: false, comment: "Постоянный клиент, уточнил стоимость доп. работ, пока без записи." },
  { id: "615004", status: "Отказ", client: "Орлова Анна Вячеславовна", phone: "+7 (999) 606-77-88", manager: "Капров А. Н.", managerPhoto: "https://i.pravatar.cc/80?img=15", source: "Сайт", createdAt: "05.05.2026", lastActivityAt: "05.05.2026", archived: false, comment: "Обратился по рекомендации, интересуется диагностикой, решение не принял." },
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

function ruDateToIso(dateStr) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateStr.trim());
  if (!m) return new Date().toISOString();
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  return new Date(year, month, day, 12, 0, 0, 0).toISOString();
}

async function run() {
  const env = parseEnvFile();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: existingRows, error: selectError } = await supabase.from(REQUESTS_TABLE).select("id");
  if (selectError) throw selectError;
  const existingIds = new Set((existingRows ?? []).map((r) => String(r.id)));

  const payload = initialRequestRows
    .filter((row) => !existingIds.has(row.id))
    .map((row) => ({
      id: row.id,
      status: row.status,
      client: row.client,
      phone: row.phone,
      manager: row.manager,
      manager_photo: row.managerPhoto,
      source: row.source,
      created_at: ruDateToIso(row.createdAt),
      last_activity_at: ruDateToIso(row.lastActivityAt),
      archived: Boolean(row.archived),
      comment: row.comment,
    }));

  if (payload.length === 0) {
    console.log("No rows to migrate: all default requests already exist in Supabase.");
    return;
  }

  const { error: insertError } = await supabase.from(REQUESTS_TABLE).insert(payload);
  if (insertError) throw insertError;

  console.log(`Migration completed. Inserted ${payload.length} request rows into '${REQUESTS_TABLE}'.`);
}

run().catch((error) => {
  console.error("Migration failed:", error?.message ?? error);
  process.exit(1);
});
