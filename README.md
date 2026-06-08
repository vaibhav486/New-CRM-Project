# Personal CRM System

A local-first personal CRM for tracking relationships, interaction history, reminders, and weekly review work.

## Run

Double-click `start-crm.cmd`, or run:

```powershell
node --disable-warning=ExperimentalWarning server.js
```

Open `http://localhost:3000`.

The app creates `crm.db` automatically in this folder. Backing up the CRM is as simple as copying that file while the server is stopped.

## Features

- Contacts with name, email, phone, relationship type, source, tags, and notes
- Interaction log for calls, emails, meetings, messages, and notes
- Follow-up tasks with due dates and completion state
- Dashboard for open tasks, overdue tasks, recent interactions, stale contacts, and relationship mix
- Seed data on first run so the workflow is visible immediately

## Workflow

1. Add or update contacts whenever you meet someone important.
2. Log meaningful calls, emails, meetings, and messages.
3. Create a follow-up task whenever a relationship needs a next step.
4. Use the dashboard once a week to clear due tasks and reconnect with stale contacts.

## Tech Stack

- **Backend:** Node.js (minimum version `22.5.0`), using the built-in `node:http` server in `server.js`.
- **Database:** SQLite (local file `crm.db`) accessed via `node:sqlite` (`DatabaseSync`) from `server.js`.
- **Frontend:** Static HTML, CSS, and JavaScript served from the `public/` folder (`index.html`, `app.js`, `styles.css`).
- **Storage:** Local-first — data is persisted to `crm.db` in the project root.
- **Run:** Start the app with `node --disable-warning=ExperimentalWarning server.js` or `npm start`.
- **Notes:** No external frameworks are required; the project uses Node built-ins and a simple file-backed SQLite database, so it runs fully offline.

## Screenshots

- Dashboard (main): [screenshots/Dashboard.png](screenshots/Dashboard.png)
- Dashboard (alt): [screenshots/dashboard (2).png](screenshots/dashboard (2).png)
- Contacts view: [screenshots/contact.png](screenshots/contact.png)
- Interactions view: [screenshots/Interactions.png](screenshots/Interactions.png)
- Tasks view: [screenshots/Tasks.png](screenshots/Tasks.png)

