/* Marley Care Log — local-first care log for Marley (15 lb poodle mix).
   No dependencies, no build step. All data lives in localStorage. */
"use strict";

// ============ Constants ============

const STORAGE_KEY = "marley-care-log:v1";
const APP_NAME = "marley-care-log";
const DATA_VERSION = 1;
const CYTOPOINT_INTERVAL_DAYS = 42; // Marley gets Cytopoint every 6 weeks

const TYPES = {
  meal:       { label: "Meal",             icon: "🍗" },
  treat:      { label: "Treat",            icon: "🦴" },
  symptom:    { label: "Itch / Allergy",   icon: "🐾" },
  gi:         { label: "GI / Stool",       icon: "💩" },
  medication: { label: "Medication",       icon: "💊" },
  cytopoint:  { label: "Cytopoint",        icon: "💉" },
  varl:       { label: "VARL Check-in",    icon: "🧪" },
  grooming:   { label: "Grooming / Bath",  icon: "🛁" },
  trigger:    { label: "Suspected Trigger",icon: "⚠️" },
  vet:        { label: "Vet Question",     icon: "❓" },
  note:       { label: "Note",             icon: "📝" },
};

const STOOL_LABELS = {
  normal: "Normal stool",
  soft: "Soft stool",
  diarrhea: "Diarrhea",
  mucus: "Mucus / blood",
  constipated: "Constipated",
  vomit: "Vomiting",
};

const SEVERITY_HINTS = { 1: "barely noticeable", 2: "mild", 3: "moderate", 4: "bad", 5: "constant / miserable" };

const DETAILS_PLACEHOLDERS = {
  meal: "e.g. 1/2 cup hydrolyzed protein kibble, ate it all",
  treat: "e.g. 2 freeze-dried rabbit treats",
  symptom: "e.g. chewing front paws after the park, ears look red",
  gi: "e.g. soft stool on evening walk",
  medication: "e.g. Apoquel 5.4 mg, with breakfast",
  cytopoint: "e.g. Cytopoint injection at Dr. Lee's (optional)",
  varl: "e.g. VARL drops, 3rd week of maintenance dose — no reaction",
  grooming: "e.g. bath with chlorhexidine shampoo, 10 min soak",
  trigger: "e.g. itchier after chicken treat from neighbor",
  vet: "e.g. should we adjust the VARL dose if itching returns?",
  note: "Anything else worth remembering",
};

// ============ Storage ============

function sanitizeFood(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.openedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.openedDate)) return null;
  const lasts = Number(raw.lastsDays);
  if (!Number.isInteger(lasts) || lasts < 1 || lasts > 365) return null;
  return { openedDate: raw.openedDate, lastsDays: lasts };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], food: null };
    const data = JSON.parse(raw);
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      food: sanitizeFood(data.food),
    };
  } catch (e) {
    console.error("Failed to load data", e);
    return { entries: [], food: null };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ app: APP_NAME, version: DATA_VERSION, entries, food }));
  } catch (e) {
    console.error("Failed to save data", e);
    showToast("⚠️ Could not save — browser storage may be full");
  }
}

const _loaded = loadState();
let entries = _loaded.entries;
let food = _loaded.food; // { openedDate, lastsDays } or null

// ============ Helpers ============

function uid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateStr(d);
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(dateStrA, dateStrB) {
  return Math.round((parseDate(dateStrB) - parseDate(dateStrA)) / 86400000);
}

function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function foodDaysLeft() {
  if (!food) return null;
  return food.lastsDays - daysBetween(food.openedDate, todayStr());
}

function lastCytopoint() {
  const cyto = sortEntries(entries.filter((e) => e.type === "cytopoint"));
  return cyto[0] || null;
}

function fmtDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    year: parseDate(dateStr).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function fmtDateLong(dateStr) {
  return parseDate(dateStr).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function fmtTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sortEntries(list) {
  return [...list].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "") || (b.createdAt || "").localeCompare(a.createdAt || "")
  );
}

function entriesSince(dateStr) {
  return entries.filter((e) => e.date >= dateStr);
}

// ============ Toast & dialogs ============

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/** Show a dialog with message and buttons: [{label, value, kind}]. Resolves with chosen value or null. */
function askDialog(message, buttons) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("app-dialog");
    document.getElementById("dialog-message").textContent = message;
    const wrap = document.getElementById("dialog-buttons");
    wrap.innerHTML = "";
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "btn" + (b.kind === "primary" ? " btn-primary" : b.kind === "danger" ? " btn-danger" : "");
      btn.textContent = b.label;
      btn.addEventListener("click", () => { dlg.close(); resolve(b.value); });
      wrap.appendChild(btn);
    });
    dlg.onclose = () => resolve(null);
    dlg.showModal();
  });
}

function confirmDialog(message, confirmLabel = "Confirm", danger = false) {
  return askDialog(message, [
    { label: "Cancel", value: false },
    { label: confirmLabel, value: true, kind: danger ? "danger" : "primary" },
  ]).then((v) => v === true);
}

// ============ Views / navigation ============

const VIEWS = ["dashboard", "log", "vet", "data"];
let currentView = "dashboard";

function switchView(view) {
  currentView = view;
  VIEWS.forEach((v) => {
    document.getElementById(`view-${v}`).hidden = v !== view;
  });
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.view === view;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
  });
  if (view === "dashboard") renderDashboard();
  if (view === "log") renderEntryList();
  if (view === "vet") renderVetSummary();
  if (view === "data") renderDataInfo();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => switchView(t.dataset.view))
);

// ============ Entry form ============

let formType = "meal";
let formSeverity = 3;
let editingId = null;

function buildTypeChips() {
  const wrap = document.getElementById("type-chips");
  wrap.innerHTML = "";
  Object.entries(TYPES).forEach(([key, meta]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "type-chip" + (key === formType ? " selected" : "");
    btn.dataset.type = key;
    btn.textContent = `${meta.icon} ${meta.label}`;
    btn.addEventListener("click", () => setFormType(key));
    wrap.appendChild(btn);
  });
}

function setFormType(type) {
  formType = type;
  document.querySelectorAll(".type-chip").forEach((c) =>
    c.classList.toggle("selected", c.dataset.type === type)
  );
  document.getElementById("severity-field").hidden = type !== "symptom";
  document.getElementById("stool-field").hidden = type !== "gi";
  document.getElementById("f-details").placeholder = DETAILS_PLACEHOLDERS[type] || "What happened?";
}

function buildSeverityPicker() {
  const wrap = document.getElementById("severity-picker");
  wrap.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sev-btn" + (i === formSeverity ? " selected" : "");
    btn.textContent = i;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(i === formSeverity));
    btn.addEventListener("click", () => setSeverity(i));
    wrap.appendChild(btn);
  }
  const hint = document.createElement("span");
  hint.className = "sev-hint";
  hint.id = "sev-hint";
  hint.textContent = SEVERITY_HINTS[formSeverity];
  wrap.appendChild(hint);
}

function setSeverity(n) {
  formSeverity = n;
  document.querySelectorAll(".sev-btn").forEach((b, i) => {
    b.classList.toggle("selected", i + 1 === n);
    b.setAttribute("aria-checked", String(i + 1 === n));
  });
  document.getElementById("sev-hint").textContent = SEVERITY_HINTS[n];
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Add entry";
  document.getElementById("form-submit").textContent = "Save entry";
  document.getElementById("form-cancel-edit").hidden = true;
  document.getElementById("f-date").value = todayStr();
  document.getElementById("f-time").value = "";
  document.getElementById("f-details").value = "";
  document.getElementById("f-details").classList.remove("invalid");
  document.getElementById("details-error").hidden = true;
  document.getElementById("f-stool").value = "normal";
  setSeverity(3);
  setFormType("meal");
}

function startEdit(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  switchView("log");
  editingId = id;
  document.getElementById("form-title").textContent = "Edit entry";
  document.getElementById("form-submit").textContent = "Update entry";
  document.getElementById("form-cancel-edit").hidden = false;
  setFormType(e.type);
  document.getElementById("f-date").value = e.date;
  document.getElementById("f-time").value = e.time || "";
  document.getElementById("f-details").value = e.details || "";
  if (e.type === "symptom") setSeverity(e.severity || 3);
  if (e.type === "gi") document.getElementById("f-stool").value = e.stool || "normal";
  document.querySelector(".form-card").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("form-cancel-edit").addEventListener("click", () => {
  resetForm();
  showToast("Edit cancelled");
});

document.getElementById("entry-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const date = document.getElementById("f-date").value;
  const time = document.getElementById("f-time").value;
  let details = document.getElementById("f-details").value.trim();
  const detailsEl = document.getElementById("f-details");
  const errEl = document.getElementById("details-error");

  if (!date) { showToast("Please pick a date"); return; }

  // Cytopoint & grooming entries are meaningful with just a date; everything else needs a note.
  if (!details && formType !== "cytopoint" && formType !== "grooming") {
    detailsEl.classList.add("invalid");
    errEl.hidden = false;
    detailsEl.focus();
    return;
  }
  detailsEl.classList.remove("invalid");
  errEl.hidden = true;
  if (!details && formType === "cytopoint") details = "Cytopoint injection";
  if (!details && formType === "grooming") details = "Grooming / bath";

  const now = new Date().toISOString();
  const base = { type: formType, date, time: time || null, details };
  if (formType === "symptom") base.severity = formSeverity;
  if (formType === "gi") base.stool = document.getElementById("f-stool").value;

  if (editingId) {
    const idx = entries.findIndex((x) => x.id === editingId);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...base, severity: base.severity ?? null, stool: base.stool ?? null, updatedAt: now };
    }
    showToast("Entry updated ✓");
  } else {
    entries.push({ id: uid(), ...base, createdAt: now, updatedAt: now });
    showToast("Entry saved ✓");
  }
  saveState();
  resetForm();
  renderEntryList();
});

async function deleteEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  const ok = await confirmDialog(
    `Delete this ${TYPES[e.type]?.label.toLowerCase() || "entry"} from ${fmtDate(e.date)}?\n\n“${(e.details || "").slice(0, 80)}”`,
    "Delete", true
  );
  if (!ok) return;
  entries = entries.filter((x) => x.id !== id);
  if (editingId === id) resetForm();
  saveState();
  renderEntryList();
  renderDashboard();
  showToast("Entry deleted");
}

// ============ Entry list ============

function buildFilterTypeOptions() {
  const sel = document.getElementById("filter-type");
  Object.entries(TYPES).forEach(([key, meta]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${meta.icon} ${meta.label}`;
    sel.appendChild(opt);
  });
}

function getFilteredEntries() {
  const q = document.getElementById("filter-search").value.trim().toLowerCase();
  const type = document.getElementById("filter-type").value;
  const range = document.getElementById("filter-range").value;
  let list = entries;
  if (type) list = list.filter((e) => e.type === type);
  if (range) {
    const cutoff = todayStr(-Number(range) + 1);
    list = list.filter((e) => e.date >= cutoff);
  }
  if (q) {
    list = list.filter((e) =>
      (e.details || "").toLowerCase().includes(q) ||
      (TYPES[e.type]?.label || "").toLowerCase().includes(q)
    );
  }
  return sortEntries(list);
}

function entryBadges(e) {
  let html = "";
  if (e.type === "symptom" && e.severity) {
    const cls = e.severity >= 4 ? "badge-bad" : e.severity <= 2 ? "badge-ok" : "";
    html += `<span class="entry-badge ${cls}">itch ${e.severity}/5</span>`;
  }
  if (e.type === "gi" && e.stool) {
    const cls = e.stool === "normal" ? "badge-ok" : "badge-bad";
    html += `<span class="entry-badge ${cls}">${escapeHtml(STOOL_LABELS[e.stool] || e.stool)}</span>`;
  }
  return html;
}

function entryItemHtml(e, withActions = true) {
  const meta = TYPES[e.type] || { label: e.type, icon: "📌" };
  const timePart = e.time ? ` · ${fmtTime(e.time)}` : "";
  const actions = withActions
    ? `<div class="entry-actions">
         <button class="icon-btn" data-action="edit" data-id="${e.id}" title="Edit" aria-label="Edit entry">✏️</button>
         <button class="icon-btn" data-action="delete" data-id="${e.id}" title="Delete" aria-label="Delete entry">🗑️</button>
       </div>`
    : "";
  return `<div class="entry-item">
    <div class="entry-icon" aria-hidden="true">${meta.icon}</div>
    <div class="entry-body">
      <div class="entry-meta">${escapeHtml(meta.label)}${timePart}${entryBadges(e)}</div>
      <div class="entry-details">${escapeHtml(e.details || "")}</div>
    </div>
    ${actions}
  </div>`;
}

function renderEntryList() {
  const list = getFilteredEntries();
  const wrap = document.getElementById("entry-list");
  const countEl = document.getElementById("filter-count");

  if (entries.length === 0) {
    countEl.textContent = "";
    wrap.innerHTML = `<div class="list-empty">No entries yet — add Marley's first entry above. 🐾</div>`;
    return;
  }
  if (list.length === 0) {
    countEl.textContent = "";
    wrap.innerHTML = `<div class="list-empty">No entries match these filters.</div>`;
    return;
  }
  countEl.textContent = `${list.length} ${list.length === 1 ? "entry" : "entries"}`;

  let html = "";
  let lastDate = null;
  for (const e of list) {
    if (e.date !== lastDate) {
      const rel = daysBetween(e.date, todayStr());
      const relLabel = rel === 0 ? " — today" : rel === 1 ? " — yesterday" : "";
      html += `<div class="date-group-header">${fmtDate(e.date)}${relLabel}</div>`;
      lastDate = e.date;
    }
    html += entryItemHtml(e);
  }
  wrap.innerHTML = html;
}

document.getElementById("entry-list").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "edit") startEdit(btn.dataset.id);
  if (btn.dataset.action === "delete") deleteEntry(btn.dataset.id);
});

["filter-search", "filter-type", "filter-range"].forEach((id) =>
  document.getElementById(id).addEventListener("input", renderEntryList)
);

// ============ Dashboard ============

function avgSeverity(list) {
  const sevs = list.filter((e) => e.type === "symptom" && e.severity);
  if (!sevs.length) return null;
  return sevs.reduce((s, e) => s + e.severity, 0) / sevs.length;
}

function renderDashboard() {
  const empty = entries.length === 0;
  document.getElementById("dashboard-empty").hidden = !empty;
  document.getElementById("dashboard-content").hidden = empty;
  if (empty) return;

  const today = todayStr();

  // --- Stat: days since last Cytopoint ---
  const lastCyto = lastCytopoint();
  const cytoDays = lastCyto ? daysBetween(lastCyto.date, today) : null;
  let cytoNote = "no injections logged";
  if (lastCyto) {
    cytoNote = `last: ${fmtDate(lastCyto.date)}<br>next due ~${fmtDate(addDays(lastCyto.date, CYTOPOINT_INTERVAL_DAYS))}`;
  }

  // --- Stat: itch trend (7-day avg vs previous 7) ---
  const last7 = entries.filter((e) => e.date >= todayStr(-6));
  const prev7 = entries.filter((e) => e.date >= todayStr(-13) && e.date < todayStr(-6));
  const avgNow = avgSeverity(last7);
  const avgPrev = avgSeverity(prev7);
  let itchValue = avgNow != null ? `${avgNow.toFixed(1)}/5` : "—";
  let itchTrend = "";
  if (avgNow != null && avgPrev != null) {
    const diff = avgNow - avgPrev;
    if (diff > 0.3) itchTrend = `<span class="trend-up">▲ worse</span> vs prior week (${avgPrev.toFixed(1)})`;
    else if (diff < -0.3) itchTrend = `<span class="trend-down">▼ improving</span> vs prior week (${avgPrev.toFixed(1)})`;
    else itchTrend = `<span class="trend-flat">● steady</span> vs prior week (${avgPrev.toFixed(1)})`;
  } else if (avgNow != null) {
    itchTrend = `${last7.filter((e) => e.type === "symptom").length} symptom entries this week`;
  } else {
    itchTrend = "no itch entries this week 🎉";
  }

  // --- Stat: GI issues last 14 days ---
  const gi14 = entries.filter((e) => e.type === "gi" && e.date >= todayStr(-13));
  const giBad = gi14.filter((e) => e.stool && e.stool !== "normal").length;

  // --- Stat: entries this week ---
  const week = entries.filter((e) => e.date >= todayStr(-6)).length;

  document.getElementById("stat-grid").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">💉 Cytopoint</div>
      <div class="stat-value">${cytoDays != null ? cytoDays + "d" : "—"}</div>
      <div class="stat-note">${cytoDays != null ? "since last injection<br>" : ""}${cytoNote}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">🐾 Itch (7-day avg)</div>
      <div class="stat-value">${itchValue}</div>
      <div class="stat-note">${itchTrend}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">💩 GI issues</div>
      <div class="stat-value">${giBad}</div>
      <div class="stat-note">abnormal GI entries in last 14 days (${gi14.length} total)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">📝 This week</div>
      <div class="stat-value">${week}</div>
      <div class="stat-note">entries in the last 7 days</div>
    </div>`;

  // --- Itch strip: worst severity per day, last 14 days ---
  const strip = document.getElementById("itch-strip");
  let stripHtml = "";
  let anySev = false;
  for (let i = 13; i >= 0; i--) {
    const d = todayStr(-i);
    const daySevs = entries.filter((e) => e.type === "symptom" && e.date === d && e.severity).map((e) => e.severity);
    const worst = daySevs.length ? Math.max(...daySevs) : null;
    if (worst) anySev = true;
    const dayNum = parseDate(d).getDate();
    stripHtml += `<div class="itch-day">
      <div class="itch-cell ${worst ? "sev-" + worst : ""}" title="${fmtDate(d)}${worst ? ": worst itch " + worst + "/5" : ": no itch logged"}">${worst ?? ""}</div>
      ${dayNum}
    </div>`;
  }
  strip.innerHTML = stripHtml;
  document.getElementById("itch-strip-note").textContent = anySev
    ? "Worst itch severity logged each day (blank = none logged)."
    : "No itch symptoms logged in the last 14 days.";

  // --- Open vet questions ---
  const vetQs = sortEntries(entries.filter((e) => e.type === "vet"));
  const vetCard = document.getElementById("vet-questions-card");
  vetCard.hidden = vetQs.length === 0;
  document.getElementById("vet-questions-list").innerHTML = vetQs
    .slice(0, 6)
    .map((e) => `<li>${escapeHtml(e.details)}<span class="entry-meta"> · ${fmtDate(e.date)}</span></li>`)
    .join("");

  // --- Recent entries ---
  document.getElementById("recent-entries").innerHTML =
    sortEntries(entries).slice(0, 5).map((e) => entryItemHtml(e, false)).join("");

  renderBanners();
  renderCytoCycle();
  renderFoodCard();
}

// --- Reminder banners (Cytopoint every 6 weeks + food reorder) ---

function renderBanners() {
  const wrap = document.getElementById("banners");
  const items = [];

  const lastCyto = lastCytopoint();
  if (lastCyto) {
    const until = CYTOPOINT_INTERVAL_DAYS - daysBetween(lastCyto.date, todayStr());
    const due = addDays(lastCyto.date, CYTOPOINT_INTERVAL_DAYS);
    if (until < 0) items.push({ danger: true, text: `💉 Cytopoint overdue by ${-until} day${until === -1 ? "" : "s"} — was due ${fmtDate(due)} (every 6 weeks)` });
    else if (until === 0) items.push({ danger: true, text: `💉 Cytopoint due today (every 6 weeks)` });
    else if (until <= 7) items.push({ danger: false, text: `💉 Cytopoint due in ${until} day${until === 1 ? "" : "s"} (~${fmtDate(due)})` });
  }

  const left = foodDaysLeft();
  if (left != null) {
    if (left <= 0) items.push({ danger: true, text: `🍗 Prescription food bag should be empty — reorder now` });
    else if (left <= 7) items.push({ danger: false, text: `🍗 ~${left} day${left === 1 ? "" : "s"} of prescription food left — time to reorder` });
  }

  wrap.hidden = items.length === 0;
  wrap.innerHTML = items.map((i) => `<div class="banner${i.danger ? " banner-danger" : ""}">${i.text}</div>`).join("");
}

// --- Cytopoint cycle symptom tracker ---
// Shows average itch severity for each week since the last injection, so it's
// easy to spot itching creeping back toward the end of the 6-week cycle.

function renderCytoCycle() {
  const card = document.getElementById("cyto-cycle-card");
  const lastCyto = lastCytopoint();
  const symptoms = entries.filter((e) => e.type === "symptom" && e.severity);
  if (!lastCyto || !symptoms.length) {
    card.hidden = true;
    return;
  }
  card.hidden = false;

  const today = todayStr();
  const cytoDays = daysBetween(lastCyto.date, today);
  const weeks = Math.max(6, Math.ceil((cytoDays + 1) / 7));
  let html = "";
  let logged = 0;
  for (let w = 0; w < weeks; w++) {
    const start = addDays(lastCyto.date, w * 7);
    const end = addDays(lastCyto.date, w * 7 + 6);
    const inWeek = symptoms.filter((e) => e.date >= start && e.date <= end && e.date <= today);
    const avg = inWeek.length ? inWeek.reduce((s, e) => s + e.severity, 0) / inWeek.length : null;
    const level = avg ? Math.min(5, Math.max(1, Math.round(avg))) : null;
    if (avg) logged++;
    const future = start > today;
    const title = future
      ? `Week ${w + 1}: upcoming`
      : avg
        ? `Week ${w + 1} (${fmtDate(start)}–${fmtDate(end)}): avg itch ${avg.toFixed(1)}/5, ${inWeek.length} entr${inWeek.length === 1 ? "y" : "ies"}`
        : `Week ${w + 1} (${fmtDate(start)}–${fmtDate(end)}): no itch logged`;
    html += `<div class="itch-day">
      <div class="itch-cell ${level ? "sev-" + level : ""}" title="${title}" style="${future ? "opacity:0.35" : ""}">${avg ? avg.toFixed(1) : ""}</div>
      W${w + 1}
    </div>`;
  }
  document.getElementById("cyto-cycle-strip").innerHTML = html;
  document.getElementById("cyto-cycle-note").textContent = logged
    ? `Average itch severity per week since the ${fmtDate(lastCyto.date)} injection (day ${cytoDays + 1} of the 6-week cycle). Rising numbers late in the cycle suggest the shot is wearing off early.`
    : `No itch symptoms logged since the ${fmtDate(lastCyto.date)} injection. 🎉`;
}

// --- Prescription food tracker ---

let foodFormOpen = false;

function renderFoodCard() {
  const form = document.getElementById("food-form");
  const status = document.getElementById("food-status");
  const editBtn = document.getElementById("food-edit-btn");
  const showForm = foodFormOpen || !food;
  form.hidden = !showForm;
  editBtn.hidden = !food || showForm;
  if (showForm) {
    document.getElementById("food-opened").value = food ? food.openedDate : todayStr();
    document.getElementById("food-lasts").value = food ? food.lastsDays : "";
    document.getElementById("food-form-cancel").hidden = !food;
  }

  if (!food) {
    status.innerHTML = `<p class="muted small">Log when you open a bag and how long a bag usually lasts — a reorder reminder will show up here when it runs low.</p>`;
    return;
  }
  const left = foodDaysLeft();
  const outDate = addDays(food.openedDate, food.lastsDays);
  const cls = left <= 2 ? "food-danger" : left <= 7 ? "food-warn" : "";
  const pct = Math.max(0, Math.min(100, (left / food.lastsDays) * 100));
  status.innerHTML = `
    <div class="food-days ${cls}">${left <= 0 ? "Out of food — reorder!" : `~${left} day${left === 1 ? "" : "s"} of food left`}</div>
    <div class="food-bar"><div class="food-bar-fill ${cls}" style="width:${pct}%"></div></div>
    <p class="muted small">Bag opened ${fmtDate(food.openedDate)} · lasts ~${food.lastsDays} days · runs out ~${fmtDate(outDate)}</p>
    <button class="btn btn-small" id="food-newbag" type="button">🛍 Opened a new bag today</button>`;
}

document.getElementById("food-edit-btn").addEventListener("click", () => {
  foodFormOpen = true;
  renderFoodCard();
});

document.getElementById("food-form-cancel").addEventListener("click", () => {
  foodFormOpen = false;
  renderFoodCard();
});

document.getElementById("food-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const opened = document.getElementById("food-opened").value;
  const lasts = parseInt(document.getElementById("food-lasts").value, 10);
  if (!opened || !Number.isInteger(lasts) || lasts < 1 || lasts > 365) {
    showToast("Enter the opened date and how many days a bag lasts");
    return;
  }
  if (opened > todayStr()) {
    showToast("The opened date can't be in the future");
    return;
  }
  food = { openedDate: opened, lastsDays: lasts };
  foodFormOpen = false;
  saveState();
  renderDashboard();
  showToast("Food tracker updated ✓");
});

document.getElementById("food-status").addEventListener("click", (ev) => {
  if (ev.target.id !== "food-newbag" || !food) return;
  food = { ...food, openedDate: todayStr() };
  const now = new Date().toISOString();
  entries.push({ id: uid(), type: "note", date: todayStr(), time: null, details: "Opened a new bag of prescription food", createdAt: now, updatedAt: now });
  saveState();
  renderDashboard();
  renderEntryList();
  showToast("New bag logged 🛍");
});

document.getElementById("recent-see-all").addEventListener("click", () => switchView("log"));
document.getElementById("empty-add-btn").addEventListener("click", () => switchView("log"));
document.getElementById("empty-sample-btn").addEventListener("click", loadSampleData);

// ============ Vet summary ============

function mdEscapeLine(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function generateVetSummary(rangeDays) {
  const today = todayStr();
  const all = rangeDays === "all";
  const startDate = all
    ? (entries.length ? sortEntries(entries)[sortEntries(entries).length - 1].date : today)
    : todayStr(-Number(rangeDays) + 1);
  const period = sortEntries(entries.filter((e) => e.date >= startDate)).reverse(); // oldest first
  const spanDays = daysBetween(startDate, today) + 1;

  const byType = (t) => period.filter((e) => e.type === t);
  const lines = [];
  const dateLine = (e) => `${e.date}${e.time ? " " + fmtTime(e.time) : ""}`;

  lines.push(`# Vet Visit Summary — Marley`);
  lines.push(``);
  lines.push(`Adult poodle mix, ~15 lb · Prepared ${fmtDateLong(today)}`);
  lines.push(`Covers ${fmtDateLong(startDate)} – ${fmtDateLong(today)} (${spanDays} days, ${period.length} entries)`);
  lines.push(``);

  // --- Itch / allergy ---
  lines.push(`## Allergy / Itch Symptoms`);
  const sym = byType("symptom");
  if (!sym.length) {
    lines.push(`- No itch/allergy symptoms logged in this period.`);
  } else {
    const avg = avgSeverity(sym);
    lines.push(`- ${sym.length} symptom ${sym.length === 1 ? "entry" : "entries"}; average severity ${avg.toFixed(1)}/5.`);
    const worst = sym.reduce((a, b) => ((b.severity || 0) > (a.severity || 0) ? b : a));
    lines.push(`- Worst: ${worst.date} (severity ${worst.severity}/5) — ${mdEscapeLine(worst.details)}`);
    lines.push(``);
    sym.forEach((e) => lines.push(`- ${dateLine(e)} · severity ${e.severity ?? "?"}/5 — ${mdEscapeLine(e.details)}`));
  }
  lines.push(``);

  // --- GI ---
  lines.push(`## GI / Stool`);
  const gi = byType("gi");
  if (!gi.length) {
    lines.push(`- No GI entries logged in this period.`);
  } else {
    const counts = {};
    gi.forEach((e) => { const k = e.stool || "unspecified"; counts[k] = (counts[k] || 0) + 1; });
    const parts = Object.entries(counts).map(([k, n]) => `${STOOL_LABELS[k] || k}: ${n}`);
    lines.push(`- ${gi.length} GI ${gi.length === 1 ? "entry" : "entries"} — ${parts.join(", ")}.`);
    lines.push(``);
    gi.forEach((e) => lines.push(`- ${dateLine(e)} · ${STOOL_LABELS[e.stool] || "GI"} — ${mdEscapeLine(e.details)}`));
  }
  lines.push(``);

  // --- Medications ---
  lines.push(`## Medications & Treatments`);
  const meds = byType("medication");
  const groom = byType("grooming");
  if (!meds.length && !groom.length) {
    lines.push(`- No medications or topical treatments logged in this period.`);
  } else {
    meds.forEach((e) => lines.push(`- ${dateLine(e)} · 💊 ${mdEscapeLine(e.details)}`));
    groom.forEach((e) => lines.push(`- ${dateLine(e)} · 🛁 ${mdEscapeLine(e.details)}`));
  }
  lines.push(``);

  // --- Cytopoint (always report last known, even outside period) ---
  lines.push(`## Cytopoint`);
  const allCyto = sortEntries(entries.filter((e) => e.type === "cytopoint"));
  if (!allCyto.length) {
    lines.push(`- No Cytopoint injections logged.`);
  } else {
    const last = allCyto[0];
    const lastDays = daysBetween(last.date, today);
    const until = CYTOPOINT_INTERVAL_DAYS - lastDays;
    const due = addDays(last.date, CYTOPOINT_INTERVAL_DAYS);
    lines.push(`- Last injection: ${last.date} (${lastDays} days ago).`);
    lines.push(`- Interval: every 6 weeks → next due ~${due}${until < 0 ? ` (overdue by ${-until} days)` : until === 0 ? " (due today)" : ""}.`);
    if (allCyto.length > 1) {
      lines.push(`- Previous injections: ${allCyto.slice(1, 5).map((e) => e.date).join(", ")}${allCyto.length > 5 ? ", …" : ""}`);
    }
    // Itch by week of the current cycle — helps judge if the shot wears off early
    const cycleSym = entries.filter((e) => e.type === "symptom" && e.severity && e.date >= last.date && e.date <= today);
    if (cycleSym.length) {
      lines.push(`- Itch by week since this injection:`);
      const weeks = Math.ceil((lastDays + 1) / 7);
      for (let w = 0; w < weeks; w++) {
        const start = addDays(last.date, w * 7);
        const end = addDays(last.date, w * 7 + 6);
        const inWeek = cycleSym.filter((e) => e.date >= start && e.date <= end);
        const avg = inWeek.length ? (inWeek.reduce((s, e) => s + e.severity, 0) / inWeek.length).toFixed(1) : null;
        lines.push(`  - Week ${w + 1}: ${avg ? `avg itch ${avg}/5 (${inWeek.length} entr${inWeek.length === 1 ? "y" : "ies"})` : "no itch logged"}`);
      }
    }
  }
  lines.push(``);

  // --- VARL ---
  lines.push(`## VARL Immunotherapy`);
  const varl = byType("varl");
  if (!varl.length) {
    lines.push(`- No VARL check-ins logged in this period.`);
  } else {
    varl.forEach((e) => lines.push(`- ${dateLine(e)} — ${mdEscapeLine(e.details)}`));
  }
  lines.push(``);

  // --- Diet ---
  lines.push(`## Diet Notes`);
  const meals = byType("meal");
  const treats = byType("treat");
  if (!meals.length && !treats.length) {
    lines.push(`- No meals or treats logged in this period.`);
  } else {
    lines.push(`- ${meals.length} meal and ${treats.length} treat entries logged.`);
    const distinct = [...new Set(meals.concat(treats).map((e) => mdEscapeLine(e.details)))];
    distinct.slice(0, 15).forEach((d) => lines.push(`  - ${d}`));
    if (distinct.length > 15) lines.push(`  - …and ${distinct.length - 15} more`);
  }
  if (food) {
    const left = foodDaysLeft();
    lines.push(`- Prescription food: current bag opened ${food.openedDate}, ~${Math.max(0, left)} days left.`);
  }
  lines.push(``);

  // --- Triggers ---
  lines.push(`## Suspected Triggers`);
  const trig = byType("trigger");
  if (!trig.length) {
    lines.push(`- No suspected triggers noted in this period.`);
  } else {
    trig.forEach((e) => lines.push(`- ${dateLine(e)} — ${mdEscapeLine(e.details)}`));
  }
  lines.push(``);

  // --- Vet questions (all open, not just period) ---
  lines.push(`## Questions for the Vet`);
  const vetQs = sortEntries(entries.filter((e) => e.type === "vet")).reverse();
  if (!vetQs.length) {
    lines.push(`- (none logged)`);
  } else {
    vetQs.forEach((e) => lines.push(`- [ ] ${mdEscapeLine(e.details)} _(noted ${e.date})_`));
  }
  lines.push(``);

  // --- Other notes ---
  const notes = byType("note");
  if (notes.length) {
    lines.push(`## Other Notes`);
    notes.forEach((e) => lines.push(`- ${dateLine(e)} — ${mdEscapeLine(e.details)}`));
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`_Generated by Marley Care Log. Owner-recorded observations — not medical advice._`);
  return lines.join("\n");
}

function renderVetSummary() {
  const range = document.getElementById("vet-range").value;
  const preview = document.getElementById("vet-preview");
  if (entries.length === 0) {
    preview.textContent = "No entries yet — log some of Marley's care first, then generate a summary here.";
    return;
  }
  preview.textContent = generateVetSummary(range);
}

document.getElementById("vet-range").addEventListener("change", renderVetSummary);

document.getElementById("vet-copy").addEventListener("click", async () => {
  const text = document.getElementById("vet-preview").textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Summary copied to clipboard ✓");
  } catch {
    // Fallback for non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    showToast(ok ? "Summary copied to clipboard ✓" : "Copy failed — select the text manually");
  }
});

document.getElementById("vet-download").addEventListener("click", () => {
  const text = document.getElementById("vet-preview").textContent;
  downloadFile(`marley-vet-summary-${todayStr()}.md`, text, "text/markdown");
  showToast("Summary downloaded ✓");
});

// ============ Export / import / data ============

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderDataInfo() {
  const info = document.getElementById("data-info");
  if (!entries.length) {
    info.textContent = "No entries stored yet.";
    return;
  }
  const sorted = sortEntries(entries);
  info.textContent = `${entries.length} entries stored · earliest ${fmtDate(sorted[sorted.length - 1].date)} · latest ${fmtDate(sorted[0].date)}`;
}

document.getElementById("export-json").addEventListener("click", () => {
  const payload = { app: APP_NAME, version: DATA_VERSION, exportedAt: new Date().toISOString(), entries: sortEntries(entries), food };
  downloadFile(`marley-care-log-${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
  showToast("JSON backup downloaded ✓");
});

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

document.getElementById("export-csv").addEventListener("click", () => {
  const header = ["date", "time", "type", "details", "itch_severity", "gi_observation", "id", "created_at", "updated_at"];
  const rows = sortEntries(entries).reverse().map((e) =>
    [e.date, e.time || "", TYPES[e.type]?.label || e.type, e.details || "",
     e.severity ?? "", e.stool ? (STOOL_LABELS[e.stool] || e.stool) : "",
     e.id, e.createdAt || "", e.updatedAt || ""].map(csvCell).join(",")
  );
  downloadFile(`marley-care-log-${todayStr()}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
  showToast("CSV downloaded ✓");
});

function sanitizeImportedEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  if (typeof raw.type !== "string" || !TYPES[raw.type]) return null;
  const e = {
    id: typeof raw.id === "string" && raw.id ? raw.id : uid(),
    type: raw.type,
    date: raw.date,
    time: typeof raw.time === "string" && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : null,
    details: typeof raw.details === "string" ? raw.details.slice(0, 2000) : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
  if (raw.type === "symptom" && Number.isInteger(raw.severity) && raw.severity >= 1 && raw.severity <= 5) e.severity = raw.severity;
  if (raw.type === "gi" && typeof raw.stool === "string" && STOOL_LABELS[raw.stool]) e.stool = raw.stool;
  return e;
}

document.getElementById("import-file").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = ""; // allow re-selecting the same file
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    showToast("⚠️ That file isn't valid JSON");
    return;
  }
  const rawEntries = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(rawEntries)) {
    showToast("⚠️ No entries found in that file");
    return;
  }
  const imported = rawEntries.map(sanitizeImportedEntry).filter(Boolean);
  const skipped = rawEntries.length - imported.length;
  if (!imported.length) {
    showToast("⚠️ No valid entries found in that file");
    return;
  }

  let mode = "merge";
  if (entries.length > 0) {
    mode = await askDialog(
      `Import ${imported.length} entries${skipped ? ` (${skipped} skipped as invalid)` : ""}?\n\nMerge adds them to your ${entries.length} current entries (duplicates by ID are skipped). Replace deletes current entries first.`,
      [
        { label: "Cancel", value: null },
        { label: "Replace", value: "replace", kind: "danger" },
        { label: "Merge", value: "merge", kind: "primary" },
      ]
    );
    if (!mode) return;
  }

  const importedFood = sanitizeFood(data.food);
  if (mode === "replace") {
    entries = imported;
    food = importedFood;
    showToast(`Replaced with ${imported.length} imported entries ✓`);
  } else {
    const existing = new Set(entries.map((e) => e.id));
    const fresh = imported.filter((e) => !existing.has(e.id));
    entries = entries.concat(fresh);
    if (!food && importedFood) food = importedFood;
    showToast(`Imported ${fresh.length} new entries ✓${imported.length - fresh.length ? ` (${imported.length - fresh.length} duplicates skipped)` : ""}`);
  }
  saveState();
  renderDataInfo();
  renderDashboard();
  renderEntryList();
});

document.getElementById("clear-btn").addEventListener("click", async () => {
  if (!entries.length) { showToast("Nothing to delete"); return; }
  const ok = await confirmDialog(
    `Delete all ${entries.length} entries and reset the food tracker? This can't be undone.\n\nTip: export a JSON backup first.`,
    "Delete everything", true
  );
  if (!ok) return;
  entries = [];
  food = null;
  foodFormOpen = false;
  saveState();
  resetForm();
  renderDataInfo();
  renderDashboard();
  renderEntryList();
  showToast("All entries deleted");
});

// ============ Sample data ============

async function loadSampleData() {
  if (entries.length > 0) {
    const ok = await confirmDialog("Add ~6 weeks of sample entries? They'll be mixed in with your existing entries.", "Add sample data");
    if (!ok) return;
  }
  const now = new Date().toISOString();
  const S = [];
  const add = (daysAgo, type, details, extra = {}) =>
    S.push({ id: uid() + "-s" + S.length, type, date: todayStr(-daysAgo), time: extra.time || null, details, severity: extra.severity, stool: extra.stool, createdAt: now, updatedAt: now });

  // Treatments anchoring the timeline
  add(42, "cytopoint", "Cytopoint injection at Dr. Patel's — 20 mg");
  add(40, "varl", "VARL drops restarted after refill, back to maintenance dose", { time: "08:00" });
  add(33, "varl", "VARL drops — no mouth rubbing afterward this week");
  add(19, "varl", "VARL drops — slight lip licking after dose, watched for 30 min, fine");
  add(5, "varl", "VARL drops — routine, no reaction");
  add(28, "grooming", "Bath with chlorhexidine shampoo, 10 min contact time");
  add(9, "grooming", "Bath + paw soak after muddy park weekend");
  add(24, "medication", "Apoquel 5.4 mg (half tab) with dinner — flare-up rescue", { time: "18:30" });
  add(23, "medication", "Apoquel 5.4 mg with breakfast", { time: "08:00" });

  // Meals & treats
  add(1, "meal", "1/2 cup hydrolyzed protein kibble, ate it all", { time: "08:00" });
  add(1, "meal", "1/2 cup hydrolyzed protein kibble + fish oil pump", { time: "18:00" });
  add(3, "meal", "1/2 cup hydrolyzed protein kibble, left a little", { time: "08:15" });
  add(8, "meal", "New bag of prescription food opened (lot #4471)");
  add(2, "treat", "2 freeze-dried rabbit treats after nail trim");
  add(12, "treat", "Neighbor gave her a chicken biscuit before I could stop it 😬", { time: "16:00" });
  add(26, "treat", "3 hydrolyzed training treats on walk");

  // Symptoms — improving trend after flare
  add(27, "symptom", "Scratching ears and shaking head on and off all evening", { severity: 4, time: "20:00" });
  add(25, "symptom", "Chewing front paws after park, paws pink between pads", { severity: 4 });
  add(22, "symptom", "Still itchy but less frantic, mostly ears", { severity: 3 });
  add(17, "symptom", "Occasional paw licking at night", { severity: 2, time: "22:00" });
  add(11, "symptom", "Itchy after chicken biscuit incident — chewing paws again", { severity: 3 });
  add(10, "symptom", "Paw chewing settled down, just a bit of licking", { severity: 2 });
  add(4, "symptom", "Brief scratching after grass play, stopped on its own", { severity: 1 });

  // GI
  add(30, "gi", "Normal stool on morning walk", { stool: "normal" });
  add(12, "gi", "Soft stool in evening, after the chicken biscuit", { stool: "soft", time: "19:00" });
  add(11, "gi", "Soft again in the morning, normal by evening", { stool: "soft" });
  add(6, "gi", "Back to normal, well formed", { stool: "normal" });

  // Triggers, questions, notes
  add(12, "trigger", "Chicken — soft stool and itching within a day of the biscuit");
  add(25, "trigger", "Freshly mowed grass at the park? Flare started the day after");
  add(14, "vet", "Should we adjust the VARL dose if itching returns before the next vial?");
  add(3, "vet", "Is Apoquel OK as an occasional rescue alongside Cytopoint + VARL?");
  add(35, "note", "Ordered next bag of prescription food — ~3 weeks left in current bag");
  add(2, "note", "Sleeping through the night again, more playful this week");

  entries = entries.concat(S);
  if (!food) food = { openedDate: todayStr(-8), lastsDays: 28 };
  saveState();
  renderDashboard();
  renderEntryList();
  renderDataInfo();
  switchView("dashboard");
  showToast(`Added ${S.length} sample entries ✓`);
}

document.getElementById("sample-btn").addEventListener("click", loadSampleData);

// ============ Init ============

buildTypeChips();
buildSeverityPicker();
buildFilterTypeOptions();
resetForm();
renderDashboard();
renderEntryList();
renderDataInfo();
renderVetSummary();

// PWA: offline caching only works over http(s); the app still runs fine from file://
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker registration failed", e));
  });
}
