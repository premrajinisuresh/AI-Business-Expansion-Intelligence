/* ============================================================
   buyerfinder5.js — dashboard for the AUTOMATED database
   This page does NOT run any searches itself. It only reads
   buyerdatabase5.json (which the GitHub Action updates on a
   schedule) and lets you review, filter, mark status, and export.
   Status/notes you set here are stored locally in your browser
   (localStorage) as an overlay on top of the auto-collected data,
   since this is a static page with no server to write back to.
   ============================================================ */

const DB_FILE = "buyerdatabase5.json";
const OVERLAY_KEY = "buyerFinder5_statusOverlay";

let allCompanies = [];
let meta = {};

function loadOverlay() {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveOverlay(overlay) {
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
}

function applyOverlay(companies) {
  const overlay = loadOverlay();
  return companies.map((c) => ({
    ...c,
    Status: overlay[c.id]?.Status || c.Status || "New",
    Notes: overlay[c.id]?.Notes ?? c.Notes ?? ""
  }));
}

function updateStatus(id, status) {
  const overlay = loadOverlay();
  overlay[id] = overlay[id] || {};
  overlay[id].Status = status;
  saveOverlay(overlay);
  const c = allCompanies.find((x) => x.id === id);
  if (c) c.Status = status;
  renderStats();
}

async function loadDatabase() {
  try {
    const res = await fetch(DB_FILE + "?t=" + Date.now());
    const data = await res.json();
    meta = data.meta || {};
    allCompanies = applyOverlay(data.companies || []);
  } catch (e) {
    console.error("Could not load database:", e);
    meta = {};
    allCompanies = [];
  }
  renderMeta();
  populateCategoryFilter();
  renderTable();
  renderStats();
}

function renderMeta() {
  const el = document.getElementById("metaInfo");
  if (!el) return;
  if (!meta.lastRun) {
    el.textContent = "No automated run yet. Once the GitHub Action runs (on schedule or manually), leads will appear here.";
    return;
  }
  const last = new Date(meta.lastRun);
  el.textContent =
    `Last automated run: ${last.toLocaleString()} · ` +
    `Added ${meta.lastRunAdded ?? 0} new lead(s) that run · ` +
    `${meta.totalCompanies ?? allCompanies.length} total in database`;
}

function populateCategoryFilter() {
  const sel = document.getElementById("categoryFilter");
  if (!sel) return;
  const cats = Array.from(new Set(allCompanies.map((c) => c.Category).filter(Boolean))).sort();
  sel.innerHTML =
    `<option value="">All Categories</option>` +
    cats.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
}

function currentFilters() {
  return {
    category: document.getElementById("categoryFilter")?.value || "",
    status: document.getElementById("statusFilter")?.value || "",
    search: (document.getElementById("searchBox")?.value || "").toLowerCase().trim()
  };
}

function filteredCompanies() {
  const f = currentFilters();
  return allCompanies.filter((c) => {
    if (f.category && c.Category !== f.category) return false;
    if (f.status && c.Status !== f.status) return false;
    if (f.search) {
      const hay = `${c.Company} ${c.Category} ${c.Notes}`.toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    return true;
  });
}

function renderStats() {
  const list = allCompanies;
  setText("statTotal", list.length);
  setText("statNew", list.filter((c) => c.Status === "New").length);
  setText("statContacted", list.filter((c) => c.Status === "Contacted").length);
  setText("statInterested", list.filter((c) => c.Status === "Interested").length);
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderTable() {
  const tbody = document.getElementById("dbBody");
  if (!tbody) return;
  const rows = filteredCompanies().slice().reverse();

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="bf-empty">No leads match this filter yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (c) => `
    <tr>
      <td>
        <div class="bf-company">${escapeHtml(c.Company)}</div>
        <div class="bf-cat">${escapeHtml(c.Category || "")}</div>
        ${c.Notes ? `<div class="bf-notes">${escapeHtml(c.Notes)}</div>` : ""}
      </td>
      <td>${c.Website && c.Website !== "Not public" ? `<a href="${escapeAttr(c.Website)}" target="_blank" rel="noopener">${escapeHtml(c.Website)}</a>` : "Not public"}</td>
      <td>${escapeHtml(c.Email || "Not public")}</td>
      <td>${escapeHtml(c.Phone || "Not public")}</td>
      <td>${escapeHtml(c.ContactPerson || "Not public")}</td>
      <td>
        <select onchange="updateStatus('${c.id}', this.value)">
          ${["New", "Contacted", "Interested", "Not Interested", "Closed"]
            .map((s) => `<option value="${s}" ${c.Status === s ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
      </td>
      <td class="bf-date">${escapeHtml(c.DateAdded || "")}</td>
    </tr>`
    )
    .join("");
}

function exportCSV() {
  const rows = filteredCompanies();
  const headers = ["Company", "Category", "Website", "Email", "Phone", "ContactPerson", "Status", "Notes", "DateAdded", "SourceURL"];
  const csvRows = [headers.join(",")];
  rows.forEach((c) => {
    const row = headers.map((h) => `"${String(c[h] ?? "").replace(/"/g, '""')}"`);
    csvRows.push(row.join(","));
  });
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `buyer-database-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  document.getElementById("categoryFilter")?.addEventListener("change", renderTable);
  document.getElementById("statusFilter")?.addEventListener("change", renderTable);
  document.getElementById("searchBox")?.addEventListener("input", renderTable);
  document.getElementById("refreshBtn")?.addEventListener("click", loadDatabase);
  document.getElementById("exportBtn")?.addEventListener("click", exportCSV);
});
