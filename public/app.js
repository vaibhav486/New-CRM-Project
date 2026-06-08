git add .const state = {
  contacts: [],
  interactions: [],
  tasks: [],
  dashboard: null,
  view: "dashboard",
  contactSearch: ""
};

const views = {
  dashboard: document.querySelector("#dashboard-view"),
  contacts: document.querySelector("#contacts-view"),
  interactions: document.querySelector("#interactions-view"),
  tasks: document.querySelector("#tasks-view")
};

const title = document.querySelector("#view-title");
const toast = document.querySelector("#toast");
const today = new Date().toISOString().slice(0, 10);

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#refresh-button").addEventListener("click", loadAll);
document.querySelector("#quick-add-button").addEventListener("click", () => {
  setView("contacts");
  resetContactForm();
  document.querySelector("[name='name']").focus();
});

document.querySelector("#contact-search").addEventListener("input", (event) => {
  state.contactSearch = event.target.value.toLowerCase();
  renderContacts();
});

document.querySelector("#reset-contact-form").addEventListener("click", resetContactForm);
document.querySelector("#contact-form").addEventListener("submit", saveContact);
document.querySelector("#interaction-form").addEventListener("submit", saveInteraction);
document.querySelector("#task-form").addEventListener("submit", saveTask);

document.querySelector("#interaction-form [name='occurred_on']").value = today;
document.querySelector("#task-form [name='due_on']").value = today;

loadAll();

async function loadAll() {
  const [dashboard, contacts, interactions, tasks] = await Promise.all([
    api("/api/dashboard"),
    api("/api/contacts"),
    api("/api/interactions"),
    api("/api/tasks")
  ]);

  state.dashboard = dashboard;
  state.contacts = contacts;
  state.interactions = interactions;
  state.tasks = tasks;

  renderAll();
}

function renderAll() {
  renderDashboard();
  renderContactOptions();
  renderContacts();
  renderInteractions();
  renderTasks();
}

function setView(view) {
  state.view = view;
  Object.entries(views).forEach(([key, element]) => element.classList.toggle("active", key === view));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  title.textContent = view[0].toUpperCase() + view.slice(1);
}

function renderDashboard() {
  const data = state.dashboard;
  const metrics = [
    ["Contacts", data.totals.contacts],
    ["Interactions", data.totals.interactions],
    ["Open tasks", data.totals.open_tasks],
    ["Overdue", data.totals.overdue_tasks]
  ];

  document.querySelector("#metrics").innerHTML = metrics
    .map(([label, value]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`)
    .join("");

  document.querySelector("#due-count").textContent = `${data.dueTasks.length} shown`;
  document.querySelector("#due-tasks").innerHTML = data.dueTasks.length
    ? data.dueTasks.map(renderTaskSummary).join("")
    : empty("No open follow-ups.");

  document.querySelector("#stale-contacts").innerHTML = data.staleContacts.length
    ? data.staleContacts.map((contact) => `
      <article class="list-item">
        <div class="item-title">
          <span>${escapeHtml(contact.name)}</span>
          <span class="pill">${escapeHtml(contact.relationship_type)}</span>
        </div>
        <div class="meta">${contact.last_contacted ? `Last contact: ${formatDate(contact.last_contacted)}` : "No interactions yet"}</div>
      </article>
    `).join("")
    : empty("No stale contacts.");

  document.querySelector("#recent-interactions").innerHTML = data.recentInteractions.length
    ? data.recentInteractions.map(renderInteractionSummary).join("")
    : empty("No interactions logged.");

  const max = Math.max(1, ...data.relationshipMix.map((item) => item.value));
  document.querySelector("#relationship-mix").innerHTML = data.relationshipMix.length
    ? data.relationshipMix.map((item) => `
      <div class="bar-row">
        <strong>${escapeHtml(item.label)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width: ${(item.value / max) * 100}%"></div></div>
        <span>${item.value}</span>
      </div>
    `).join("")
    : empty("No contacts yet.");
}

function renderContacts() {
  const query = state.contactSearch;
  const contacts = state.contacts.filter((contact) => {
    const haystack = `${contact.name} ${contact.email} ${contact.phone} ${contact.relationship_type} ${contact.tags}`.toLowerCase();
    return haystack.includes(query);
  });

  document.querySelector("#contacts-table").innerHTML = contacts.length
    ? contacts.map((contact) => `
      <article class="contact-row">
        <div>
          <div class="item-title"><span>${escapeHtml(contact.name)}</span></div>
          <div class="meta">${escapeHtml(contact.email || contact.phone || "No contact detail")}</div>
        </div>
        <div>
          <span class="pill">${escapeHtml(contact.relationship_type)}</span>
          <div class="meta">${escapeHtml(contact.source || "No source")}</div>
        </div>
        <div class="meta">${contact.last_contacted ? `Last: ${formatDate(contact.last_contacted)}` : "No interactions"}</div>
        <div class="contact-actions">
          <button class="small-button" data-edit-contact="${contact.id}">Edit</button>
          <button class="small-button" data-delete-contact="${contact.id}">Delete</button>
        </div>
      </article>
    `).join("")
    : empty("No contacts match.");

  document.querySelectorAll("[data-edit-contact]").forEach((button) => {
    button.addEventListener("click", () => editContact(Number(button.dataset.editContact)));
  });
  document.querySelectorAll("[data-delete-contact]").forEach((button) => {
    button.addEventListener("click", () => deleteContact(Number(button.dataset.deleteContact)));
  });
}

function renderInteractions() {
  document.querySelector("#interactions-list").innerHTML = state.interactions.length
    ? state.interactions.map(renderInteractionSummary).join("")
    : empty("No interactions logged.");
}

function renderTasks() {
  document.querySelector("#tasks-list").innerHTML = state.tasks.length
    ? state.tasks.map((task) => `
      <article class="task-item ${task.status === "done" ? "done" : ""} ${task.status === "open" && task.due_on < today ? "overdue" : ""}">
        <div class="item-title">
          <span>${escapeHtml(task.title)}</span>
          <span class="pill">${escapeHtml(task.status)}</span>
        </div>
        <div class="meta">${escapeHtml(task.contact_name)} · Due ${formatDate(task.due_on)}</div>
        ${task.status === "open" ? `<div class="task-actions"><button class="small-button" data-complete-task="${task.id}">Complete</button></div>` : ""}
      </article>
    `).join("")
    : empty("No tasks yet.");

  document.querySelectorAll("[data-complete-task]").forEach((button) => {
    button.addEventListener("click", () => completeTask(Number(button.dataset.completeTask)));
  });
}

function renderContactOptions() {
  const options = state.contacts.map((contact) => `<option value="${contact.id}">${escapeHtml(contact.name)}</option>`).join("");
  document.querySelectorAll("select[name='contact_id']").forEach((select) => {
    const current = select.value;
    select.innerHTML = options;
    if (current) select.value = current;
  });
}

async function saveContact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = formToObject(form);
  const id = body.id;
  delete body.id;
  await api(id ? `/api/contacts/${id}` : "/api/contacts", {
    method: id ? "PUT" : "POST",
    body
  });
  resetContactForm();
  await loadAll();
  showToast("Contact saved.");
}

async function saveInteraction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/interactions", { method: "POST", body: formToObject(form) });
  form.reset();
  form.querySelector("[name='occurred_on']").value = today;
  await loadAll();
  showToast("Interaction logged.");
}

async function saveTask(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/tasks", { method: "POST", body: formToObject(form) });
  form.reset();
  form.querySelector("[name='due_on']").value = today;
  await loadAll();
  showToast("Task created.");
}

async function completeTask(id) {
  await api(`/api/tasks/${id}/complete`, { method: "PUT" });
  await loadAll();
  showToast("Task completed.");
}

function editContact(id) {
  const contact = state.contacts.find((item) => item.id === id);
  if (!contact) return;

  const form = document.querySelector("#contact-form");
  Object.keys(contact).forEach((key) => {
    if (form.elements[key]) form.elements[key].value = contact[key] || "";
  });
  document.querySelector("#contact-form-title").textContent = "Edit contact";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteContact(id) {
  const contact = state.contacts.find((item) => item.id === id);
  if (!contact) return;
  const confirmed = confirm(`Delete ${contact.name} and their history?`);
  if (!confirmed) return;

  await api(`/api/contacts/${id}`, { method: "DELETE" });
  await loadAll();
  showToast("Contact deleted.");
}

function resetContactForm() {
  const form = document.querySelector("#contact-form");
  form.reset();
  form.elements.id.value = "";
  document.querySelector("#contact-form-title").textContent = "Add contact";
}

function renderTaskSummary(task) {
  return `
    <article class="list-item ${task.due_on < today ? "overdue" : ""}">
      <div class="item-title">
        <span>${escapeHtml(task.title)}</span>
        <span class="pill">${formatDate(task.due_on)}</span>
      </div>
      <div class="meta">${escapeHtml(task.contact_name)}</div>
    </article>
  `;
}

function renderInteractionSummary(interaction) {
  return `
    <article class="activity-item">
      <div class="item-title">
        <span>${escapeHtml(interaction.contact_name)}</span>
        <span class="pill">${escapeHtml(interaction.type)}</span>
      </div>
      <div class="meta">${formatDate(interaction.occurred_on)}</div>
      <p>${escapeHtml(interaction.summary)}</p>
    </article>
  `;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    showToast(payload.error || "Request failed.");
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
