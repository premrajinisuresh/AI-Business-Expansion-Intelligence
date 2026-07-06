/* ============================================================
   AI BUYER FINDER v4 — buyerfinder4.js
   v3 is untouched. This is a new, separate tool.

   WHAT'S CARRIED OVER FROM v3 (unchanged in spirit):
   - Property details, category picker
   - 4 main "find buyer names" AI prompts (Perplexity/ChatGPT/Gemini/Claude)
   - 4 main "get contacts" AI prompts
   - 10 specialist name-finding prompts
   - Save companies / progress tracking / email & WhatsApp drafts

   WHAT'S NEW IN v4:
   - FIX: Gemini's link in v3 used an unsupported "?q=" parameter,
     which is why it looked like it "wasn't opening" — Gemini's web
     app ignores/rejects that parameter. v4 opens Gemini's plain
     app URL instead and relies on the automatic clipboard copy +
     an on-screen reminder to paste.
   - NEW "12 Free AI Contact-Hunters": up to 12 different free AI
     chatbots, each given ONE dedicated prompt tuned to a specific
     buyer category, specifically asking for missing CONTACT DETAILS
     (official email, phone, website, contact person) sourced from
     each organization's own website — not invented.
   - A single "Paste & Compile" panel across all 12 engines so you
     can build one master database from everyone's answers.
   ============================================================ */

/* ---------------------------------------------------------
   1. PROPERTY DATA
   --------------------------------------------------------- */
const PROPERTY = {
  location: "Alagarkovil, Madurai, Tamil Nadu — 16 km from Madurai City centre",
  size: "23.5 Cents",
  type: "Prime Corner Commercial Land",
  roads: ["Alagarkovil Road", "Natham–Alanganallur High Road"],
  advantages: [
    "Corner plot on a busy junction",
    "Four lane highway frontage",
    "Only 16 km (about 30 minutes) from Madurai City",
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

function buildPlotBrief() {
  return (
    `THE PLOT:\n${PROPERTY.size} ${PROPERTY.type} at ${PROPERTY.location}. Corner plot facing ` +
    `${PROPERTY.roads.join(" and ")}. Specific features: ` +
    PROPERTY.advantages.join("; ") + `. Budget expected: ${PROPERTY.budgetRange}. ` +
    `${PROPERTY.dealType}.\n\n`
  );
}

const COMMON_EXCLUSIONS =
  `EXCLUDE completely: brokers, land aggregators, property listing/portal websites, ` +
  `joint-venture or revenue-share seekers, lease-only operators, residential plot developers, ` +
  `and any speculative or undercapitalized buyer. I need PROSPEROUS BUYERS ONLY, named ` +
  `specifically, not generic advice.\n\n`;

/* ---------------------------------------------------------
   2. CATEGORIES (Step 1 / Step 2 / Step 2B, same as v3)
   --------------------------------------------------------- */
const CATEGORIES = {
  hotels: { label: "🏨 Hotels", desc: "hotel chains and hotel groups (budget, mid-scale, or highway hotels)" },
  resorts: { label: "🌴 Resorts", desc: "resort developers and weekend/tourism resort operators" },
  hospitals: { label: "🏥 Hospitals", desc: "hospital chains, nursing homes, and healthcare groups" },
  education: { label: "🎓 Education", desc: "educational trusts, engineering/arts/aviation/catering colleges, and school trusts" },
  restaurants: { label: "🍽 Restaurants", desc: "restaurant chains, food courts, and highway dining brands" },
  investors: {
    label: "🌍 Investors",
    desc: "prosperous Madurai business families, NRI investors, local HNI individuals, temple/charitable trusts, and real estate investment groups"
  }
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);
let selectedCategories = new Set();

function activeCategoryKeys() {
  return selectedCategories.size > 0 ? Array.from(selectedCategories) : CATEGORY_KEYS;
}

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
   3. THE 12 FREE AI ENGINES
   Each entry knows: display info, whether it reliably supports a
   URL-prefilled prompt, and how to build its URL. Every engine
   ALSO gets the prompt copied to the clipboard automatically, so
   even engines with no prefill support are just "open + paste".
   --------------------------------------------------------- */
const ENGINES = [
  { key: "perplexity", label: "Perplexity", icon: "🔮", color: "#1FB8CD", prefill: true,
    urlFor: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
  { key: "chatgpt", label: "ChatGPT", icon: "🤖", color: "#10a37f", prefill: true,
    urlFor: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { key: "gemini", label: "Gemini", icon: "✨", color: "#8e44ad", prefill: false,
    // FIX for v3: Gemini's web app does not support a "?q=" prefill parameter.
    // Opening it with one made the page look broken / "not opening". Open plain.
    urlFor: () => `https://gemini.google.com/app` },
  { key: "claude", label: "Claude", icon: "🧠", color: "#D97757", prefill: true,
    urlFor: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  { key: "copilot", label: "Copilot", icon: "🧭", color: "#0f6cbd", prefill: true,
    urlFor: (q) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}` },
  { key: "you", label: "You.com", icon: "🟢", color: "#1f9d55", prefill: true,
    urlFor: (q) => `https://you.com/search?q=${encodeURIComponent(q)}&tbm=youchat` },
  { key: "deepseek", label: "DeepSeek", icon: "🐳", color: "#4c6ef5", prefill: false,
    urlFor: () => `https://chat.deepseek.com/` },
  { key: "meta", label: "Meta AI", icon: "🦙", color: "#0668E1", prefill: false,
    urlFor: () => `https://www.meta.ai/` },
  { key: "grok", label: "Grok", icon: "⚡", color: "#333333", prefill: false,
    urlFor: () => `https://grok.com/` },
  { key: "mistral", label: "Le Chat", icon: "🌬", color: "#ff7000", prefill: false,
    urlFor: () => `https://chat.mistral.ai/chat` },
  { key: "huggingchat", label: "HuggingChat", icon: "🤗", color: "#ff9d00", prefill: false,
    urlFor: () => `https://huggingface.co/chat/` },
  { key: "pi", label: "Pi", icon: "🥧", color: "#6c5ce7", prefill: false,
    urlFor: () => `https://pi.ai/talk` }
];

function getEngine(key) {
  return ENGINES.find((e) => e.key === key);
}

/* ---------------------------------------------------------
   4. GENERAL PROMPTS (Step 2 / Step 2B) — same 4 engines as v3
   --------------------------------------------------------- */
function buildAIPrompt(engineKey) {
  const keys = activeCategoryKeys();
  const orderedKeys = keys.includes("investors") ? ["investors", ...keys.filter((k) => k !== "investors")] : keys;
  const whoList = orderedKeys.map((k, i) => `${i + 1}. ${CATEGORIES[k].desc}`).join("\n");

  if (engineKey === "perplexity") {
    return `Act as a financial due-diligence researcher with live web access. ` + buildPlotBrief() +
      `TASK: Find REAL organizations with VERIFIABLE recent evidence of expansion or investment in ` +
      `Tamil Nadu / Madurai in the last 24 months. Focus on:\n${whoList}\n\n` + COMMON_EXCLUSIONS +
      `Cite the specific evidence and date for each.`;
  }
  if (engineKey === "chatgpt") {
    return `Act as a creative business-development strategist. ` + buildPlotBrief() +
      `TASK: Beyond the obvious, brainstorm non-obvious but financially strong buyer types that ` +
      `exploit a highway corner near a temple/tourism route and an education corridor. Categories:\n${whoList}\n\n` +
      COMMON_EXCLUSIONS + `Name real organizations where you know any.`;
  }
  if (engineKey === "gemini") {
    return `Act as a local Madurai business-community insider. ` + buildPlotBrief() +
      `TASK: Focus on prosperous buyers based in or native to Madurai City — business families, ` +
      `NRI investors, temple/charitable trusts, local investment groups. Categories:\n${whoList}\n\n` +
      COMMON_EXCLUSIONS + `Explain why each could decide quickly.`;
  }
  if (engineKey === "claude") {
    return `Act as a negotiation and buyer-psychology consultant. ` + buildPlotBrief() +
      `TASK: For these categories:\n${whoList}\n\n` + COMMON_EXCLUSIONS +
      `For each candidate, explain the psychological/strategic reason they'd say yes to THIS plot, ` +
      `and rank all by likelihood to close.`;
  }
  return buildPlotBrief() + `Find prosperous buyers for:\n${whoList}\n\n` + COMMON_EXCLUSIONS;
}

function buildGeneralContactPrompt(engineKey) {
  const keys = activeCategoryKeys();
  const orderedKeys = keys.includes("investors") ? ["investors", ...keys.filter((k) => k !== "investors")] : keys;
  const whoList = orderedKeys.map((k, i) => `${i + 1}. ${CATEGORIES[k].desc}`).join("\n");
  const eng = getEngine(engineKey);
  const browseNote = eng && eng.prefill
    ? "Use your live web access to actually open real organization websites."
    : "If you cannot browse live, only name well-known real organizations and their official website address — write 'Not public' for anything you cannot verify. Never invent an email or phone number.";

  return `Act as a data-research assistant building a CONTACT LIST, not a strategy report. ` +
    buildPlotBrief() +
    `TASK: For prosperous organizations in:\n${whoList}\n\n${browseNote}\n\n` +
    `For EACH real organization, extract ONLY publicly published details from their own official ` +
    `website (About / Contact / Locations page):\n` +
    `- Company Name\n- Website URL\n- Official Email\n- Phone Number\n- Contact Person / Designation\n- City / Branch Address\n\n` +
    `Present as a simple table, one row per organization. Write "Not public" if a detail isn't ` +
    `listed — never guess. Exclude brokers, listing portals, and aggregator sites.`;
}

/* ---------------------------------------------------------
   5. 10 SPECIALIST NAME-FINDING PROMPTS (Step 2C, same as v3)
   --------------------------------------------------------- */
const SPECIALIST_PROMPTS = [
  { id: 1, title: "🌏 NRI & Diaspora Investor Finder", blurb: "Tamil-origin NRIs investing back in their native district.",
    build: () => `Act as an NRI wealth and diaspora-investment researcher. ` + buildPlotBrief() +
      `TASK: Identify prosperous NRIs of Tamil/Madurai origin (Singapore, Malaysia, Gulf, UK, US, Canada, Australia) known to invest in native-place real estate, or NRI investment associations that pool funds for such purchases. Name real individuals, family offices, or associations where publicly known.\n\n` + COMMON_EXCLUSIONS },
  { id: 2, title: "🛕 Temple & Charitable Trust Finder", blurb: "Large temple trusts and charitable/religious endowments with surplus funds.",
    build: () => `Act as a researcher specializing in Tamil Nadu temple and charitable trust finances. ` + buildPlotBrief() +
      `TASK: Identify large temple trusts, mutts, religious endowment boards, or registered charitable trusts in Tamil Nadu with surplus corpus funds and a history of investing in land or property. Name real trusts where publicly known.\n\n` + COMMON_EXCLUSIONS },
  { id: 3, title: "🏥 Hospital & Healthcare Expansion Finder", blurb: "Hospital chains actively expanding into Tier-2/3 Tamil Nadu towns.",
    build: () => `Act as a healthcare-sector expansion analyst. ` + buildPlotBrief() +
      `TASK: Identify hospital chains, diagnostic chains, or nursing home groups publicly known to be expanding into Tier-2/3 Tamil Nadu towns, or with a stated highway-corridor branch strategy. Name real organizations.\n\n` + COMMON_EXCLUSIONS },
  { id: 4, title: "🎓 Educational Trust & New Campus Finder", blurb: "Engineering/arts/aviation/catering trusts planning new campuses.",
    build: () => `Act as a higher-education infrastructure researcher. ` + buildPlotBrief() +
      `TASK: Identify educational trusts or private university groups planning, land-scouting for, or recently opening a new campus in Madurai district or nearby south Tamil Nadu. Name real trusts/institutions.\n\n` + COMMON_EXCLUSIONS },
  { id: 5, title: "🎉 Hospitality & MICE / Wedding Destination Finder", blurb: "Hotel, resort and banquet brands targeting pilgrimage-tourism routes.",
    build: () => `Act as a hospitality and MICE industry scout. ` + buildPlotBrief() +
      `TASK: Identify hotel chains, resort operators or wedding/convention-hall brands expanding along pilgrimage/tourism routes in Tamil Nadu, or targeting temple-town wedding tourism. Name real brands where publicly known.\n\n` + COMMON_EXCLUSIONS },
  { id: 6, title: "⛽ Highway Fuel, EV & Logistics Finder", blurb: "Fuel chains, EV networks, and highway logistics/warehousing operators.",
    build: () => `Act as a highway-infrastructure and logistics investment researcher. ` + buildPlotBrief() +
      `TASK: Identify fuel retail chains, EV charging operators, highway service-plaza brands, or logistics/warehousing companies expanding along four-lane highways in Tamil Nadu. Name real organizations.\n\n` + COMMON_EXCLUSIONS },
  { id: 7, title: "🧵 Textile & Industrial Family Business Finder", blurb: "Madurai textile/spinning mill/jewellery families diversifying into real estate.",
    build: () => `Act as a local Tamil Nadu industrial-family business researcher. ` + buildPlotBrief() +
      `TASK: Identify established Madurai/south Tamil Nadu business families (textiles, spinning mills, jewellery, wholesale trade) publicly known to be diversifying capital into real estate. Name real business houses where publicly known.\n\n` + COMMON_EXCLUSIONS },
  { id: 8, title: "🍔 Franchise Master-Operator Finder", blurb: "National/international F&B and retail franchise brands seeking Tier-2 land.",
    build: () => `Act as a franchise-expansion consultant. ` + buildPlotBrief() +
      `TASK: Identify national/international F&B, retail, or service franchise brands (or master-franchise partners) publicly seeking expansion sites in Tier-2 Tamil Nadu towns. Name real brands.\n\n` + COMMON_EXCLUSIONS },
  { id: 9, title: "🏛 Government / PPP Institutional Buyer Finder", blurb: "Government undertakings or PPP developers scouting land near this corridor.",
    build: () => `Act as a government and PPP infrastructure researcher. ` + buildPlotBrief() +
      `TASK: Identify government undertakings, tourism development corporations, or PPP project developers publicly known to be scouting land near tourism/education corridors in Madurai district. Name real bodies where publicly known.\n\n` + COMMON_EXCLUSIONS },
  { id: 10, title: "🚀 Recently Funded Startup / Scaleup Finder", blurb: "Funded hospitality-tech, edtech-with-campus, or D2C brands expanding physically.",
    build: () => `Act as a startup-funding and expansion-tracking analyst. ` + buildPlotBrief() +
      `TASK: Identify recently funded (last 24 months) hospitality-tech, edtech-with-campus, wellness/retreat, or D2C brands with stated plans to expand into Tamil Nadu or similar corridor towns. Cite the funding round.\n\n` + COMMON_EXCLUSIONS }
];

function openSpecialistPrompt(promptId, engineKey) {
  const spec = SPECIALIST_PROMPTS.find((p) => p.id === promptId);
  if (!spec) return;
  sendPromptToEngine(engineKey, spec.build());
  logActivity(`Sent specialist prompt #${promptId} (${spec.title}) to ${engineKey}`);
}

function renderSpecialistPrompts() {
  const container = document.getElementById("specialistPromptsList");
  if (!container) return;
  const miniEngines = ["perplexity", "chatgpt", "gemini", "claude"];
  container.innerHTML = SPECIALIST_PROMPTS.map((p) => `
    <div class="bf-specialist-card">
      <div class="bf-specialist-head"><strong>${p.id}. ${p.title}</strong></div>
      <div class="bf-specialist-blurb">${p.blurb}</div>
      <div class="bf-specialist-engines">
        ${miniEngines.map((k) => {
          const e = getEngine(k);
          return `<button class="bf-mini-engine" style="background:${e.color}" data-prompt-id="${p.id}" data-engine="${k}" title="Send to ${e.label}">${e.icon}</button>`;
        }).join("")}
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".bf-mini-engine").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSpecialistPrompt(Number(btn.getAttribute("data-prompt-id")), btn.getAttribute("data-engine"));
    });
  });
}

/* ---------------------------------------------------------
   6. NEW — 12 FREE AI CONTACT-HUNTERS (Step 2D)
   One fixed engine + one fixed buyer-category focus each,
   specifically asking for the missing CONTACT DETAILS.
   --------------------------------------------------------- */
function contactHunterPrompt(categoryDesc, engineKey) {
  const eng = getEngine(engineKey);
  const browseNote = eng.prefill
    ? "You have live web access — actually visit each organization's official website."
    : "If you cannot browse the live web in this chat, only name well-known REAL organizations and give their official website address so I can look up contacts myself. Never invent an email or phone number — write 'Not public' instead of guessing.";

  return `Act as a meticulous data-research assistant building a CONTACT DATABASE. ` +
    buildPlotBrief() +
    `TASK: For prosperous organizations that are ${categoryDesc}, find their official contact ` +
    `details. ${browseNote}\n\n` +
    `For EACH real organization, extract ONLY publicly published details from their own official ` +
    `website (About / Contact Us / Locations / Branches page):\n` +
    `- Company Name\n- Website URL\n- Official Email (general enquiry email is fine)\n` +
    `- Phone Number\n- Contact Person / Designation (if listed)\n- City / Branch Address\n\n` +
    `Present it as a simple table, one row per organization, ready to copy into a spreadsheet. ` +
    `${COMMON_EXCLUSIONS}` +
    `Give at least 8-10 organizations if possible.`;
}

const CONTACT_HUNTERS = [
  { engine: "perplexity", category: "hotel chains, budget/mid-scale hotels, and highway hospitality brands" },
  { engine: "chatgpt", category: "restaurant chains, food court operators, and highway QSR/dining brands" },
  { engine: "gemini", category: "prosperous Madurai-based business families and local HNI investors" },
  { engine: "claude", category: "hospital chains, nursing homes, and healthcare groups" },
  { engine: "copilot", category: "educational trusts and engineering/arts/aviation/catering colleges" },
  { engine: "you", category: "NRI and diaspora investor associations of Tamil/Madurai origin" },
  { engine: "deepseek", category: "temple trusts, mutts, and charitable/religious endowment boards in Tamil Nadu" },
  { engine: "meta", category: "wedding/convention/banquet hall operators and MICE event brands" },
  { engine: "grok", category: "highway fuel retail chains, EV charging networks, and logistics/warehousing operators" },
  { engine: "mistral", category: "national or international F&B and retail franchise master-operators" },
  { engine: "huggingchat", category: "government undertakings, tourism boards, and PPP infrastructure developers" },
  { engine: "pi", category: "recently funded startups/scaleups expanding their physical footprint into Tamil Nadu" }
].map((c, i) => ({ id: i + 1, ...c }));

function openContactHunter(id) {
  const item = CONTACT_HUNTERS.find((c) => c.id === id);
  if (!item) return;
  const prompt = contactHunterPrompt(item.category, item.engine);
  sendPromptToEngine(item.engine, prompt);
  logActivity(`Sent contact-hunt prompt #${id} to ${item.engine} (${item.category})`);
}

function renderContactHunters() {
  const container = document.getElementById("contactHuntersList");
  if (!container) return;
  container.innerHTML = CONTACT_HUNTERS.map((c) => {
    const e = getEngine(c.engine);
    const browseTag = e.prefill
      ? `<span class="bf-tag-browse bf-tag-yes">opens with prompt ready</span>`
      : `<span class="bf-tag-browse bf-tag-no">opens blank — prompt auto-copied, just paste</span>`;
    return `
      <div class="bf-hunter-card" style="border-left-color:${e.color}">
        <div class="bf-hunter-head">
          <span class="bf-hunter-icon" style="background:${e.color}">${e.icon}</span>
          <div>
            <strong>${e.label}</strong>
            <div class="bf-hunter-cat">${c.category}</div>
          </div>
        </div>
        ${browseTag}
        <button class="bf-hunter-btn" style="background:${e.color}" data-id="${c.id}">Open ${e.label} →</button>
      </div>`;
  }).join("");

  container.querySelectorAll(".bf-hunter-btn").forEach((btn) => {
    btn.addEventListener("click", () => openContactHunter(Number(btn.getAttribute("data-id"))));
  });
}

/* ---------------------------------------------------------
   7. SENDING PROMPTS / CLIPBOARD
   --------------------------------------------------------- */
function sendPromptToEngine(engineKey, prompt) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(prompt).catch(() => {});
  }
  const eng = getEngine(engineKey);
  const url = eng ? eng.urlFor(prompt) : "#";
  window.open(url, "_blank");
  showCopyNotice();
}

function openAI(engineKey, mode) {
  const prompt = mode === "contacts" ? buildGeneralContactPrompt(engineKey) : buildAIPrompt(engineKey);
  sendPromptToEngine(engineKey, prompt);
  logActivity(`Sent general ${mode} prompt to ${engineKey}`);
}

function showCopyNotice() {
  const el = document.getElementById("copyNotice");
  if (!el) return;
  el.style.display = "block";
  clearTimeout(window._bfNoticeTimer);
  window._bfNoticeTimer = setTimeout(() => (el.style.display = "none"), 7000);
}

/* ---------------------------------------------------------
   8. PASTE & COMPILE — across all 12 engines
   --------------------------------------------------------- */
const COMPILE_KEY = "buyerFinder_compiledLeads_v4";

function compileLeads() {
  const parts = [];
  ENGINES.forEach((e) => {
    const el = document.getElementById("paste_" + e.key);
    const text = el ? el.value.trim() : "";
    if (text) parts.push(`===== ${e.icon} ${e.label} =====\n${text}`);
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
  if (!compiled) { out.style.display = "none"; return; }
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

function renderPasteGrid() {
  const grid = document.getElementById("pasteGrid");
  if (!grid) return;
  grid.innerHTML = ENGINES.map((e) => `
    <div class="bf-paste-box">
      <label>${e.icon} ${e.label} answer</label>
      <textarea id="paste_${e.key}" rows="3" placeholder="Paste ${e.label}'s reply here..."></textarea>
    </div>
  `).join("");
}

/* ---------------------------------------------------------
   9. STORAGE HELPERS FOR SAVED COMPANIES (v4 keys)
   --------------------------------------------------------- */
const STORAGE_KEY = "buyerFinder_companies_v4";
const PROGRESS_KEY = "buyerFinder_progress_v4";

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
    const res = await fetch("buyerdata4.json");
    seed = await res.json();
  } catch (e) {
    console.warn("buyerdata4.json not reachable, starting empty.", e);
  }
  const local = loadSavedCompanies();
  if (local.length === 0 && seed.companies && seed.companies.length > 0) {
    persistCompanies(seed.companies);
    return seed.companies;
  }
  return local;
}

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
   10. PROGRESS TRACKING
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
  const contacted = companies.filter((c) => c.Status === "Contacted" || c.Status === "Interested").length;
  const interested = companies.filter((c) => c.Status === "Interested").length;
  return { found: total, saved: total, contacted, interested };
}
function renderProgress() {
  const stats = getProgressStats();
  const map = { statFound: stats.found, statSaved: stats.saved, statContacted: stats.contacted, statInterested: stats.interested };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

/* ---------------------------------------------------------
   11. EMAIL / WHATSAPP DRAFTS
   --------------------------------------------------------- */
function buildPropertyPitchText() {
  return `Prime ${PROPERTY.size} corner commercial land at ${PROPERTY.location}, facing ` +
    `${PROPERTY.roads.join(" and ")}. ` + PROPERTY.advantages.slice(0, 6).join(", ") + ". " +
    `Suitable for hotels, resorts, hospitals, educational institutions, restaurants or large-scale ` +
    `commercial development. Budget range considered: ${PROPERTY.budgetRange}. ${PROPERTY.dealType}.`;
}
function generateEmailDraft(company) {
  const subject = `Commercial Land Opportunity — ${PROPERTY.location} (${PROPERTY.size})`;
  const body = `Dear ${company.ContactPerson || "Sir/Madam"},\n\n` +
    `I am writing to bring to your attention a prime commercial land opportunity that may be of ` +
    `interest to ${company.Company || "your organization"}.\n\n` + buildPropertyPitchText() +
    `\n\nKey highlights:\n` + PROPERTY.advantages.map((a) => "• " + a).join("\n") +
    `\n\nI would be glad to share more details, photographs, and location maps, and to arrange a ` +
    `site visit at your convenience.\n\nLooking forward to your response.\n\nBest regards,`;
  const mailto = `mailto:${encodeURIComponent(company.Email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, "_blank");
  logActivity(`Drafted email for ${company.Company || "(unnamed)"}`);
}
function generateWhatsAppDraft(company) {
  const text = `Hello${company.ContactPerson ? " " + company.ContactPerson : ""}, I have a ${PROPERTY.size} ` +
    `prime corner commercial land at ${PROPERTY.location} facing ${PROPERTY.roads.join(" & ")}. ` +
    `Ideal for hotels/resorts/hospitals/education/commercial use. Would this be of interest to ` +
    `${company.Company || "your organization"}? Happy to share full details and photos.`;
  const phone = (company.Phone || "").replace(/[^0-9]/g, "");
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  logActivity(`Drafted WhatsApp message for ${company.Company || "(unnamed)"}`);
}

/* ---------------------------------------------------------
   12. RENDER SAVED COMPANIES LIST
   --------------------------------------------------------- */
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
function renderCompanyList() {
  const listEl = document.getElementById("companyList");
  if (!listEl) return;
  const companies = loadSavedCompanies();
  if (companies.length === 0) {
    listEl.innerHTML = `<p class="bf-empty">No companies saved yet. Ask the AI, find a real organization, then use "Add Company" to save it here.</p>`;
    return;
  }
  listEl.innerHTML = companies.slice().reverse().map((c) => `
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
            ${["New", "Contacted", "Interested", "Not Interested", "Closed"].map((s) => `<option value="${s}" ${c.Status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="bf-card-actions">
        <button class="bf-btn-email" data-id="${c.id}">✉️ Email</button>
        <button class="bf-btn-whatsapp" data-id="${c.id}">💬 WhatsApp</button>
        <button class="bf-btn-delete" data-id="${c.id}">🗑 Delete</button>
      </div>
    </div>
  `).join("");
  attachCardListeners();
}
function attachCardListeners() {
  document.querySelectorAll(".bf-status").forEach((sel) => {
    sel.addEventListener("change", (e) => { updateCompanyStatus(e.target.dataset.id, e.target.value); renderProgress(); });
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

/* ---------------------------------------------------------
   13. ADD-COMPANY FORM
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
    if (!data.company) { alert("Please enter a company name."); return; }
    saveCompany(data);
    form.reset();
    renderCompanyList();
    renderProgress();
    document.getElementById("addCompanyPanel").classList.remove("open");
  });
}

/* ---------------------------------------------------------
   14. INIT
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await initBuyerData();

  document.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => toggleCategory(btn.getAttribute("data-category"), btn));
  });
  updateSelectionSummary();

  document.querySelectorAll("[data-ai-engine]").forEach((btn) => {
    btn.addEventListener("click", () => openAI(btn.getAttribute("data-ai-engine"), btn.getAttribute("data-mode") || "leads"));
  });

  const toggleBtn = document.getElementById("toggleAddCompany");
  if (toggleBtn) toggleBtn.addEventListener("click", () => document.getElementById("addCompanyPanel").classList.toggle("open"));

  const compileBtn = document.getElementById("compileBtn");
  if (compileBtn) compileBtn.addEventListener("click", compileLeads);
  const copyCompiledBtn = document.getElementById("copyCompiledBtn");
  if (copyCompiledBtn) copyCompiledBtn.addEventListener("click", copyCompiledLeads);

  renderSpecialistPrompts();
  renderContactHunters();
  renderPasteGrid();
  renderCompiledLeads();
  handleAddCompanyForm();
  renderCompanyList();
  renderProgress();
});
