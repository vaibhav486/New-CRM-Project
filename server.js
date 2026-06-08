const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "crm.db");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    relationship_type TEXT NOT NULL DEFAULT 'friend',
    source TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'meeting',
    occurred_on TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    due_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );
`);

seedDatabase();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(res, error.status, error);
      return;
    }
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong." });
  }
});

server.listen(PORT, () => {
  console.log(`Personal CRM running at http://localhost:${PORT}`);
});

function seedDatabase() {
  const contactCount = db.prepare("SELECT COUNT(*) AS count FROM contacts").get().count;
  if (contactCount > 0) return;

  const insertContact = db.prepare(`
    INSERT INTO contacts (name, email, phone, relationship_type, source, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInteraction = db.prepare(`
    INSERT INTO interactions (contact_id, type, occurred_on, summary)
    VALUES (?, ?, ?, ?)
  `);
  const insertTask = db.prepare(`
    INSERT INTO tasks (contact_id, title, due_on, status)
    VALUES (?, ?, ?, ?)
  `);

  const today = new Date();
  const daysAgo = (days) => formatDate(addDays(today, -days));
  const daysFromNow = (days) => formatDate(addDays(today, days));

  const contacts = [
    ["Maya Rao", "maya@example.com", "+91 98765 43210", "friend", "College reunion", "design,city", "Prefers weekend catch-ups."],
    ["Arjun Mehta", "arjun@example.com", "+91 90000 11111", "colleague", "Product meetup", "saas,founder", "Discuss hiring trends."],
    ["Nisha Kapoor", "nisha@example.com", "", "client", "Referral", "finance,priority", "Interested in quarterly planning help."],
    ["Rohan Sen", "", "+91 88888 22222", "mentor", "Previous job", "career,ops", "Shares practical advice."],
    ["Leah Martin", "leah@example.com", "", "prospect", "LinkedIn", "analytics,remote", "Needs a soft follow-up."]
  ];

  const ids = contacts.map((contact) => insertContact.run(...contact).lastInsertRowid);

  insertInteraction.run(ids[0], "call", daysAgo(12), "Caught up about work, family, and a possible design workshop.");
  insertInteraction.run(ids[1], "meeting", daysAgo(36), "Met after the product meetup and exchanged notes on CRM tooling.");
  insertInteraction.run(ids[2], "email", daysAgo(5), "Sent a proposal recap and next-step options.");
  insertInteraction.run(ids[3], "call", daysAgo(54), "Talked through career goals and potential introductions.");
  insertInteraction.run(ids[4], "message", daysAgo(22), "Initial LinkedIn exchange about analytics workflows.");

  insertTask.run(ids[1], "Send article on customer retention", daysFromNow(2), "open");
  insertTask.run(ids[2], "Follow up on proposal decision", daysFromNow(1), "open");
  insertTask.run(ids[3], "Schedule monthly mentor call", daysAgo(1), "open");
}

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api/, "");
  const method = req.method || "GET";

  if (method === "GET" && route === "/dashboard") {
    sendJson(res, 200, getDashboard());
    return;
  }

  if (method === "GET" && route === "/contacts") {
    sendJson(res, 200, getContacts());
    return;
  }

  if (method === "POST" && route === "/contacts") {
    const body = await readBody(req);
    sendJson(res, 201, createContact(body));
    return;
  }

  const contactMatch = route.match(/^\/contacts\/(\d+)$/);
  if (contactMatch && method === "PUT") {
    const body = await readBody(req);
    const contact = updateContact(Number(contactMatch[1]), body);
    sendJson(res, 200, contact);
    return;
  }

  if (contactMatch && method === "DELETE") {
    db.prepare("DELETE FROM contacts WHERE id = ?").run(Number(contactMatch[1]));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && route === "/interactions") {
    sendJson(res, 200, getInteractions(Number(url.searchParams.get("contactId")) || null));
    return;
  }

  if (method === "POST" && route === "/interactions") {
    const body = await readBody(req);
    sendJson(res, 201, createInteraction(body));
    return;
  }

  if (method === "GET" && route === "/tasks") {
    sendJson(res, 200, getTasks(Number(url.searchParams.get("contactId")) || null));
    return;
  }

  if (method === "POST" && route === "/tasks") {
    const body = await readBody(req);
    sendJson(res, 201, createTask(body));
    return;
  }

  const taskMatch = route.match(/^\/tasks\/(\d+)\/complete$/);
  if (taskMatch && method === "PUT") {
    const task = completeTask(Number(taskMatch[1]));
    sendJson(res, 200, task);
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

function getContacts() {
  return db.prepare(`
    SELECT
      c.*,
      MAX(i.occurred_on) AS last_contacted,
      COUNT(DISTINCT i.id) AS interaction_count,
      SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_task_count
    FROM contacts c
    LEFT JOIN interactions i ON i.contact_id = c.id
    LEFT JOIN tasks t ON t.contact_id = c.id
    GROUP BY c.id
    ORDER BY COALESCE(last_contacted, c.created_at) DESC, c.name ASC
  `).all();
}

function createContact(body) {
  const contact = normalizeContact(body);
  const result = db.prepare(`
    INSERT INTO contacts (name, email, phone, relationship_type, source, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(contact.name, contact.email, contact.phone, contact.relationship_type, contact.source, contact.tags, contact.notes);
  return getContact(result.lastInsertRowid);
}

function updateContact(id, body) {
  const contact = normalizeContact(body);
  db.prepare(`
    UPDATE contacts
    SET name = ?, email = ?, phone = ?, relationship_type = ?, source = ?, tags = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(contact.name, contact.email, contact.phone, contact.relationship_type, contact.source, contact.tags, contact.notes, id);
  return getContact(id);
}

function getContact(id) {
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id);
  if (!contact) throw new ApiError(404, "Contact not found.");
  return contact;
}

function getInteractions(contactId) {
  const sql = `
    SELECT i.*, c.name AS contact_name
    FROM interactions i
    JOIN contacts c ON c.id = i.contact_id
    ${contactId ? "WHERE i.contact_id = ?" : ""}
    ORDER BY i.occurred_on DESC, i.id DESC
  `;
  return contactId ? db.prepare(sql).all(contactId) : db.prepare(sql).all();
}

function createInteraction(body) {
  const contactId = Number(body.contact_id);
  if (!contactId) throw new ApiError(400, "Choose a contact.");
  getContact(contactId);

  const type = clean(body.type) || "meeting";
  const occurredOn = clean(body.occurred_on) || formatDate(new Date());
  const summary = clean(body.summary);
  if (!summary) throw new ApiError(400, "Interaction summary is required.");

  const result = db.prepare(`
    INSERT INTO interactions (contact_id, type, occurred_on, summary)
    VALUES (?, ?, ?, ?)
  `).run(contactId, type, occurredOn, summary);
  return db.prepare("SELECT * FROM interactions WHERE id = ?").get(result.lastInsertRowid);
}

function getTasks(contactId) {
  const sql = `
    SELECT t.*, c.name AS contact_name
    FROM tasks t
    JOIN contacts c ON c.id = t.contact_id
    ${contactId ? "WHERE t.contact_id = ?" : ""}
    ORDER BY
      CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
      t.due_on ASC,
      t.id DESC
  `;
  return contactId ? db.prepare(sql).all(contactId) : db.prepare(sql).all();
}

function createTask(body) {
  const contactId = Number(body.contact_id);
  if (!contactId) throw new ApiError(400, "Choose a contact.");
  getContact(contactId);

  const title = clean(body.title);
  const dueOn = clean(body.due_on);
  if (!title) throw new ApiError(400, "Task title is required.");
  if (!dueOn) throw new ApiError(400, "Due date is required.");

  const result = db.prepare(`
    INSERT INTO tasks (contact_id, title, due_on, status)
    VALUES (?, ?, ?, 'open')
  `).run(contactId, title, dueOn);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
}

function completeTask(id) {
  db.prepare(`
    UPDATE tasks
    SET status = 'done', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!task) throw new ApiError(404, "Task not found.");
  return task;
}

function getDashboard() {
  const today = formatDate(new Date());
  const staleBefore = formatDate(addDays(new Date(), -30));
  const contacts = getContacts();
  const tasks = getTasks();
  const interactions = getInteractions();

  const relationshipRows = db.prepare(`
    SELECT relationship_type AS label, COUNT(*) AS value
    FROM contacts
    GROUP BY relationship_type
    ORDER BY value DESC
  `).all();

  return {
    totals: {
      contacts: contacts.length,
      interactions: interactions.length,
      open_tasks: tasks.filter((task) => task.status === "open").length,
      overdue_tasks: tasks.filter((task) => task.status === "open" && task.due_on < today).length
    },
    dueTasks: tasks.filter((task) => task.status === "open").slice(0, 8),
    staleContacts: contacts
      .filter((contact) => !contact.last_contacted || contact.last_contacted < staleBefore)
      .slice(0, 8),
    recentInteractions: interactions.slice(0, 8),
    relationshipMix: relationshipRows
  };
}

function normalizeContact(body) {
  const name = clean(body.name);
  if (!name) throw new ApiError(400, "Name is required.");
  return {
    name,
    email: clean(body.email),
    phone: clean(body.phone),
    relationship_type: clean(body.relationship_type) || "friend",
    source: clean(body.source),
    tags: clean(body.tags),
    notes: clean(body.notes)
  };
}

async function serveStatic(res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(PUBLIC_DIR, `.${requested}`);

  if (!resolved.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!existsSync(resolved)) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(resolved);
  const content = await readFile(resolved);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(content);
}

async function readBody(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  try {
    return data ? JSON.parse(data) : {};
  } catch {
    throw new ApiError(400, "Invalid JSON.");
  }
}

function sendJson(res, status, payload) {
  const body = payload instanceof ApiError ? { error: payload.message } : payload;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function clean(value) {
  return String(value || "").trim();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
