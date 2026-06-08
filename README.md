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
