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

/* ---------------------------------------------------------
   CONTACT HELPERS — WhatsApp / Email action buttons
   --------------------------------------------------------- */
function isValid(v) {
  return v && String(v).trim() !== "" && v !== "Not public";
}

function bestWhatsAppNumber(c) {
  for (const field of [c.WhatsApp, c.Mobile, c.Phone]) {
    if (!isValid(field)) continue;
    for (const part of String(field).split(/[,/|]/)) {
      const digits = part.replace(/\D/g, "");
      if (digits.length === 10 && /^[6-9]/.test(digits)) return "91" + digits;
      if (digits.length === 12 && digits.startsWith("91") && /^91[6-9]/.test(digits)) return digits;
    }
  }
  return null;
}

function formatWaDigits(raw) {
  if (!raw) return "";
  for (const part of String(raw).split(/[,/|]/)) {
    const digits = part.replace(/\D/g, "");
    if (digits.length === 10 && /^[6-9]/.test(digits)) return "91" + digits;
    if (digits.length === 12 && digits.startsWith("91") && /^91[6-9]/.test(digits)) return digits;
  }
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) digits = "91" + digits.slice(1);
  return digits;
}

const PROPERTY_SHORT =
  "23.5 cent prime corner commercial land at Alagarkovil, Madurai (Alagarkovil Road & Natham-Alanganallur High Road, ~16km from Madurai city)";

function buildWhatsAppMessage(c) {
  return (
    `Hello${isValid(c.ContactPerson) ? " " + c.ContactPerson : ""}, I have a ${PROPERTY_SHORT}. ` +
    `Suitable for ${c.Category || "commercial use"}. Would this interest ${c.Company}? ` +
    `Happy to share full details and photos. - Suresh, 9884198930`
  );
}

function buildEmailSubjectBody(c) {
  const subject = "Commercial Land Opportunity - Alagarkovil, Madurai";
  const body =
    `Dear ${isValid(c.ContactPerson) ? c.ContactPerson : "Sir/Madam"},\n\n` +
    `I am writing regarding a ${PROPERTY_SHORT}, suitable for ${c.Category || "commercial use"}. ` +
    `I believe this could be of interest to ${c.Company}.\n\n` +
    `I would be glad to share more details, photographs, and arrange a site visit.\n\n` +
    `Best regards,\nSuresh\n9884198930`;
  return { subject, body };
}

function openWhatsApp(id) {
  const c = allCompanies.find((x) => x.id === id);
  if (!c) return;
  const number = bestWhatsAppNumber(c);
  if (!number) return;
  const digits = formatWaDigits(number);
  const text = encodeURIComponent(buildWhatsAppMessage(c));
  window.open(`https://wa.me/${digits}?text=${text}`, "_blank");
}

function openEmail(id) {
  const c = allCompanies.find((x) => x.id === id);
  if (!c || !isValid(c.Email)) return;
  const { subject, body } = buildEmailSubjectBody(c);
  window.location.href = `mailto:${encodeURIComponent(c.Email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ---------------------------------------------------------
   RENDER — card-based list (works reliably on mobile, no
   fragile CSS table-to-card conversion needed)
   --------------------------------------------------------- */
function fieldLine(icon, label, value, isLink) {
  if (!isValid(value)) return "";
  const shown = isLink
    ? `<a href="${escapeAttr(value)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `<div class="bf-field"><span class="bf-field-label">${icon} ${label}:</span> ${shown}</div>`;
}

function renderTable() {
  const container = document.getElementById("dbBody");
  if (!container) return;
  const rows = filteredCompanies().slice().reverse();

  if (rows.length === 0) {
    container.innerHTML = `<div class="bf-empty">No leads match this filter yet.</div>`;
    return;
  }

  container.innerHTML = rows
    .map((c) => {
      const addressParts = [c.Address, c.City, c.State, c.PIN].filter(isValid);
      const addressStr = addressParts.join(", ");
      const socials = ["Facebook", "LinkedIn", "Instagram", "X", "YouTube"]
        .filter((k) => isValid(c[k]))
        .map((k) => `<a href="${escapeAttr(c[k])}" target="_blank" rel="noopener" class="bf-social">${k}</a>`)
        .join(" ");

      const waNumber = bestWhatsAppNumber(c);
      const hasEmail = isValid(c.Email);

      let emailStatusLine = "";
      if (c.EmailSent === true && isValid(c.EmailSentDate)) {
        const sentDate = new Date(c.EmailSentDate);
        const sentDateStr = isNaN(sentDate.getTime())
          ? c.EmailSentDate
          : sentDate.toLocaleDateString();
        emailStatusLine = `<div class="bf-email-status bf-email-sent">📧 Emailed: ${escapeHtml(sentDateStr)}</div>`;
      } else if (c.EmailStatus === "Failed" && isValid(c.LastError)) {
        emailStatusLine = `<div class="bf-email-status bf-email-failed">⚠️ Email failed: ${escapeHtml(c.LastError)}</div>`;
      }

      return `
      <div class="bf-lead-card">
        <div class="bf-lead-head">
          <div>
            <div class="bf-company">${escapeHtml(c.Company)}</div>
            <div class="bf-cat">${escapeHtml(c.Category || "")}</div>
          </div>
          <select class="bf-status-select" onchange="updateStatus('${c.id}', this.value)">
            ${["New", "Contacted", "Interested", "Not Interested", "Closed"]
              .map((s) => `<option value="${s}" ${c.Status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </div>

        <div class="bf-fields">
          ${fieldLine("🌐", "Website", c.Website, true)}
          ${fieldLine("✉️", "Email", c.Email, false)}
          ${fieldLine("📞", "Phone", c.Phone, false)}
          ${fieldLine("📱", "Mobile", c.Mobile, false)}
          ${fieldLine("💬", "WhatsApp", c.WhatsApp, false)}
          ${fieldLine("👤", "Contact", c.ContactPerson, false)}
          ${addressStr ? `<div class="bf-field"><span class="bf-field-label">📍 Address:</span> ${escapeHtml(addressStr)}</div>` : ""}
          ${fieldLine("🗺️", "Map", c.GoogleMaps, true)}
          ${c.Notes ? `<div class="bf-notes">📝 ${escapeHtml(c.Notes)}</div>` : ""}
          ${socials ? `<div class="bf-socials">${socials}</div>` : ""}
        </div>

        ${emailStatusLine}

        <div class="bf-actions">
          ${waNumber ? `<button class="bf-btn-wa" onclick="openWhatsApp('${c.id}')">💬 WhatsApp</button>` : ""}
          ${hasEmail ? `<button class="bf-btn-email" onclick="openEmail('${c.id}')">✉️ Email</button>` : ""}
          ${!waNumber && !hasEmail ? `<span class="bf-no-contact">No contact info yet</span>` : ""}
        </div>

        <div class="bf-date">Added: ${escapeHtml(c.DateAdded || "")}</div>
      </div>`;
    })
    .join("");
}

function exportCSV() {
  const rows = filteredCompanies();
  const headers = [
    "Company", "Category", "Website", "Email", "Phone", "Mobile", "WhatsApp",
    "ContactPerson", "Address", "City", "State", "PIN", "GoogleMaps",
    "Facebook", "LinkedIn", "Instagram", "X", "YouTube", "ContactPage",
    "Status", "Notes", "DateAdded", "SourceURL"
  ];
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
