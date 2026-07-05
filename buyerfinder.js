/* =========================================================
   AI BUYER FINDER — buyerfinder.js
   Property: 23.5 Cent Corner Commercial Land, Alagarkovil
   Junction, Madurai. Acts as a virtual Business Development
   Executive: generates targeted public-web search leads,
   tracks outreach progress, and drafts contact messages.
   ========================================================= */

const PROPERTY = {
  location: "Alagarkovil Junction, Madurai, Tamil Nadu, India",
  size: "23.5 Cents",
  type: "Prime Corner Commercial Land",
  roads: ["Alagarkovil Road", "Natham–Alanganallur High Road"],
  price: "Rs. 25 Lakhs / cent",
  contact: "9884198930",
  brochure: "https://bit.ly/4tHbNV4",
  highlights: [
    "Corner plot on a busy junction",
    "Four lane highway frontage",
    "~30 minutes to Madurai City",
    "Bus stop directly in front",
    "On the Madurai–Alagarkovil tourism corridor",
    "On an education corridor (multiple colleges nearby)",
    "Noticeably cooler local climate",
    "Near Alagar Kovil Temple",
    "Near Alanganallur (world famous Jallikattu venue)",
    "Near the upcoming Vishaal Tourism Project",
    "Near TNPL Cricket Ground, Natham",
    "Near Engineering, Arts, Catering & Aviation colleges",
    "Near several schools"
  ]
};

/* ---------------------------------------------------------
   CATEGORY CONFIG
   Each category has a list of "role" keywords (the kind of
   org/decision-maker) combined with location + intent terms
   to build high-signal Google search queries.
   --------------------------------------------------------- */
const CATEGORIES = {
  hotels: {
    label: "🏨 Hotels",
    roles: [
      "budget hotel chain expansion",
      "boutique hotel group new property",
      "hotel chain land requirement",
      "highway hotel developer",
      "hotel franchise expansion South India"
    ]
  },
  resorts: {
    label: "🌴 Resorts",
    roles: [
      "resort developer land acquisition",
      "weekend resort investor Tamil Nadu",
      "eco resort project near temple town",
      "service apartments developer highway land",
      "resort chain expansion Madurai"
    ]
  },
  hospitals: {
    label: "🏥 Hospitals",
    roles: [
      "hospital chain new branch land requirement",
      "nursing home expansion Madurai district",
      "multi speciality hospital land purchase",
      "diagnostic center chain new location",
      "healthcare trust land acquisition Tamil Nadu"
    ]
  },
  education: {
    label: "🎓 Education",
    roles: [
      "engineering college new campus land",
      "educational trust land purchase Madurai",
      "aviation academy new campus",
      "catering college expansion Tamil Nadu",
      "arts and science college new campus land",
      "CBSE school new campus land requirement"
    ]
  },
  restaurants: {
    label: "🍽 Restaurants",
    roles: [
      "restaurant chain highway outlet expansion",
      "food court developer highway land",
      "convention hall marriage hall investor",
      "QSR chain expansion Tamil Nadu highway",
      "banquet hall developer Madurai"
    ]
  },
  investors: {
    label: "🌍 Investors",
    roles: [
      "HNI investor commercial land Tamil Nadu",
      "NRI investor land purchase Madurai",
      "real estate investment group Tamil Nadu",
      "commercial land buyer Madurai corner plot",
      "shopping mall developer land requirement Tamil Nadu"
    ]
  }
};

const LOCATION_TERMS = [
  "Madurai",
  "Alagarkovil",
  "Alanganallur",
  "Natham",
  "Tamil Nadu"
];

const STORAGE_KEYS = {
  companies: "bf_companies",
  progress: "bf_progress"
};

/* ---------------------------------------------------------
   SEARCH QUERY GENERATION
   --------------------------------------------------------- */
function generateSearchQueries(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return [];
  const queries = [];
  cat.roles.forEach((role) => {
    // Pair each role with a rotating location term for variety
    const loc = LOCATION_TERMS[queries.length % LOCATION_TERMS.length];
    queries.push(`${role} ${loc}`);
  });
  return queries;
}

function buildGoogleUrl(query) {
  return "https://www.google.com/search?q=" + encodeURIComponent(query);
}

/* ---------------------------------------------------------
   PROGRESS TRACKING (per-day, stored in localStorage)
   --------------------------------------------------------- */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEYS.progress);
  let progress = raw ? JSON.parse(raw) : {};
  if (progress.date !== todayKey()) {
    progress = { date: todayKey(), companiesFound: 0 };
  }
  return progress;
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

function bumpSearchesOpened(count) {
  const progress = loadProgress();
  progress.companiesFound = (progress.companiesFound || 0) + count;
  saveProgress(progress);
  updateProgressUI();
}

/* ---------------------------------------------------------
   COMPANY STORAGE (localStorage acts as the live database;
   buyerdata.json is the portable import/export format)
   --------------------------------------------------------- */
function loadCompanies() {
  const raw = localStorage.getItem(STORAGE_KEYS.companies);
  return raw ? JSON.parse(raw) : [];
}

function saveCompanies(list) {
  localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(list));
}

function addCompany(data) {
  const list = loadCompanies();
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    Company: data.company || "",
    Category: data.category || "Other",
    Website: data.website || "",
    Email: data.email || "",
    Phone: data.phone || "",
    ContactPerson: data.contactPerson || "",
    Status: "New",
    Notes: data.notes || "",
    DateAdded: new Date().toISOString().slice(0, 10)
  };
  list.unshift(record);
  saveCompanies(list);
  renderCompanies();
  updateProgressUI();
}

function updateStatus(id, status) {
  const list = loadCompanies();
  const idx = list.findIndex((c) => c.id === id);
  if (idx > -1) {
    list[idx].Status = status;
    saveCompanies(list);
    renderCompanies();
    updateProgressUI();
  }
}

function deleteCompany(id) {
  if (!confirm("Remove this company from your saved list?")) return;
  const list = loadCompanies().filter((c) => c.id !== id);
  saveCompanies(list);
  renderCompanies();
  updateProgressUI();
}

/* ---------------------------------------------------------
   UI: PROGRESS PANEL
   --------------------------------------------------------- */
function updateProgressUI() {
  const progress = loadProgress();
  const companies = loadCompanies();
  const saved = companies.length;
  const contacted = companies.filter((c) => c.Status === "Contacted").length;
  const interested = companies.filter((c) => c.Status === "Interested").length;

  setText("statFound", progress.companiesFound || 0);
  setText("statSaved", saved);
  setText("statContacted", contacted);
  setText("statInterested", interested);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ---------------------------------------------------------
   UI: COMPANIES TABLE
   --------------------------------------------------------- */
function renderCompanies() {
  const tbody = document.getElementById("companiesBody");
  if (!tbody) return;
  const list = loadCompanies();

  if (list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9aa5b1;">No companies saved yet. Search a category above, find a lead, then add it here.</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((c) => {
      return `
      <tr>
        <td>
          <div style="font-weight:600;color:#0b1f3a;">${escapeHtml(c.Company)}</div>
          <div style="font-size:12px;color:#7a8494;">${escapeHtml(c.Category)} · added ${c.DateAdded}</div>
          ${c.Notes ? `<div style="font-size:12px;color:#7a8494;margin-top:2px;">${escapeHtml(c.Notes)}</div>` : ""}
        </td>
        <td style="font-size:13px;">
          ${c.Website ? `<div><a href="${escapeAttr(c.Website)}" target="_blank" rel="noopener">${escapeHtml(c.Website)}</a></div>` : ""}
          ${c.Email ? `<div>${escapeHtml(c.Email)}</div>` : ""}
          ${c.Phone ? `<div>${escapeHtml(c.Phone)}</div>` : ""}
          ${c.ContactPerson ? `<div>${escapeHtml(c.ContactPerson)}</div>` : ""}
        </td>
        <td>
          <select onchange="updateStatus('${c.id}', this.value)" style="padding:4px 6px;border-radius:6px;border:1px solid #d4af37;background:#fff;">
            ${["New", "Contacted", "Interested", "Not Interested", "Deal Closed"]
              .map((s) => `<option value="${s}" ${s === c.Status ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
        <td><button class="bf-btn-small" onclick="generateEmail('${c.id}')">✉ Email</button></td>
        <td><button class="bf-btn-small" onclick="generateWhatsApp('${c.id}')">💬 WhatsApp</button></td>
        <td><button class="bf-btn-small bf-danger" onclick="deleteCompany('${c.id}')">🗑</button></td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

/* ---------------------------------------------------------
   SEARCH ACTIONS
   --------------------------------------------------------- */
function openCategory(categoryKey) {
  const queries = generateSearchQueries(categoryKey);
  let opened = 0;
  queries.forEach((q, i) => {
    setTimeout(() => {
      const win = window.open(buildGoogleUrl(q), "_blank");
      if (!win) {
        alert(
          "Your browser blocked pop-ups. Please allow pop-ups for this site so all search tabs can open."
        );
      }
    }, i * 400);
    opened++;
  });
  bumpSearchesOpened(opened);
}

function searchAll() {
  const keys = Object.keys(CATEGORIES);
  let delay = 0;
  let total = 0;
  keys.forEach((key) => {
    const queries = generateSearchQueries(key);
    queries.forEach((q) => {
      setTimeout(() => {
        window.open(buildGoogleUrl(q), "_blank");
      }, delay);
      delay += 400;
      total++;
    });
  });
  bumpSearchesOpened(total);
}

/* ---------------------------------------------------------
   MANUAL ADD FORM
   --------------------------------------------------------- */
function handleAddCompanyForm(event) {
  event.preventDefault();
  const form = event.target;
  addCompany({
    company: form.company.value.trim(),
    category: form.category.value,
    website: form.website.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    contactPerson: form.contactPerson.value.trim(),
    notes: form.notes.value.trim()
  });
  form.reset();
}

/* ---------------------------------------------------------
   EMAIL / WHATSAPP DRAFT GENERATION
   --------------------------------------------------------- */
function draftMessage(company) {
  return `Dear ${company.ContactPerson || "Sir/Madam"},

I am writing regarding a prime 23.5 cent corner commercial land parcel available for direct purchase (no brokers) at Alagarkovil Junction, Madurai, Tamil Nadu.

Key highlights:
- Corner plot with frontage on Alagarkovil Road (46 ft) and Natham-Alanganallur High Road (168 ft)
- Four lane highway location, about 30 minutes from Madurai city
- Bus stop directly in front of the property
- Located on a growing tourism and education corridor, near Alagar Kovil Temple, Alanganallur, and several colleges
- Price: Rs. 25 Lakhs per cent, direct from owner

Given ${company.Company || "your organisation"}'s presence in the ${company.Category || "industry"} sector, I believe this location could be a strong fit for expansion.

Full brochure: ${PROPERTY.brochure}

I would welcome the opportunity to discuss this further at your convenience.

Best regards,
Suresh
Contact: ${PROPERTY.contact}`;
}

function generateEmail(id) {
  const company = loadCompanies().find((c) => c.id === id);
  if (!company) return;
  const subject = encodeURIComponent(
    `Prime Commercial Land Opportunity – Alagarkovil Junction, Madurai`
  );
  const body = encodeURIComponent(draftMessage(company));
  const mailTarget = company.Email ? company.Email : "";
  window.location.href = `mailto:${mailTarget}?subject=${subject}&body=${body}`;
  updateStatus(id, company.Status === "New" ? "Contacted" : company.Status);
}

function generateWhatsApp(id) {
  const company = loadCompanies().find((c) => c.id === id);
  if (!company) return;
  const text = encodeURIComponent(draftMessage(company));
  const phone = (company.Phone || "").replace(/[^0-9]/g, "");
  const base = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
  window.open(`${base}?text=${text}`, "_blank");
  updateStatus(id, company.Status === "New" ? "Contacted" : company.Status);
}

/* ---------------------------------------------------------
   IMPORT / EXPORT (buyerdata.json portability)
   --------------------------------------------------------- */
function exportData() {
  const companies = loadCompanies();
  const payload = {
    _readme:
      "Exported from AI Buyer Finder. Re-import this file any time to restore your saved companies.",
    fields: {
      Company: "string",
      Category: "string",
      Website: "string",
      Email: "string",
      Phone: "string",
      ContactPerson: "string",
      Status: "string",
      Notes: "string",
      DateAdded: "string"
    },
    companies
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `buyerdata-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const incoming = Array.isArray(data.companies) ? data.companies : [];
      const existing = loadCompanies();
      const existingIds = new Set(existing.map((c) => c.id));
      const merged = existing.concat(
        incoming
          .filter((c) => !existingIds.has(c.id))
          .map((c) => ({
            id: c.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            Company: c.Company || "",
            Category: c.Category || "Other",
            Website: c.Website || "",
            Email: c.Email || "",
            Phone: c.Phone || "",
            ContactPerson: c.ContactPerson || "",
            Status: c.Status || "New",
            Notes: c.Notes || "",
            DateAdded: c.DateAdded || todayKey()
          }))
      );
      saveCompanies(merged);
      renderCompanies();
      updateProgressUI();
      alert(`Imported ${incoming.length} record(s).`);
    } catch (err) {
      alert("Could not read that file. Please choose a valid buyerdata.json export.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderCompanies();
  updateProgressUI();

  const addForm = document.getElementById("addCompanyForm");
  if (addForm) addForm.addEventListener("submit", handleAddCompanyForm);

  const importInput = document.getElementById("importFile");
  if (importInput) importInput.addEventListener("change", importData);
});
