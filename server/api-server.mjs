import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pg from "pg";
import {
  canAccessSettings,
  formatRuDateTimeFromDate,
  looksLikeLoginAlias,
  normalizeAuthEmail,
  pickBetterEmployeeFullName,
  resolveEmployeeRoleFromEmail,
  getEmployeeFullName,
  EMPLOYEE_FULL_NAME_BY_EMAIL,
} from "./employee-roles.mjs";
import { verifyFirebaseIdToken } from "./firebase-id-token.mjs";
import {
  ensureUserPasswordByEmail,
  ensureUserPasswordByIdToken,
  getFirebaseAdminAuth,
  isFirebaseAdminReady,
} from "./firebase-admin.mjs";
import { sendClientRetentionSms } from "./sms.mjs";

dotenv.config();

const { Pool } = pg;
const app = express();

const API_PORT = Number(process.env.API_PORT ?? 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
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

async function ensureClientsExtraColumns() {
  const cols = [
    ["email", "text not null default ''"],
    ["client_type", "text not null default ''"],
    ["inn", "text not null default ''"],
    ["car", "text not null default ''"],
    ["plate", "text not null default ''"],
  ];
  for (const [name, def] of cols) {
    await pool.query(`alter table clients add column if not exists ${name} ${def}`);
  }
}

async function ensureUserProfilesSchema() {
  await pool.query(`
    create table if not exists user_profiles (
      email text primary key,
      full_name text not null default '',
      updated_at timestamptz not null default now()
    );
  `);
}

async function ensureEmployeeRoleOverridesSchema() {
  await pool.query(`
    create table if not exists employee_role_overrides (
      email text primary key,
      role text not null,
      updated_at timestamptz not null default now()
    );
  `);
}

async function ensurePendingAccessRequestsSchema() {
  await pool.query(`
    create table if not exists pending_access_requests (
      email text primary key,
      full_name text not null default '',
      registered_at timestamptz not null default now()
    );
  `);
}

async function readEmployeeRoleOverridesMap() {
  const { rows } = await pool.query(`select email, role from employee_role_overrides`);
  const map = {};
  for (const row of rows) {
    const email = normalizeAuthEmail(row.email);
    const role = typeof row.role === "string" ? row.role.trim() : "";
    if (!email || !role) continue;
    map[email] = role;
  }
  return map;
}

async function verifyIdTokenEmail(idToken) {
  try {
    const verified = await verifyFirebaseIdToken(idToken);
    return verified.email;
  } catch (restError) {
    if (!isFirebaseAdminReady()) throw restError;
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const email = normalizeAuthEmail(decoded.email);
    if (!email) {
      throw new Error("У аккаунта нет e-mail.");
    }
    return email;
  }
}

async function readUserProfileFullName(email) {
  const key = normalizeAuthEmail(email);
  if (!key) return "";
  const { rows } = await pool.query(`select full_name from user_profiles where email = $1`, [key]);
  return typeof rows[0]?.full_name === "string" ? rows[0].full_name.trim() : "";
}

async function readPendingAccessFullName(email) {
  const key = normalizeAuthEmail(email);
  if (!key) return "";
  const { rows } = await pool.query(`select full_name from pending_access_requests where email = $1`, [key]);
  return typeof rows[0]?.full_name === "string" ? rows[0].full_name.trim() : "";
}

async function resolvePendingEmployeeFullName(email, ...candidates) {
  const key = normalizeAuthEmail(email);
  const profileName = await readUserProfileFullName(key);
  const pendingName = await readPendingAccessFullName(key);
  let firebaseDisplayName = "";

  if (looksLikeLoginAlias(pickBetterEmployeeFullName(key, ...candidates, profileName, pendingName), key) && isFirebaseAdminReady()) {
    try {
      const user = await getFirebaseAdminAuth().getUserByEmail(key);
      firebaseDisplayName = user.displayName?.trim() ?? "";
    } catch {
      // optional
    }
  }

  return pickBetterEmployeeFullName(key, ...candidates, profileName, pendingName, firebaseDisplayName);
}

async function upsertPendingAccessRequest(email, fullName, registeredAt = new Date()) {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  const resolvedName = await resolvePendingEmployeeFullName(key, fullName);
  if (!resolvedName) return;

  await pool.query(
    `
      insert into pending_access_requests (email, full_name, registered_at)
      values ($1, $2, $3)
      on conflict (email) do update
      set full_name = excluded.full_name,
          registered_at = coalesce(pending_access_requests.registered_at, excluded.registered_at)
    `,
    [key, resolvedName, registeredAt],
  );
}

async function upsertUserProfileFullName(email, fullName) {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  const resolvedName = await resolvePendingEmployeeFullName(key, fullName);
  if (!resolvedName) return;

  await pool.query(
    `
      insert into user_profiles (email, full_name, updated_at)
      values ($1, $2, now())
      on conflict (email) do update
      set full_name = excluded.full_name,
          updated_at = now()
    `,
    [key, resolvedName],
  );
}

async function removePendingAccessRequest(email) {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  await pool.query(`delete from pending_access_requests where email = $1`, [key]);
}

async function syncPendingAccessRequestForUser(email, fullName, overrides) {
  const key = normalizeAuthEmail(email);
  if (!key) return { pending: false };

  if (resolveEmployeeRoleFromEmail(key, overrides) !== "pending") {
    await removePendingAccessRequest(key);
    return { pending: false };
  }

  const name = await resolvePendingEmployeeFullName(key, fullName);
  await upsertPendingAccessRequest(key, name);
  await upsertUserProfileFullName(key, name);
  return { pending: true };
}

async function backfillPendingAccessRequestsFromProfiles(overrides) {
  const { rows } = await pool.query(`select email, full_name, updated_at from user_profiles`);
  for (const row of rows) {
    const email = normalizeAuthEmail(row.email);
    if (!email) continue;
    if (resolveEmployeeRoleFromEmail(email, overrides) !== "pending") continue;
    const fullName = typeof row.full_name === "string" ? row.full_name.trim() : "";
    if (!fullName) continue;
    await upsertPendingAccessRequest(email, fullName, row.updated_at ?? new Date());
  }
}

async function listPendingEmployeesFromDatabase(overrides) {
  await backfillPendingAccessRequestsFromProfiles(overrides);

  const { rows } = await pool.query(
    `
      select
        p.email,
        p.full_name as pending_full_name,
        p.registered_at,
        u.full_name as profile_full_name
      from pending_access_requests p
      left join user_profiles u on u.email = p.email
      order by p.registered_at desc
    `,
  );

  const pending = [];
  for (const row of rows) {
    const email = normalizeAuthEmail(row.email);
    if (!email) continue;

    if (resolveEmployeeRoleFromEmail(email, overrides) !== "pending") {
      await removePendingAccessRequest(email);
      continue;
    }

    const fullName = await resolvePendingEmployeeFullName(
      email,
      row.profile_full_name,
      row.pending_full_name,
    );
    if (fullName && fullName !== (typeof row.pending_full_name === "string" ? row.pending_full_name.trim() : "")) {
      await pool.query(`update pending_access_requests set full_name = $1 where email = $2`, [fullName, email]);
    }
    if (fullName && fullName !== (typeof row.profile_full_name === "string" ? row.profile_full_name.trim() : "")) {
      await upsertUserProfileFullName(email, fullName);
    }
    pending.push({
      id: `pending-${email.replace(/[^a-z0-9]+/gi, "-")}`,
      email,
      fullName: getEmployeeFullName(email) || fullName,
      registeredAt: formatRuDateTimeFromDate(row.registered_at ?? new Date()),
    });
  }

  if (isFirebaseAdminReady()) {
    try {
      const fromFirebase = await listPendingEmployeesFromFirebase(overrides);
      const byEmail = new Map(pending.map((item) => [item.email, item]));
      for (const item of fromFirebase) {
        if (!byEmail.has(item.email)) {
          await upsertPendingAccessRequest(item.email, item.fullName);
          byEmail.set(item.email, item);
        }
      }
      return [...byEmail.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru-RU"));
    } catch {
      // Firebase optional
    }
  }

  pending.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru-RU"));
  return pending;
}

async function listPendingEmployeesFromFirebase(overrides) {
  const auth = getFirebaseAdminAuth();
  const profileRows = await pool.query(`select email, full_name, updated_at from user_profiles`);
  const profileByEmail = new Map();
  for (const row of profileRows.rows) {
    const email = normalizeAuthEmail(row.email);
    if (!email) continue;
    profileByEmail.set(email, {
      fullName: typeof row.full_name === "string" ? row.full_name.trim() : "",
      updatedAt: row.updated_at,
    });
  }

  const pending = [];
  const seen = new Set();
  let nextPageToken;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      const email = normalizeAuthEmail(user.email);
      if (!email || seen.has(email)) continue;
      seen.add(email);

      if (resolveEmployeeRoleFromEmail(email, overrides) !== "pending") continue;

      const profile = profileByEmail.get(email);
      const fullName =
        profile?.fullName ||
        user.displayName?.trim() ||
        email.split("@")[0] ||
        email;
      const registeredAt = user.metadata?.creationTime
        ? formatRuDateTimeFromDate(new Date(user.metadata.creationTime))
        : profile?.updatedAt
          ? formatRuDateTimeFromDate(profile.updatedAt)
          : formatRuDateTimeFromDate(new Date());

      pending.push({
        id: `pending-${email.replace(/[^a-z0-9]+/gi, "-")}`,
        email,
        fullName: getEmployeeFullName(email) || fullName,
        registeredAt,
      });
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  pending.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru-RU"));
  return pending;
}

async function ensureClientDetailStateSchema() {
  await pool.query(`
    create table if not exists client_detail_state (
      client_id text primary key references clients(id) on delete cascade,
      active_tab text not null default 'client',
      active_client_panel text not null default 'main',
      active_car_panel text not null default 'documents',
      selected_client_car_model text not null default '',
      client_fields jsonb not null default '[]'::jsonb,
      vehicle_fields jsonb not null default '[]'::jsonb,
      manual_client_cars jsonb not null default '[]'::jsonb,
      manual_car_details_by_model jsonb not null default '{}'::jsonb,
      documents_scope text not null default 'current',
      documents_current jsonb not null default '[]'::jsonb,
      documents_archived jsonb not null default '[]'::jsonb,
      car_photos jsonb not null default '[]'::jsonb,
      car_photos_by_model jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    alter table client_detail_state
    add column if not exists car_photos_by_model jsonb not null default '{}'::jsonb;
  `);
}

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const REQUEST_COLUMNS = [
  "id",
  "status",
  "client",
  "phone",
  "manager",
  "manager_photo",
  "source",
  "created_at",
  "last_activity_at",
  "archived",
  "comment",
];
const JOURNAL_COLUMNS = [
  "id",
  "box_id",
  "master_id",
  "start_time",
  "end_time",
  "client_title",
  "client_phone",
  "service",
  "car",
  "status",
  "status_actor",
];
const WORK_ORDER_COLUMNS = [
  "id",
  "status",
  "client",
  "car",
  "plate",
  "master",
  "master_photo",
  "amount",
  "due_date",
  "archived",
  "urgent",
];
const CLIENT_COLUMNS = [
  "id",
  "full_name",
  "phone",
  "requests_count",
  "last_visit",
  "total_amount",
  "email",
  "client_type",
  "inn",
  "car",
  "plate",
];

function formatLocalDateTimeLikeUi(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mi = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

function normalizeJournalRowDates(row) {
  return {
    ...row,
    start_time: formatLocalDateTimeLikeUi(row.start_time),
    end_time: formatLocalDateTimeLikeUi(row.end_time),
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
});

app.get("/api/requests", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      select ${REQUEST_COLUMNS.join(", ")}
      from requests
      order by created_at desc, id desc
      `,
    );
    res.json(rows.map(normalizeJournalRowDates));
  } catch (error) {
    res.status(500).json({ error: "Failed to load requests.", details: String(error?.message ?? error) });
  }
});

app.post("/api/requests", async (req, res) => {
  const payload = req.body ?? {};
  const values = REQUEST_COLUMNS.map((column) => payload[column] ?? null);
  try {
    const { rows } = await pool.query(
      `
      insert into requests (${REQUEST_COLUMNS.join(", ")})
      values (${REQUEST_COLUMNS.map((_, idx) => `$${idx + 1}`).join(", ")})
      returning ${REQUEST_COLUMNS.join(", ")}
      `,
      values,
    );
    res.status(201).json(normalizeJournalRowDates(rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to create request.", details: String(error?.message ?? error) });
  }
});

app.patch("/api/requests/bulk-update", async (req, res) => {
  const body = req.body ?? {};
  const ids = Array.isArray(body.ids) ? body.ids.map((item) => String(item)) : [];
  const patch = body.patch && typeof body.patch === "object" ? body.patch : null;
  if (ids.length === 0 || !patch) {
    res.status(400).json({ error: "Invalid payload. Expected { ids: string[], patch: object }." });
    return;
  }

  const entries = Object.entries(patch).filter(([key, value]) => REQUEST_COLUMNS.includes(key) && value !== undefined);
  if (entries.length === 0) {
    res.status(400).json({ error: "Patch is empty." });
    return;
  }

  const setClauses = entries.map(([key], idx) => `${key} = $${idx + 1}`);
  const setValues = entries.map(([, value]) => value);
  const idsPlaceholder = `$${entries.length + 1}`;

  try {
    const { rowCount } = await pool.query(
      `
      update requests
      set ${setClauses.join(", ")}
      where id = any(${idsPlaceholder}::text[])
      `,
      [...setValues, ids],
    );
    res.json({ updated: rowCount ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to update requests.", details: String(error?.message ?? error) });
  }
});

app.get("/api/journal-bookings", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      select ${JOURNAL_COLUMNS.join(", ")}
      from journal_bookings
      order by start_time asc, id asc
      `,
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load journal bookings.", details: String(error?.message ?? error) });
  }
});

app.post("/api/journal-bookings", async (req, res) => {
  const payload = req.body ?? {};
  const values = JOURNAL_COLUMNS.map((column) => payload[column] ?? null);
  try {
    const { rows } = await pool.query(
      `
      insert into journal_bookings (${JOURNAL_COLUMNS.join(", ")})
      values (${JOURNAL_COLUMNS.map((_, idx) => `$${idx + 1}`).join(", ")})
      returning ${JOURNAL_COLUMNS.join(", ")}
      `,
      values,
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create journal booking.", details: String(error?.message ?? error) });
  }
});

app.patch("/api/journal-bookings/bulk-update", async (req, res) => {
  const body = req.body ?? {};
  const ids = Array.isArray(body.ids) ? body.ids.map((item) => String(item)) : [];
  const patch = body.patch && typeof body.patch === "object" ? body.patch : null;
  if (ids.length === 0 || !patch) {
    res.status(400).json({ error: "Invalid payload. Expected { ids: string[], patch: object }." });
    return;
  }
  const entries = Object.entries(patch).filter(([key, value]) => JOURNAL_COLUMNS.includes(key) && value !== undefined);
  if (entries.length === 0) {
    res.status(400).json({ error: "Patch is empty." });
    return;
  }
  const setClauses = entries.map(([key], idx) => `${key} = $${idx + 1}`);
  const setValues = entries.map(([, value]) => value);
  const idsPlaceholder = `$${entries.length + 1}`;
  try {
    const { rowCount } = await pool.query(
      `
      update journal_bookings
      set ${setClauses.join(", ")}
      where id = any(${idsPlaceholder}::text[])
      `,
      [...setValues, ids],
    );
    res.json({ updated: rowCount ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to update journal bookings.", details: String(error?.message ?? error) });
  }
});

app.delete("/api/journal-bookings/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Missing booking id." });
    return;
  }
  try {
    const { rowCount } = await pool.query("delete from journal_bookings where id = $1", [id]);
    res.json({ deleted: rowCount ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete journal booking.", details: String(error?.message ?? error) });
  }
});

app.get("/api/work-orders", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      select ${WORK_ORDER_COLUMNS.join(", ")}
      from work_orders
      order by id desc
      `,
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load work orders.", details: String(error?.message ?? error) });
  }
});

app.post("/api/work-orders", async (req, res) => {
  const payload = req.body ?? {};
  const values = WORK_ORDER_COLUMNS.map((column) => payload[column] ?? null);
  try {
    const { rows } = await pool.query(
      `
      insert into work_orders (${WORK_ORDER_COLUMNS.join(", ")})
      values (${WORK_ORDER_COLUMNS.map((_, idx) => `$${idx + 1}`).join(", ")})
      returning ${WORK_ORDER_COLUMNS.join(", ")}
      `,
      values,
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create work order.", details: String(error?.message ?? error) });
  }
});

app.patch("/api/work-orders/bulk-update", async (req, res) => {
  const body = req.body ?? {};
  const ids = Array.isArray(body.ids) ? body.ids.map((item) => String(item)) : [];
  const patch = body.patch && typeof body.patch === "object" ? body.patch : null;
  if (ids.length === 0 || !patch) {
    res.status(400).json({ error: "Invalid payload. Expected { ids: string[], patch: object }." });
    return;
  }
  const entries = Object.entries(patch).filter(([key, value]) => WORK_ORDER_COLUMNS.includes(key) && value !== undefined);
  if (entries.length === 0) {
    res.status(400).json({ error: "Patch is empty." });
    return;
  }
  const setClauses = entries.map(([key], idx) => `${key} = $${idx + 1}`);
  const setValues = entries.map(([, value]) => value);
  const idsPlaceholder = `$${entries.length + 1}`;
  try {
    const { rowCount } = await pool.query(
      `
      update work_orders
      set ${setClauses.join(", ")}
      where id = any(${idsPlaceholder}::text[])
      `,
      [...setValues, ids],
    );
    res.json({ updated: rowCount ?? 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to update work orders.", details: String(error?.message ?? error) });
  }
});

app.get("/api/clients", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await pool.query(
      `
      select ${CLIENT_COLUMNS.join(", ")}
      from clients
      order by id desc
      `,
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to load clients.", details: String(error?.message ?? error) });
  }
});

app.post("/api/clients", async (req, res) => {
  const payload = req.body ?? {};
  const values = CLIENT_COLUMNS.map((column) => payload[column] ?? null);
  try {
    const { rows } = await pool.query(
      `
      insert into clients (${CLIENT_COLUMNS.join(", ")})
      values (${CLIENT_COLUMNS.map((_, idx) => `$${idx + 1}`).join(", ")})
      returning ${CLIENT_COLUMNS.join(", ")}
      `,
      values,
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to create client.", details: String(error?.message ?? error) });
  }
});

app.post("/api/clients/send-retention-sms", async (req, res) => {
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";

  if (!phone) {
    res.status(400).json({ error: "Укажите номер телефона." });
    return;
  }

  try {
    const result = await sendClientRetentionSms(phone, fullName);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось отправить SMS.",
      details: String(error?.message ?? error),
    });
  }
});

app.get("/api/clients/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Missing client id." });
    return;
  }
  try {
    res.setHeader("Cache-Control", "no-store");
    const { rows } = await pool.query(
      `
      select ${CLIENT_COLUMNS.join(", ")}
      from clients
      where id = $1
      limit 1
      `,
      [id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Client not found." });
      return;
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to load client.", details: String(error?.message ?? error) });
  }
});

app.get("/api/client-details/:clientId/state", async (req, res) => {
  const clientId = String(req.params.clientId ?? "").trim();
  if (!clientId) {
    res.status(400).json({ error: "Missing clientId." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `
      select
        client_id,
        active_tab,
        active_client_panel,
        active_car_panel,
        selected_client_car_model,
        client_fields,
        vehicle_fields,
        manual_client_cars,
        manual_car_details_by_model,
        documents_scope,
        documents_current,
        documents_archived,
        car_photos,
        car_photos_by_model
      from client_detail_state
      where client_id = $1
      `,
      [clientId],
    );
    res.json(rows[0] ?? null);
  } catch (error) {
    res.status(500).json({ error: "Failed to load client detail state.", details: String(error?.message ?? error) });
  }
});

app.put("/api/client-details/:clientId/state", async (req, res) => {
  const clientId = String(req.params.clientId ?? "").trim();
  if (!clientId) {
    res.status(400).json({ error: "Missing clientId." });
    return;
  }
  const body = req.body ?? {};
  const activeTab = body.active_tab === "car" ? "car" : "client";
  const activeClientPanel = body.active_client_panel === "cars" ? "cars" : "main";
  const activeCarPanel =
    body.active_car_panel === "orders" || body.active_car_panel === "photos" ? body.active_car_panel : "documents";
  const selectedClientCarModel =
    typeof body.selected_client_car_model === "string" ? body.selected_client_car_model : "";
  const clientFields = Array.isArray(body.client_fields) ? body.client_fields : [];
  const vehicleFields = Array.isArray(body.vehicle_fields) ? body.vehicle_fields : [];
  const manualClientCars = Array.isArray(body.manual_client_cars) ? body.manual_client_cars : [];
  const manualCarDetails =
    body.manual_car_details_by_model && typeof body.manual_car_details_by_model === "object"
      ? body.manual_car_details_by_model
      : {};
  const documentsScope =
    typeof body.documents_scope === "string" && body.documents_scope === "archived" ? "archived" : "current";
  const documentsCurrent = Array.isArray(body.documents_current) ? body.documents_current : [];
  const documentsArchived = Array.isArray(body.documents_archived) ? body.documents_archived : [];
  const carPhotos = Array.isArray(body.car_photos) ? body.car_photos : [];
  const carPhotosByModel =
    body.car_photos_by_model && typeof body.car_photos_by_model === "object" && !Array.isArray(body.car_photos_by_model)
      ? body.car_photos_by_model
      : {};
  try {
    const { rows } = await pool.query(
      `
      insert into client_detail_state (
        client_id,
        active_tab,
        active_client_panel,
        active_car_panel,
        selected_client_car_model,
        client_fields,
        vehicle_fields,
        manual_client_cars,
        manual_car_details_by_model,
        documents_scope,
        documents_current,
        documents_archived,
        car_photos,
        car_photos_by_model
      )
      values (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb,
        $8::jsonb, $9::jsonb,
        $10, $11::jsonb, $12::jsonb,
        $13::jsonb, $14::jsonb
      )
      on conflict (client_id)
      do update set
        active_tab = excluded.active_tab,
        active_client_panel = excluded.active_client_panel,
        active_car_panel = excluded.active_car_panel,
        selected_client_car_model = excluded.selected_client_car_model,
        client_fields = excluded.client_fields,
        vehicle_fields = excluded.vehicle_fields,
        manual_client_cars = excluded.manual_client_cars,
        manual_car_details_by_model = excluded.manual_car_details_by_model,
        documents_scope = excluded.documents_scope,
        documents_current = excluded.documents_current,
        documents_archived = excluded.documents_archived,
        car_photos = excluded.car_photos,
        car_photos_by_model = excluded.car_photos_by_model,
        updated_at = now()
      returning
        client_id,
        active_tab,
        active_client_panel,
        active_car_panel,
        selected_client_car_model,
        client_fields,
        vehicle_fields,
        manual_client_cars,
        manual_car_details_by_model,
        documents_scope,
        documents_current,
        documents_archived,
        car_photos,
        car_photos_by_model
      `,
      [
        clientId,
        activeTab,
        activeClientPanel,
        activeCarPanel,
        selectedClientCarModel,
        JSON.stringify(clientFields),
        JSON.stringify(vehicleFields),
        JSON.stringify(manualClientCars),
        JSON.stringify(manualCarDetails),
        documentsScope,
        JSON.stringify(documentsCurrent),
        JSON.stringify(documentsArchived),
        JSON.stringify(carPhotos),
        JSON.stringify(carPhotosByModel),
      ],
    );
    res.json(rows[0] ?? null);
  } catch (error) {
    res.status(500).json({ error: "Failed to save client detail state.", details: String(error?.message ?? error) });
  }
});

app.get("/api/work-order-details/:workOrderId/state", async (req, res) => {
  const workOrderId = String(req.params.workOrderId ?? "").trim();
  if (!workOrderId) {
    res.status(400).json({ error: "Missing workOrderId." });
    return;
  }
  try {
    const { rows } = await pool.query(
      `
      select
        work_order_id,
        works_current,
        works_completed,
        works_archived,
        parts_current,
        parts_archived,
        client_fields,
        vehicle_fields,
        car_photos,
        documents_current,
        documents_archived
      from work_order_detail_state
      where work_order_id = $1
      `,
      [workOrderId],
    );
    res.json(rows[0] ?? null);
  } catch (error) {
    res.status(500).json({ error: "Failed to load work-order detail state.", details: String(error?.message ?? error) });
  }
});

app.put("/api/work-order-details/:workOrderId/state", async (req, res) => {
  const workOrderId = String(req.params.workOrderId ?? "").trim();
  if (!workOrderId) {
    res.status(400).json({ error: "Missing workOrderId." });
    return;
  }
  const body = req.body ?? {};
  const worksCurrent = body.works_current ?? [];
  const worksCompleted = body.works_completed ?? [];
  const worksArchived = body.works_archived ?? [];
  const partsCurrent = body.parts_current ?? [];
  const partsArchived = body.parts_archived ?? [];
  const clientFields = body.client_fields ?? [];
  const vehicleFields = body.vehicle_fields ?? [];
  const carPhotos = body.car_photos ?? [];
  const documentsCurrent = body.documents_current ?? [];
  const documentsArchived = body.documents_archived ?? [];
  try {
    const { rows } = await pool.query(
      `
      insert into work_order_detail_state (
        work_order_id,
        works_current,
        works_completed,
        works_archived,
        parts_current,
        parts_archived,
        client_fields,
        vehicle_fields,
        car_photos,
        documents_current,
        documents_archived
      )
      values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
      on conflict (work_order_id)
      do update set
        works_current = excluded.works_current,
        works_completed = excluded.works_completed,
        works_archived = excluded.works_archived,
        parts_current = excluded.parts_current,
        parts_archived = excluded.parts_archived,
        client_fields = excluded.client_fields,
        vehicle_fields = excluded.vehicle_fields,
        car_photos = excluded.car_photos,
        documents_current = excluded.documents_current,
        documents_archived = excluded.documents_archived,
        updated_at = now()
      returning
        work_order_id,
        works_current,
        works_completed,
        works_archived,
        parts_current,
        parts_archived,
        client_fields,
        vehicle_fields,
        car_photos,
        documents_current,
        documents_archived
      `,
      [
        workOrderId,
        JSON.stringify(worksCurrent),
        JSON.stringify(worksCompleted),
        JSON.stringify(worksArchived),
        JSON.stringify(partsCurrent),
        JSON.stringify(partsArchived),
        JSON.stringify(clientFields),
        JSON.stringify(vehicleFields),
        JSON.stringify(carPhotos),
        JSON.stringify(documentsCurrent),
        JSON.stringify(documentsArchived),
      ],
    );
    res.json(rows[0] ?? null);
  } catch (error) {
    res.status(500).json({ error: "Failed to save work-order detail state.", details: String(error?.message ?? error) });
  }
});

app.post("/api/auth/profile", async (req, res) => {
  if (!isFirebaseAdminReady()) {
    res.status(503).json({
      error: "Firebase Admin не настроен. Добавьте firebase-service-account.json в корень проекта.",
    });
    return;
  }

  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";

  if (!idToken) {
    res.status(400).json({ error: "Укажите idToken." });
    return;
  }

  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "У аккаунта нет e-mail." });
      return;
    }

    if (fullName) {
      await upsertUserProfileFullName(email, fullName);
    }

    const { rows } = await pool.query(`select full_name from user_profiles where email = $1`, [email]);
    res.json({ fullName: rows[0]?.full_name ?? "" });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось получить или сохранить профиль пользователя.",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/api/auth/sync-pending-access", async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";

  if (!idToken) {
    res.status(400).json({ error: "Укажите idToken." });
    return;
  }

  try {
    const verified = await verifyFirebaseIdToken(idToken);
    const overrides = await readEmployeeRoleOverridesMap();
    const result = await syncPendingAccessRequestForUser(
      verified.email,
      fullName || verified.displayName,
      overrides,
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(401).json({
      error: "Не удалось синхронизировать ожидание доступа.",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/api/employees/pending", async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  if (!idToken) {
    res.status(400).json({ error: "Укажите idToken." });
    return;
  }

  try {
    const callerEmail = await verifyIdTokenEmail(idToken);
    const overrides = await readEmployeeRoleOverridesMap();
    if (!canAccessSettings(callerEmail, overrides)) {
      res.status(403).json({ error: "Недостаточно прав для просмотра ожидающих сотрудников." });
      return;
    }

    const employees = await listPendingEmployeesFromDatabase(overrides);
    res.json({ employees });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось получить список ожидающих сотрудников.",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/api/employees/role-override", async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  const email = normalizeAuthEmail(req.body?.email);
  const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";

  if (!idToken || !email || !role) {
    res.status(400).json({ error: "Укажите idToken, email и role." });
    return;
  }

  if (!["head", "administrator", "manager", "master"].includes(role)) {
    res.status(400).json({ error: "Некорректная роль." });
    return;
  }

  try {
    const callerEmail = await verifyIdTokenEmail(idToken);
    const overrides = await readEmployeeRoleOverridesMap();
    if (!canAccessSettings(callerEmail, overrides)) {
      res.status(403).json({ error: "Недостаточно прав для выдачи роли." });
      return;
    }

    await pool.query(
      `
        insert into employee_role_overrides (email, role, updated_at)
        values ($1, $2, now())
        on conflict (email) do update
        set role = excluded.role,
            updated_at = now()
      `,
      [email, role],
    );
    await removePendingAccessRequest(email);

    res.json({ ok: true, email, role });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось сохранить роль сотрудника.",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/api/employees/role-overrides", async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  if (!idToken) {
    res.status(400).json({ error: "Укажите idToken." });
    return;
  }

  try {
    const callerEmail = await verifyIdTokenEmail(idToken);
    const overrides = await readEmployeeRoleOverridesMap();
    if (!canAccessSettings(callerEmail, overrides)) {
      res.status(403).json({ error: "Недостаточно прав." });
      return;
    }

    res.json({ overrides });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось получить роли сотрудников.",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/api/employees/my-role-override", async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  if (!idToken) {
    res.status(400).json({ error: "Укажите idToken." });
    return;
  }

  try {
    const email = await verifyIdTokenEmail(idToken);
    const overrides = await readEmployeeRoleOverridesMap();
    res.json({ role: overrides[email] ?? null });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось получить роль пользователя.",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/api/auth/ensure-password", async (req, res) => {
  if (!isFirebaseAdminReady()) {
    res.status(503).json({
      error: "Firebase Admin не настроен. Добавьте firebase-service-account.json в корень проекта.",
    });
    return;
  }

  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

  try {
    const uid = idToken
      ? await ensureUserPasswordByIdToken(idToken)
      : email
        ? await ensureUserPasswordByEmail(email)
        : null;

    if (!uid) {
      res.status(400).json({ error: "Укажите idToken или email." });
      return;
    }

    res.json({ ok: true, uid });
  } catch (error) {
    res.status(500).json({
      error: "Не удалось установить пароль пользователю.",
      details: String(error?.message ?? error),
    });
  }
});

async function syncCanonicalEmployeeProfileNames() {
  for (const [email, fullName] of Object.entries(EMPLOYEE_FULL_NAME_BY_EMAIL)) {
    await pool.query(`update user_profiles set full_name = $1 where email = $2`, [fullName, email]);
    await pool.query(`update pending_access_requests set full_name = $1 where email = $2`, [fullName, email]);
  }
}

async function main() {
  try {
    await ensureClientsExtraColumns();
  } catch (error) {
    console.error("Failed to ensure clients extra columns:", error?.message ?? error);
    process.exit(1);
  }
  try {
    await ensureClientDetailStateSchema();
  } catch (error) {
    console.error("Failed to ensure client_detail_state schema:", error?.message ?? error);
    process.exit(1);
  }
  try {
    await ensureUserProfilesSchema();
  } catch (error) {
    console.error("Failed to ensure user_profiles schema:", error?.message ?? error);
    process.exit(1);
  }
  try {
    await ensureEmployeeRoleOverridesSchema();
  } catch (error) {
    console.error("Failed to ensure employee_role_overrides schema:", error?.message ?? error);
    process.exit(1);
  }
  try {
    await ensurePendingAccessRequestsSchema();
  } catch (error) {
    console.error("Failed to ensure pending_access_requests schema:", error?.message ?? error);
    process.exit(1);
  }
  try {
    await syncCanonicalEmployeeProfileNames();
  } catch (error) {
    console.error("Failed to sync canonical employee profile names:", error?.message ?? error);
  }
  app.listen(API_PORT, () => {
    console.log(`API server listening on http://localhost:${API_PORT}`);
  });
}

main();

