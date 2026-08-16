import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Connect a Neon/Postgres database to this project in Vercel (Storage tab) and redeploy."
    );
  }
  return neon(url);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      detail TEXT,
      deadline TEXT,
      priority TEXT,
      mood INTEGER,
      status TEXT,
      created_at TEXT
    )
  `;
}

function rowToItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail ?? undefined,
    deadline: row.deadline ?? null,
    priority: row.priority ?? undefined,
    mood: row.mood ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function applyOp(sql, op) {
  if (!op || typeof op !== "object") return null;

  if (op.op === "add_task") {
    const item = {
      id: randomUUID(),
      type: "task",
      title: op.title,
      deadline: op.deadline || null,
      priority: op.priority || "medium",
      status: "open",
      createdAt: todayISO(),
    };
    await sql`
      INSERT INTO memory_items (id, type, title, deadline, priority, status, created_at)
      VALUES (${item.id}, ${item.type}, ${item.title}, ${item.deadline}, ${item.priority}, ${item.status}, ${item.createdAt})
    `;
    return item;
  }

  if (op.op === "add_note") {
    const item = {
      id: randomUUID(),
      type: "note",
      title: op.title,
      detail: op.detail || "",
      mood: op.mood ?? null,
      status: "logged",
      createdAt: todayISO(),
    };
    await sql`
      INSERT INTO memory_items (id, type, title, detail, mood, status, created_at)
      VALUES (${item.id}, ${item.type}, ${item.title}, ${item.detail}, ${item.mood}, ${item.status}, ${item.createdAt})
    `;
    return item;
  }

  if (op.op === "complete") {
    await sql`UPDATE memory_items SET status = 'done' WHERE id = ${op.id}`;
    return null;
  }

  if (op.op === "update") {
    const f = op.fields || {};
    if ("title" in f) await sql`UPDATE memory_items SET title = ${f.title} WHERE id = ${op.id}`;
    if ("deadline" in f) await sql`UPDATE memory_items SET deadline = ${f.deadline} WHERE id = ${op.id}`;
    if ("priority" in f) await sql`UPDATE memory_items SET priority = ${f.priority} WHERE id = ${op.id}`;
    if ("status" in f) await sql`UPDATE memory_items SET status = ${f.status} WHERE id = ${op.id}`;
    if ("detail" in f) await sql`UPDATE memory_items SET detail = ${f.detail} WHERE id = ${op.id}`;
    if ("mood" in f) await sql`UPDATE memory_items SET mood = ${f.mood} WHERE id = ${op.id}`;
    return null;
  }

  if (op.op === "delete") {
    await sql`DELETE FROM memory_items WHERE id = ${op.id}`;
    return null;
  }

  return null;
}

export default async function handler(req, res) {
  try {
    const sql = getSql();
    await ensureTable(sql);

    if (req.method === "GET") {
      const rows = await sql`SELECT * FROM memory_items ORDER BY created_at ASC`;
      return res.status(200).json({ items: rows.map(rowToItem) });
    }

    if (req.method === "POST") {
      const { ops = [] } = req.body || {};
      const added = [];
      for (const op of ops) {
        const item = await applyOp(sql, op);
        if (item) added.push(item);
      }
      const rows = await sql`SELECT * FROM memory_items ORDER BY created_at ASC`;
      return res.status(200).json({ items: rows.map(rowToItem), added });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("memory api error:", err);
    return res.status(500).json({
      error: "Storage error",
      message: err.message || "Could not reach the database.",
      details: String(err),
    });
  }
}
