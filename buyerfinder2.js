/* ============================================================
   AI BUYER FINDER v2 — buyerfinder2.js
   Acts like an AI Business Development Executive.
   Instead of opening plain Google search tabs, this version
   sends a real research prompt to an AI tool of your choice
   (Perplexity, ChatGPT, or Gemini) so it actually names real
   companies for you.
   Uses localStorage for persistence (works on GitHub Pages /
   Cloudflare Pages with no backend/server required).
   ============================================================ */

/* ---------------------------------------------------------
   1. PROPERTY DATA (used inside every generated prompt & draft)
   --------------------------------------------------------- */
const PROPERTY = {
  location: "Alagarkovil, Madurai, Tamil Nadu — 16 km from Madurai City centre",
  size: "23.5 Cents",
  type: "Prime Corner Commercial Land",
  roads: ["Alagarkovil Road", "Natham–Alanganallur High Road"],
  advantages: [
    "Corner plot on a busy junction",
    "Four lane highway frontage",
    "Only 16 km (about 30 minutes) from Madurai City — close enough for a same-day site visit, far enough to be affordable",
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
   2. CATEGORIES (used to build the AI research prompt)
   --------------------------------------------------------- */
const CATEGORIES = {
  hotels: { label: "🏨 Hotels", desc: "hotel chains and hotel groups (budget, mid-scale, or highway hotels)" },
  resorts: { label: "🌴 Resorts", desc: "resort developers and weekend/tourism resort operators" },
  hospitals: { label: "🏥 Hospitals", desc: "hospital chains, nursing homes, and healthcare groups" },
  education: { label: "🎓 Education", desc: "educational trusts, engineering/arts/aviation/catering colleges, and school trusts" },
  restaurants: { label: "🍽 Restaurants", desc: "restaurant chains, food courts, and highway dining brands" },
  investors: {
    label: "🌍 Investors",
    desc: "PRIORITY GROUP — prosperous investors based in or native to Madurai City: established Madurai business families (textile, jewellery, spinning mills, wholesale trade) diversifying into real estate; Madurai-origin NRI investors; local HNI individuals; temple trusts and charitable trusts with surplus funds; real estate investment groups and family offices active in Madurai; convention/marriage hall operators; shopping mall developers",
    priority: true
  }
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);

/* Which categories are currently selected (default: none = "all") */
let selectedCategories = new Set();

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

async function initBuyerData() {
  let seed = { companies: [] };
  try {
    const res = await fetch("buyerdata2.json");
    seed = await res.json();
  } catch (e) {
    console.warn("buyerdata2.json not reachable, starting empty.", e);
  }
  const local = loadSavedCompanies();
  if (local.length === 0 && seed.companies && seed.companies.length > 0) {
    persistCompanies(seed.companies);
    return seed.companies;
  }
  return local;
}

/* ---------------------------------------------------------
   4. AI PROMPT BUILDING + OPENING THE AI TOOL
   --------------------------------------------------------- */
function activeCategoryKeys() {
  return selectedCategories.size > 0 ? Array.from(selectedCategories) : CATEGORY_KEYS;
}

function buildPlotBrief() {
  return (
    `THE PLOT:\n` +
    `${PROPERTY.size} ${PROPERTY.type} at ${PROPERTY.location}. Corner plot facing ` +
    `${PROPERTY.roads.join(" and ")}. Specific features: ` +
    PROPERTY.advantages.join("; ") + `. Budget expected: ${PROPERTY.budgetRange}. ` +
    `${PROPERTY.dealType}.\n\n`
  );
}

function buildAIPrompt(engine) {
  const keys = activeCategoryKeys();
  const orderedKeys = keys.includes("investors")
    ? ["investors", ...keys.filter((k) => k !== "investors")]
    : keys;
  const descs = orderedKeys.map((k) => CATEGORIES[k].desc);
  const whoList = descs.map((d, i) => `${i + 1}. ${d}`).join("\n");
  const commonRules =
    `EXCLUDE completely: brokers, land aggregators, property listing/portal websites, ` +
    `joint-venture or revenue-share seekers, lease-only operators, residential plot developers, ` +
    `and any speculative or undercapitalized buyer. I am NOT asking for property-sale advice — ` +
    `I need PROSPEROUS BUYERS ONLY, named specifically, not generic search results.\n\n`;

  if (engine === "perplexity") {
    // The fact-checker: real, recent, verifiable evidence of money in motion.
    return (
      `Act as a financial due-diligence researcher with live web access. ` +
      buildPlotBrief() +
      `TASK: Find REAL organizations with VERIFIABLE recent evidence of expansion or ` +
      `investment in Tamil Nadu / Madurai in the last 24 months — funding rounds, new branch ` +
      `openings, land purchases, expansion announcements. Focus on these categories:\n${whoList}\n\n` +
      commonRules +
      `For each one, cite the specific news/evidence of their recent financial activity and ` +
      `expansion, with dates if possible, and website if known.`
    );
  }

  if (engine === "chatgpt") {
    // The creative scout: non-obvious niches that still fit the plot's specific features.
    return (
      `Act as a creative business-development strategist who thinks beyond the obvious. ` +
      buildPlotBrief() +
      `TASK: Beyond the usual categories (${descs.join(", ")}), brainstorm NON-OBVIOUS but ` +
      `financially strong buyer types that specifically benefit from a highway corner near a ` +
      `temple/Jallikattu tourism route and an education corridor — for example logistics/warehousing ` +
      `hubs, EV charging & highway service stations, wedding/event destination brands, film/TV shoot ` +
      `location companies, spiritual retreat or wellness brands, or franchise master-operators looking ` +
      `to enter Madurai. For each niche, name real organizations if you know any.\n\n` +
      commonRules +
      `Rank ideas by how well they specifically exploit this plot's features, not just general demand.`
    );
  }

  if (engine === "gemini") {
    // The local insider: Madurai-native wealth specifically.
    return (
      `Act as a local Madurai business-community insider and researcher. ` +
      buildPlotBrief() +
      `TASK: Focus almost entirely on prosperous buyers who are based IN or NATIVE TO Madurai ` +
      `City itself — established Madurai business families (textiles, jewellery, spinning mills, ` +
      `wholesale trade), Madurai-origin NRI investors, local temple/charitable trusts with surplus ` +
      `funds, and Madurai-based real estate investment groups or family offices. Only secondarily ` +
      `consider these categories if no local fit exists:\n${whoList}\n\n` +
      commonRules +
      `Local money moves faster — explain briefly why each candidate could decide quickly.`
    );
  }

  if (engine === "claude") {
    // The closer: buyer psychology and likelihood to actually sign.
    return (
      `Act as a world-class negotiation and buyer-psychology consultant. ` +
      buildPlotBrief() +
      `TASK: For these buyer categories:\n${whoList}\n\n` +
      commonRules +
      `Don't just list companies — for each one, explain the PSYCHOLOGICAL and strategic reason ` +
      `they would say yes to THIS exact plot (status, visibility, footfall, timing, competitive ` +
      `pressure, etc.), what might make them hesitate, and how prosperous/decisive they are likely ` +
      `to be. Rank all candidates by likelihood to actually close a deal.`
    );
  }

  // fallback (shouldn't normally hit this)
  return buildPlotBrief() + `Find prosperous buyers for: ${whoList}\n\n` + commonRules;
}

function openAI(engine) {
  const prompt = buildAIPrompt(engine);

  // Try to copy the prompt to clipboard as a safety net, in case the AI
  // site opens with an empty box instead of pre-filling it.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(prompt).catch(() => {});
  }

  const encoded = encodeURIComponent(prompt);
  let url = "";
  if (engine === "perplexity") {
    url = `https://www.perplexity.ai/search?q=${encoded}`;
  } else if (engine === "chatgpt") {
    url = `https://chatgpt.com/?q=${encoded}`;
  } else if (engine === "gemini") {
    url = `https://gemini.google.com/app?q=${encoded}`;
  } else if (engine === "claude") {
    url = `https://claude.ai/new?q=${encoded}`;
  }

  window.open(url, "_blank");
  showCopyNotice();
  logActivity(`Sent research prompt to ${engine} for: ${activeCategoryKeys().join(", ")}`);
}

function showCopyNotice() {
  const el = document.getElementById("copyNotice");
  if (!el) return;
  el.style.display = "block";
  clearTimeout(window._bfNoticeTimer);
  window._bfNoticeTimer = setTimeout(() => (el.style.display = "none"), 6000);
}

/* ---------------------------------------------------------
   5. CATEGORY SELECTION (toggle, not immediate search)
   --------------------------------------------------------- */
function toggleCategory(key, btn) {
  if (selectedCategories.has(key)) {
    selectedCategories.delete(key);
    btn.classList.remove("active");
  } else {
    selectedCategories.add(key);
    btn.classList.add("active");
  }
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const el = document.getElementById("selectionSummary");
  if (!el) return;
  const keys = activeCategoryKeys();
  const isAll = selectedCategories.size === 0;
  el.textContent = isAll
    ? "No specific category picked — AI will research ALL categories."
    : `Researching: ${keys.map((k) => CATEGORIES[k].label).join(", ")}`;
}

/* ---------------------------------------------------------
   6b. COMPILE LEADS FROM ALL 4 AI ANSWERS
   --------------------------------------------------------- */
const COMPILE_KEY = "buyerFinder_compiledLeads_v2";

function compileLeads() {
  const engines = [
    { id: "pastePerplexity", label: "🔮 Perplexity (financial evidence)" },
    { id: "pasteChatGPT", label: "🤖 ChatGPT (creative niches)" },
    { id: "pasteGemini", label: "✨ Gemini (Madurai locals)" },
    { id: "pasteClaude", label: "🧠 Claude (buyer psychology)" }
  ];

  const parts = [];
  engines.forEach((eng) => {
    const el = document.getElementById(eng.id);
    const text = el ? el.value.trim() : "";
    if (text) {
      parts.push(`===== ${eng.label} =====\n${text}`);
    }
  });

  const compiled = parts.join("\n\n");
  localStorage.setItem(COMPILE_KEY, compiled);
  renderCompiledLeads();
  logActivity("Compiled leads from " + parts.length + " AI source(s)");
}

function renderCompiledLeads() {
  const out = document.getElementById("compiledOutput");
  if (!out) return;
  const compiled = localStorage.getItem(COMPILE_KEY) || "";
  if (!compiled) {
    out.style.display = "none";
    return;
  }
  out.style.display = "block";
  out.textContent = compiled;
}

function copyCompiledLeads() {
  const compiled = localStorage.getItem(COMPILE_KEY) || "";
  if (!compiled) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(compiled).catch(() => {});
  }
  showCopyNotice();
}


/* ---------------------------------------------------------
   6. SAVE / MANAGE COMPANIES
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
   7. PROGRESS TRACKING (today's activity)
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
  const saved = total;
  const contacted = companies.filter(
    (c) => c.Status === "Contacted" || c.Status === "Interested"
  ).length;
  const interested = companies.filter((c) => c.Status === "Interested").length;
  return { found: total, saved, contacted, interested };
}

/* ---------------------------------------------------------
   8. EMAIL / WHATSAPP DRAFT GENERATION
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
   9. RENDERING
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
    listEl.innerHTML = `<p class="bf-empty">No companies saved yet. Ask the AI, find a real organization, then use "Add Company" to save it here.</p>`;
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
   10. ADD-COMPANY FORM HANDLER
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
   11. INIT
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await initBuyerData();

  // Category buttons now TOGGLE a selection, they don't search directly.
  document.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleCategory(btn.getAttribute("data-category"), btn);
    });
  });
  updateSelectionSummary();

  // The 3 AI buttons — this is what actually runs the research.
  document.querySelectorAll("[data-ai-engine]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAI(btn.getAttribute("data-ai-engine"));
    });
  });

  const toggleBtn = document.getElementById("toggleAddCompany");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.getElementById("addCompanyPanel").classList.toggle("open");
    });
  }

  const compileBtn = document.getElementById("compileBtn");
  if (compileBtn) compileBtn.addEventListener("click", compileLeads);

  const copyCompiledBtn = document.getElementById("copyCompiledBtn");
  if (copyCompiledBtn) copyCompiledBtn.addEventListener("click", copyCompiledLeads);

  renderCompiledLeads();
  handleAddCompanyForm();
  renderCompanyList();
  renderProgress();
});
