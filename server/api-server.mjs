import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pg from "pg";

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
const CLIENT_COLUMNS = ["id", "full_name", "phone", "requests_count", "last_visit", "total_amount"];

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

app.get("/api/clients/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Missing client id." });
    return;
  }
  try {
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

app.listen(API_PORT, () => {
  console.log(`API server listening on http://localhost:${API_PORT}`);
});

