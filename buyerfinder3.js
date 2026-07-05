/* ============================================================
   AI BUYER FINDER v3 — buyerfinder3.js
   Everything from v2 is kept as-is (category picker, 4 AI
   research buttons, 4 AI contact-detail buttons, paste & compile,
   saved companies, email/WhatsApp drafts, progress tracking).

   NEW IN v3:
   - 10 extra "specialist" prompts, each written for a different
     buyer angle (NRI investors, temple trusts, hospitals, etc).
   - Each of the 10 prompts can be sent to ANY of the 4 AI engines
     (Perplexity / ChatGPT / Gemini / Claude), because each AI
     tends to surface different real organizations even from the
     exact same prompt.
   - Uses its own localStorage keys (…_v3) so it never touches or
     overwrites your v1/v2 saved data.
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
   v3 uses its own keys so v1/v2 data is never touched.
   --------------------------------------------------------- */
const STORAGE_KEY = "buyerFinder_companies_v3";
const PROGRESS_KEY = "buyerFinder_progress_v3";
const COMPILE_KEY = "buyerFinder_compiledLeads_v3";

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
    const res = await fetch("buyerdata3.json");
    seed = await res.json();
  } catch (e) {
    console.warn("buyerdata3.json not reachable, starting empty.", e);
  }
  const local = loadSavedCompanies();
  if (local.length === 0 && seed.companies && seed.companies.length > 0) {
    persistCompanies(seed.companies);
    return seed.companies;
  }
  return local;
}

/* ---------------------------------------------------------
   4. AI PROMPT BUILDING + OPENING THE AI TOOL  (same 4 as v2)
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

const COMMON_EXCLUSIONS =
  `EXCLUDE completely: brokers, land aggregators, property listing/portal websites, ` +
  `joint-venture or revenue-share seekers, lease-only operators, residential plot developers, ` +
  `and any speculative or undercapitalized buyer. I am NOT asking for property-sale advice — ` +
  `I need PROSPEROUS BUYERS ONLY, named specifically, not generic search results.\n\n`;

function buildAIPrompt(engine) {
  const keys = activeCategoryKeys();
  const orderedKeys = keys.includes("investors")
    ? ["investors", ...keys.filter((k) => k !== "investors")]
    : keys;
  const descs = orderedKeys.map((k) => CATEGORIES[k].desc);
  const whoList = descs.map((d, i) => `${i + 1}. ${d}`).join("\n");
  const commonRules = COMMON_EXCLUSIONS;

  if (engine === "perplexity") {
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

  return buildPlotBrief() + `Find prosperous buyers for: ${whoList}\n\n` + commonRules;
}

function buildContactPrompt(engine) {
  const keys = activeCategoryKeys();
  const orderedKeys = keys.includes("investors")
    ? ["investors", ...keys.filter((k) => k !== "investors")]
    : keys;
  const descs = orderedKeys.map((k) => CATEGORIES[k].desc);
  const whoList = descs.map((d, i) => `${i + 1}. ${d}`).join("\n");

  const engineNote = {
    perplexity: "Use your live web access to actually search and open real organization websites.",
    chatgpt: "Use browsing if available; otherwise rely on well-known, verifiable public organizations.",
    gemini: "Use your web access to check official Madurai / Tamil Nadu business websites.",
    claude: "Use web search if available to verify each organization's own official website."
  }[engine] || "Use web search if available.";

  return (
    `Act as a data-research assistant building a CONTACT LIST, not a strategy report. ` +
    buildPlotBrief() +
    `TASK: For prosperous organizations in these categories:\n${whoList}\n\n` +
    `${engineNote}\n\n` +
    `For EACH real organization, visit their own official website (About / Contact / Locations page) ` +
    `and extract ONLY publicly published details:\n` +
    `- Company Name\n- Website URL\n- Official Email (general/enquiry email is fine)\n` +
    `- Phone Number\n- Contact Person / Designation (if listed)\n- City / Branch Address\n\n` +
    `Present it as a simple table, one row per organization, ready for me to copy into a spreadsheet. ` +
    `If a detail is not publicly listed on their site, write "Not public" — never guess or invent an ` +
    `email or phone number. Do not include brokers, listing portals, or aggregator sites — only the ` +
    `organizations' own official websites.`
  );
}

function openAI(engine, mode) {
  const prompt = mode === "contacts" ? buildContactPrompt(engine) : buildAIPrompt(engine);
  sendPromptToEngine(engine, prompt);
  logActivity(`Sent research prompt to ${engine} for: ${activeCategoryKeys().join(", ")}`);
}

function sendPromptToEngine(engine, prompt) {
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
}

function showCopyNotice() {
  const el = document.getElementById("copyNotice");
  if (!el) return;
  el.style.display = "block";
  clearTimeout(window._bfNoticeTimer);
  window._bfNoticeTimer = setTimeout(() => (el.style.display = "none"), 6000);
}

/* ---------------------------------------------------------
   4B. NEW IN v3 — 10 SPECIALIST PROMPTS
   Each one targets a different buyer angle. Every prompt can be
   fired at any of the 4 AI engines, because the same prompt
   often surfaces different real organizations depending on
   which AI answers it (different training data / web access).
   --------------------------------------------------------- */
const SPECIALIST_PROMPTS = [
  {
    id: 1,
    title: "🌏 NRI & Diaspora Investor Finder",
    blurb: "Tamil-origin NRIs (Singapore, Malaysia, Gulf, US, UK) investing back in their native district.",
    build: () =>
      `Act as an NRI wealth and diaspora-investment researcher. ` +
      buildPlotBrief() +
      `TASK: Identify prosperous NRIs of Tamil / Madurai origin (Singapore, Malaysia, Gulf countries, ` +
      `UK, US, Canada, Australia) who are known to invest in real estate back in their native district, ` +
      `or NRI investment/community associations that pool funds for such purchases. Name real ` +
      `individuals, family offices, or associations where publicly known.\n\n` +
      COMMON_EXCLUSIONS +
      `For each, explain why buying native-place commercial land near a temple/tourism route appeals ` +
      `to NRI sentiment and investment logic.`
  },
  {
    id: 2,
    title: "🛕 Temple & Charitable Trust Finder",
    blurb: "Large temple trusts, mutts, and charitable/religious endowments with surplus corpus funds.",
    build: () =>
      `Act as a researcher specializing in Tamil Nadu temple and charitable trust finances. ` +
      buildPlotBrief() +
      `TASK: Identify large temple trusts, mutts, religious endowment boards, or registered charitable ` +
      `trusts in Tamil Nadu (especially those connected to Alagar Kovil, Madurai Meenakshi Temple ` +
      `network, or similar) that are known to hold surplus corpus funds and have historically invested ` +
      `in land or property assets. Name real trusts where publicly known.\n\n` +
      COMMON_EXCLUSIONS +
      `Note any public record of these trusts previously buying land or building guest houses / ` +
      `annadhanam halls / pilgrim facilities near temple routes.`
  },
  {
    id: 3,
    title: "🏥 Hospital & Healthcare Expansion Finder",
    blurb: "Hospital chains and healthcare groups actively expanding into Tier-2/3 Tamil Nadu towns.",
    build: () =>
      `Act as a healthcare-sector expansion analyst. ` +
      buildPlotBrief() +
      `TASK: Identify hospital chains, multi-speciality hospital groups, diagnostic chains, or nursing ` +
      `home groups that have publicly announced expansion into Tier-2 or Tier-3 towns in Tamil Nadu in ` +
      `the last 2 years, or that have a stated strategy of opening branches along highway corridors ` +
      `near temple towns and colleges (large captive patient population). Name real organizations.\n\n` +
      COMMON_EXCLUSIONS +
      `Cite the specific expansion announcement, funding round, or branch opening you found for each.`
  },
  {
    id: 4,
    title: "🎓 Educational Trust & New Campus Finder",
    blurb: "Engineering / arts / aviation / catering trusts planning new campuses in south Tamil Nadu.",
    build: () =>
      `Act as a higher-education infrastructure researcher. ` +
      buildPlotBrief() +
      `TASK: Identify educational trusts or private university groups (engineering, arts and science, ` +
      `aviation academy, catering/hospitality institute, or CBSE/matriculation school chains) that are ` +
      `publicly known to be planning, land-scouting for, or recently opened a new campus in Madurai ` +
      `district or nearby south Tamil Nadu districts. Name real trusts/institutions.\n\n` +
      COMMON_EXCLUSIONS +
      `Explain why a highway-facing corner plot near existing colleges would fit their expansion plan.`
  },
  {
    id: 5,
    title: "🎉 Hospitality & MICE / Wedding Destination Finder",
    blurb: "Hotel, resort, and banquet/convention brands targeting pilgrimage-tourism routes.",
    build: () =>
      `Act as a hospitality and MICE (meetings, incentives, conventions, events) industry scout. ` +
      buildPlotBrief() +
      `TASK: Identify hotel chains, resort operators, or dedicated wedding/convention-hall brands that ` +
      `are expanding along pilgrimage or tourism routes in Tamil Nadu, or that specifically target ` +
      `temple-town wedding tourism (Madurai is a major wedding-destination market). Name real brands ` +
      `or operators where publicly known.\n\n` +
      COMMON_EXCLUSIONS +
      `Highlight any brand known for choosing highway-corner locations near temples for visibility.`
  },
  {
    id: 6,
    title: "⛽ Highway Fuel, EV & Logistics Finder",
    blurb: "Fuel station chains, EV charging networks, and highway logistics/warehousing operators.",
    build: () =>
      `Act as a highway-infrastructure and logistics investment researcher. ` +
      buildPlotBrief() +
      `TASK: Identify fuel retail chains, EV charging network operators, highway service-plaza brands, ` +
      `or logistics/warehousing companies expanding along four-lane highways in Tamil Nadu, especially ` +
      `routes connecting Madurai to tourism or industrial hubs. Name real organizations where publicly ` +
      `known.\n\n` +
      COMMON_EXCLUSIONS +
      `Explain why a four-lane-highway corner plot with a bus stop in front is attractive to this sector.`
  },
  {
    id: 7,
    title: "🧵 Textile & Industrial Family Business Finder",
    blurb: "Madurai textile, spinning mill, and jewellery family businesses diversifying into real estate.",
    build: () =>
      `Act as a local Tamil Nadu industrial-family business researcher. ` +
      buildPlotBrief() +
      `TASK: Identify established Madurai / south Tamil Nadu business families in textiles, spinning ` +
      `mills, jewellery, or wholesale trade who are publicly known to be diversifying surplus capital ` +
      `into real estate or commercial land. Name real business houses or family groups where publicly ` +
      `known.\n\n` +
      COMMON_EXCLUSIONS +
      `Note any public record of such families previously buying commercial land near highways.`
  },
  {
    id: 8,
    title: "🍔 Franchise Master-Operator Finder",
    blurb: "National/international F&B and retail franchise brands seeking Tier-2 Tamil Nadu land.",
    build: () =>
      `Act as a franchise-expansion consultant. ` +
      buildPlotBrief() +
      `TASK: Identify national or international F&B, retail, or service franchise brands (or their ` +
      `master-franchise partners) that are publicly seeking land or expansion sites in Tier-2 Tamil ` +
      `Nadu towns, particularly highway-facing corner plots suited for a standalone outlet. Name real ` +
      `brands or franchise-development companies where publicly known.\n\n` +
      COMMON_EXCLUSIONS +
      `Note their typical land-size requirement and whether this plot's size fits.`
  },
  {
    id: 9,
    title: "🏛 Government / PPP Institutional Buyer Finder",
    blurb: "Government undertakings, PSU boards, or PPP project developers scouting land near this corridor.",
    build: () =>
      `Act as a government and public-private-partnership infrastructure researcher. ` +
      buildPlotBrief() +
      `TASK: Identify government undertakings, tourism development corporations, housing boards, or ` +
      `PPP (public-private partnership) project developers that are publicly known to be scouting land ` +
      `near tourism or education corridors in Madurai district for eligible infrastructure or tourism ` +
      `facility projects. Name real bodies or programs where publicly known.\n\n` +
      COMMON_EXCLUSIONS +
      `Note any relevant scheme or tender that could apply to a plot like this.`
  },
  {
    id: 10,
    title: "🚀 Recently Funded Startup / Scaleup Finder",
    blurb: "Funded hospitality-tech, edtech-with-campus, or D2C brands expanding physical footprint.",
    build: () =>
      `Act as a startup-funding and expansion-tracking analyst. ` +
      buildPlotBrief() +
      `TASK: Identify recently funded (last 24 months) hospitality-tech, edtech-with-physical-campus, ` +
      `wellness/retreat, or D2C brands in India that have stated plans to expand physical locations ` +
      `into Tamil Nadu or similar tourism/education-corridor towns. Name real, funded companies where ` +
      `publicly known, citing the funding round.\n\n` +
      COMMON_EXCLUSIONS +
      `Focus only on companies with confirmed funding — not early-stage or unfunded ideas.`
  }
];

function openSpecialistPrompt(promptId, engine) {
  const spec = SPECIALIST_PROMPTS.find((p) => p.id === promptId);
  if (!spec) return;
  const prompt = spec.build();
  sendPromptToEngine(engine, prompt);
  logActivity(`Sent specialist prompt #${promptId} (${spec.title}) to ${engine}`);
}

function renderSpecialistPrompts() {
  const container = document.getElementById("specialistPromptsList");
  if (!container) return;
  const engineMeta = [
    { key: "perplexity", icon: "🔮", cls: "bf-mini-perplexity" },
    { key: "chatgpt", icon: "🤖", cls: "bf-mini-chatgpt" },
    { key: "gemini", icon: "✨", cls: "bf-mini-gemini" },
    { key: "claude", icon: "🧠", cls: "bf-mini-claude" }
  ];
  container.innerHTML = SPECIALIST_PROMPTS.map((p) => `
    <div class="bf-specialist-card">
      <div class="bf-specialist-head">
        <strong>${p.id}. ${p.title}</strong>
      </div>
      <div class="bf-specialist-blurb">${p.blurb}</div>
      <div class="bf-specialist-engines">
        ${engineMeta.map((e) => `
          <button class="bf-mini-engine ${e.cls}" data-prompt-id="${p.id}" data-engine="${e.key}" title="Send to ${e.key}">
            ${e.icon}
          </button>
        `).join("")}
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
   6b. COMPILE LEADS FROM ALL PASTED AI ANSWERS
   --------------------------------------------------------- */
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

  document.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleCategory(btn.getAttribute("data-category"), btn);
    });
  });
  updateSelectionSummary();

  document.querySelectorAll("[data-ai-engine]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAI(btn.getAttribute("data-ai-engine"), btn.getAttribute("data-mode") || "leads");
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

  renderSpecialistPrompts();
  renderCompiledLeads();
  handleAddCompanyForm();
  renderCompanyList();
  renderProgress();
});
