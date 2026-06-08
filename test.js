const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'friend'
  );

  CREATE TABLE interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    occurred_on TEXT NOT NULL,
    summary TEXT NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );

  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    due_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );
`);

const contactId = db.prepare("INSERT INTO contacts (name, relationship_type) VALUES (?, ?)").run("Test Person", "client").lastInsertRowid;
db.prepare("INSERT INTO interactions (contact_id, occurred_on, summary) VALUES (?, ?, ?)").run(contactId, "2026-06-01", "Intro call");
db.prepare("INSERT INTO tasks (contact_id, title, due_on) VALUES (?, ?, ?)").run(contactId, "Follow up", "2026-06-09");

const dashboard = db.prepare(`
  SELECT c.name, COUNT(DISTINCT i.id) AS interaction_count, SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_task_count
  FROM contacts c
  LEFT JOIN interactions i ON i.contact_id = c.id
  LEFT JOIN tasks t ON t.contact_id = c.id
  GROUP BY c.id
`).get();

if (dashboard.name !== "Test Person") throw new Error("Contact query failed");
if (dashboard.interaction_count !== 1) throw new Error("Interaction count failed");
if (dashboard.open_task_count !== 1) throw new Error("Task count failed");

db.close();
console.log("All tests passed");
