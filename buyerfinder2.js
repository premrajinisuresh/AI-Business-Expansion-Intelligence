/* ============================================================
   AI BUYER FINDER — buyerfinder.js
   Acts like an AI Business Development Executive.
   Mission: find real organizations that may genuinely buy
   the property, then help contact them.
   Uses localStorage for persistence (works on GitHub Pages /
   Cloudflare Pages with no backend/server required).
   ============================================================ */

/* ---------------------------------------------------------
   1. PROPERTY DATA (used inside every generated search & draft)
   --------------------------------------------------------- */
const PROPERTY = {
  location: "Alagarkovil Junction, Madurai, Tamil Nadu",
  size: "23.5 Cents",
  type: "Prime Corner Commercial Land",
  roads: ["Alagarkovil Road", "Natham–Alanganallur High Road"],
  advantages: [
    "Corner plot on a busy junction",
    "Four lane highway frontage",
    "Around 30 minutes to Madurai City",
    "Bus stop directly in front of the property",
    "Located on a tourism corridor",
    "Located on an education corridor",
    "Cooler climate area",
    "Near Alagar Kovil Temple",
    "Near Alanganallur (World Famous Jallikattu)",
    "Near the upcoming Vishaal Tourism Project",
    "Near TNPL Cricket Ground, Natham",
    "Surrounded by Engineering, Arts, Catering and Aviation colleges and schools"
  ],
  budgetRange: "₹5–10 Crore or more",
  dealType: "Outright Sale only (no JV / lease / revenue-share)"
};

/* ---------------------------------------------------------
   2. CATEGORIES + INTELLIGENT SEARCH QUERY TEMPLATES
   Each template is written the way a real BD executive would
   search Google to find genuine buyers, not brokers.
   --------------------------------------------------------- */
const CATEGORIES = {
  hotels: {
    label: "🏨 Hotels",
    queries: [
      "budget hotel chains expanding in Madurai Tamil Nadu 2026",
      "hotel group looking for land near Alagarkovil Madurai",
      "highway hotel investment opportunity Madurai Tamil Nadu",
      "OYO Treebo FabHotels expansion Madurai highway property",
      "new hotel project Natham Alanganallur road Madurai"
    ]
  },
  resorts: {
    label: "🌴 Resorts",
    queries: [
      "resort development land near Alagar Kovil temple Madurai",
      "weekend resort investment near Madurai cooler climate land",
      "tourism resort project Alanganallur Jallikattu corridor",
      "resort chain expansion Tamil Nadu temple tourism circuit",
      "Vishaal Tourism Project Madurai nearby land investors"
    ]
  },
  hospitals: {
    label: "🏥 Hospitals",
    queries: [
      "hospital chain looking for land Madurai highway junction",
      "nursing home new branch land Madurai Natham road",
      "multi speciality hospital expansion Madurai outskirts 2026",
      "healthcare group land acquisition Madurai Tamil Nadu"
    ]
  },
  education: {
    label: "🎓 Education",
    queries: [
      "educational trust land purchase Madurai highway corner plot",
      "engineering college new campus land Madurai Natham road",
      "school trust expansion land near Alagarkovil Madurai",
      "aviation catering college new campus Madurai Tamil Nadu",
      "arts and science college land requirement Madurai 2026"
    ]
  },
  restaurants: {
    label: "🍽 Restaurants",
    queries: [
      "restaurant chain highway outlet land Madurai Tamil Nadu",
      "food court investment corner plot Madurai highway junction",
      "A2B Saravana Bhavan Sangeetha new outlet Madurai highway",
      "drive-in restaurant land requirement Madurai bypass road"
    ]
  },
  investors: {
    label: "🌍 Investors",
    queries: [
      "NRI investor buying commercial land Madurai Tamil Nadu",
      "HNI investor commercial land Madurai highway corner plot",
      "real estate investment group Madurai Alagarkovil corridor",
      "convention centre marriage hall land Madurai highway",
      "shopping mall land requirement Madurai outskirts 2026"
    ]
  }
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

/* ---------------------------------------------------------
   3. STORAGE HELPERS (localStorage, no backend needed)
   --------------------------------------------------------- */
const STORAGE_KEY = "buyerFinder_companies_v2";
const PROGRESS_KEY = "buyerFinder_progress_v2";

function loadSavedCompanies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Could not read saved companies:", e);
    return [];
  }
}

function persistCompanies(companies) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* Merge the static buyerdata.json (seed file) with whatever
   has been saved locally in the browser so far. */
async function initBuyerData() {
  let seed = { companies: [] };
  try {
    const res = await fetch("buyerdata2.json");
    seed = await res.json();
  } catch (e) {
    console.warn("buyerdata.json not reachable, starting empty.", e);
  }
  const local = loadSavedCompanies();
  if (local.length === 0 && seed.companies && seed.companies.length > 0) {
    persistCompanies(seed.companies);
    return seed.companies;
  }
  return local;
}

/* ---------------------------------------------------------
   4. SEARCH GENERATION + TAB OPENING
   --------------------------------------------------------- */
function generateSearchQueries(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return [];
  return cat.queries;
}

function openSearchTabs(queries) {
  queries.forEach((q, i) => {
    const url = "https://www.google.com/search?q=" + encodeURIComponent(q);
    // small stagger so the browser / popup blocker doesn't choke
    setTimeout(() => window.open(url, "_blank"), i * 250);
  });
}

function searchCategory(categoryKey) {
  const queries = generateSearchQueries(categoryKey);
  openSearchTabs(queries);
  logActivity(`Searched category: ${CATEGORIES[categoryKey].label}`);
}

function searchAllCategories() {
  let delay = 0;
  CATEGORY_KEYS.forEach((key) => {
    setTimeout(() => searchCategory(key), delay);
    delay += 1500; // stagger categories so tabs don't all fire at once
  });
  logActivity("Ran a full search across all categories");
}

/* ---------------------------------------------------------
   5. SAVE / MANAGE COMPANIES
   --------------------------------------------------------- */
function saveCompany(companyData) {
  const companies = loadSavedCompanies();
  const record = {
    id: "c_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    Company: companyData.company || "",
    Category: companyData.category || "",
    Website: companyData.website || "",
    Email: companyData.email || "",
    Phone: companyData.phone || "",
    ContactPerson: companyData.contactPerson || "",
    Status: companyData.status || "New",
    Notes: companyData.notes || "",
    DateAdded: todayStr()
  };
  companies.push(record);
  persistCompanies(companies);
  logActivity(`Saved company: ${record.Company || "(unnamed)"}`);
  return record;
}

function updateCompanyStatus(id, newStatus) {
  const companies = loadSavedCompanies();
  const idx = companies.findIndex((c) => c.id === id);
  if (idx !== -1) {
    companies[idx].Status = newStatus;
    persistCompanies(companies);
    logActivity(`Marked ${companies[idx].Company} as ${newStatus}`);
  }
  return companies;
}

function deleteCompany(id) {
  let companies = loadSavedCompanies();
  companies = companies.filter((c) => c.id !== id);
  persistCompanies(companies);
  return companies;
}

/* ---------------------------------------------------------
   6. PROGRESS TRACKING (today's activity)
   --------------------------------------------------------- */
function logActivity(text) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const log = raw ? JSON.parse(raw) : {};
    const day = todayStr();
    if (!log[day]) log[day] = [];
    log[day].push({ time: new Date().toLocaleTimeString(), text });
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(log));
  } catch (e) {
    console.error("Could not log activity:", e);
  }
}

function getProgressStats() {
  const companies = loadSavedCompanies();
  const total = companies.length;
  const saved = total; // every record in storage counts as "saved"
  const contacted = companies.filter(
    (c) => c.Status === "Contacted" || c.Status === "Interested"
  ).length;
  const interested = companies.filter((c) => c.Status === "Interested").length;
  return { found: total, saved, contacted, interested };
}

/* ---------------------------------------------------------
   7. EMAIL / WHATSAPP DRAFT GENERATION
   --------------------------------------------------------- */
function buildPropertyPitchText() {
  return (
    `Prime ${PROPERTY.size} corner commercial land at ${PROPERTY.location}, ` +
    `facing ${PROPERTY.roads.join(" and ")}. ` +
    PROPERTY.advantages.slice(0, 6).join(", ") + ". " +
    `Suitable for hotels, resorts, hospitals, educational institutions, ` +
    `restaurants or large-scale commercial development. ` +
    `Budget range considered: ${PROPERTY.budgetRange}. ${PROPERTY.dealType}.`
  );
}

function generateEmailDraft(company) {
  const subject = `Commercial Land Opportunity — ${PROPERTY.location} (${PROPERTY.size})`;
  const body =
    `Dear ${company.ContactPerson || "Sir/Madam"},\n\n` +
    `I am writing to bring to your attention a prime commercial land opportunity ` +
    `that may be of interest to ${company.Company || "your organization"}.\n\n` +
    buildPropertyPitchText() +
    `\n\nKey highlights:\n` +
    PROPERTY.advantages.map((a) => "• " + a).join("\n") +
    `\n\nI would be glad to share more details, photographs, and location maps, ` +
    `and to arrange a site visit at your convenience.\n\n` +
    `Looking forward to your response.\n\nBest regards,`;

  const mailto =
    `mailto:${encodeURIComponent(company.Email || "")}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(mailto, "_blank");
  logActivity(`Drafted email for ${company.Company || "(unnamed)"}`);
  return { subject, body };
}

function generateWhatsAppDraft(company) {
  const text =
    `Hello${company.ContactPerson ? " " + company.ContactPerson : ""}, ` +
    `I have a ${PROPERTY.size} prime corner commercial land at ${PROPERTY.location} ` +
    `facing ${PROPERTY.roads.join(" & ")}. ` +
    `Ideal for hotels/resorts/hospitals/education/commercial use. ` +
    `Would this be of interest to ${company.Company || "your organization"}? ` +
    `Happy to share full details and photos.`;

  const phone = (company.Phone || "").replace(/[^0-9]/g, "");
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  window.open(url, "_blank");
  logActivity(`Drafted WhatsApp message for ${company.Company || "(unnamed)"}`);
  return text;
}

/* ---------------------------------------------------------
   8. RENDERING (talks to buyerfinder.html elements)
   --------------------------------------------------------- */
function renderProgress() {
  const stats = getProgressStats();
  const map = {
    statFound: stats.found,
    statSaved: stats.saved,
    statContacted: stats.contacted,
    statInterested: stats.interested
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

function renderCompanyList() {
  const listEl = document.getElementById("companyList");
  if (!listEl) return;
  const companies = loadSavedCompanies();

  if (companies.length === 0) {
    listEl.innerHTML = `<p class="bf-empty">No companies saved yet. Run a search, find a real organization, then use "Add Company" to save it here.</p>`;
    return;
  }

  listEl.innerHTML = companies
    .slice()
    .reverse()
    .map((c) => `
      <div class="bf-card" data-id="${c.id}">
        <div class="bf-card-head">
          <strong>${escapeHtml(c.Company || "(unnamed)")}</strong>
          <span class="bf-badge">${escapeHtml(c.Category || "")}</span>
        </div>
        <div class="bf-card-body">
          ${c.Website ? `<div>🌐 <a href="${escapeAttr(c.Website)}" target="_blank" rel="noopener">${escapeHtml(c.Website)}</a></div>` : ""}
          ${c.ContactPerson ? `<div>👤 ${escapeHtml(c.ContactPerson)}</div>` : ""}
          ${c.Email ? `<div>✉️ ${escapeHtml(c.Email)}</div>` : ""}
          ${c.Phone ? `<div>📞 ${escapeHtml(c.Phone)}</div>` : ""}
          ${c.Notes ? `<div class="bf-notes">📝 ${escapeHtml(c.Notes)}</div>` : ""}
          <div class="bf-meta">Added: ${escapeHtml(c.DateAdded)} · Status:
            <select class="bf-status" data-id="${c.id}">
              ${["New", "Contacted", "Interested", "Not Interested", "Closed"]
                .map(
                  (s) =>
                    `<option value="${s}" ${c.Status === s ? "selected" : ""}>${s}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>
        <div class="bf-card-actions">
          <button class="bf-btn-email" data-id="${c.id}">✉️ Email</button>
          <button class="bf-btn-whatsapp" data-id="${c.id}">💬 WhatsApp</button>
          <button class="bf-btn-delete" data-id="${c.id}">🗑 Delete</button>
        </div>
      </div>
    `)
    .join("");

  attachCardListeners();
}

function attachCardListeners() {
  document.querySelectorAll(".bf-status").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      updateCompanyStatus(e.target.dataset.id, e.target.value);
      renderProgress();
    });
  });
  document.querySelectorAll(".bf-btn-email").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const company = loadSavedCompanies().find((c) => c.id === e.target.dataset.id);
      if (company) generateEmailDraft(company);
    });
  });
  document.querySelectorAll(".bf-btn-whatsapp").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const company = loadSavedCompanies().find((c) => c.id === e.target.dataset.id);
      if (company) generateWhatsAppDraft(company);
    });
  });
  document.querySelectorAll(".bf-btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (confirm("Delete this company record?")) {
        deleteCompany(e.target.dataset.id);
        renderCompanyList();
        renderProgress();
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------
   9. ADD-COMPANY FORM HANDLER
   --------------------------------------------------------- */
function handleAddCompanyForm() {
  const form = document.getElementById("addCompanyForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      company: document.getElementById("inCompany").value.trim(),
      category: document.getElementById("inCategory").value,
      website: document.getElementById("inWebsite").value.trim(),
      email: document.getElementById("inEmail").value.trim(),
      phone: document.getElementById("inPhone").value.trim(),
      contactPerson: document.getElementById("inContact").value.trim(),
      notes: document.getElementById("inNotes").value.trim()
    };
    if (!data.company) {
      alert("Please enter a company name.");
      return;
    }
    saveCompany(data);
    form.reset();
    renderCompanyList();
    renderProgress();
    document.getElementById("addCompanyPanel").classList.remove("open");
  });
}

/* ---------------------------------------------------------
   10. INIT
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await initBuyerData();

  // Category search buttons
  document.querySelectorAll("[data-search-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      searchCategory(btn.getAttribute("data-search-category"));
    });
  });

  // Search all
  const allBtn = document.getElementById("searchAllBtn");
  if (allBtn) allBtn.addEventListener("click", searchAllCategories);

  // Toggle add-company panel
  const toggleBtn = document.getElementById("toggleAddCompany");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.getElementById("addCompanyPanel").classList.toggle("open");
    });
  }

  handleAddCompanyForm();
  renderCompanyList();
  renderProgress();
});
