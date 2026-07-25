/* ============================================================
   scripts/auto-buyer-search5.mjs
   OPTIMIZED: High-Yield, Hang-Proof Search & Lead Extraction Engine
   ============================================================ */

import fs from "fs/promises";
import crypto from "crypto";
import { looksForeign, isLocationBoundCategory } from "./lead-validators.mjs";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TAVILY_API_KEY || !GEMINI_API_KEY) {
  console.error(
    "Missing required secret(s): TAVILY_API_KEY and/or GEMINI_API_KEY. " +
    "Add them under repo Settings > Secrets and variables > Actions."
  );
  process.exit(1);
}

const DB_PATH = "buyerdatabase5.json";
const GEMINI_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 9000;
const BATCH_DELAY_MS = 2000;

const PROPERTY_BRIEF =
  "THE PLOT: 23.5 Cents Prime Corner Commercial Land at Alagarkovil, Madurai, Tamil Nadu, INDIA " +
  "(16 km from Madurai City), facing Alagarkovil Road and Natham-Alanganallur High Road. " +
  "Corner plot, four-lane highway frontage, bus stop in front, on a tourism corridor (Alagar " +
  "Kovil Temple, Alanganallur Jallikattu) and an education corridor. Budget expected: Rs 5-10 " +
  "Crore or more. Outright sale only, no brokers, no JV, no lease.";

const CATEGORIES = [
  { category: "Hotels & Highway Hospitality", query: "hotel chain expansion Madurai Tamil Nadu India highway new branch contact phone email" },
  { category: "Restaurants & Food Courts", query: "restaurant chain food court expansion Madurai Tamil Nadu India highway contact phone email" },
  { category: "Local Madurai Investors & Business Families", query: "Madurai Tamil Nadu India business family investor commercial land contact phone email" },
  { category: "Hospitals & Healthcare Groups", query: "hospital chain healthcare group expansion Madurai Tamil Nadu India new branch contact phone email" },
  { category: "Educational Trusts & Colleges", query: "engineering arts aviation catering college new campus Madurai Tamil Nadu India trust contact phone email" },
  { category: "NRI & Diaspora Investors", query: "NRI investor Tamil Nadu India native place real estate association contact phone email" },
  { category: "Temple & Charitable Trusts", query: "temple trust charitable trust Tamil Nadu India land purchase contact phone email" },
  { category: "Wedding & Convention Halls", query: "wedding convention hall banquet brand Madurai Tamil Nadu India expansion contact phone email" },
  { category: "Highway Fuel, EV & Logistics", query: "fuel station EV charging logistics warehousing company Tamil Nadu India highway expansion contact phone email" },
  { category: "Franchise Master Operators", query: "franchise master operator expansion Tamil Nadu India tier 2 town contact phone email" },
  { category: "Government / PPP Institutional", query: "government tourism corporation PPP land Madurai Tamil Nadu India contact phone email" },
  { category: "Funded Startups / Scaleups", query: "funded startup expansion Tamil Nadu India physical location contact phone email" },
  { category: "Institutional Property Consultants", query: "hospital college hotel real estate consultant institutional property advisor Tamil Nadu India buy sell contact phone email" }
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    return null;
  }
}

async function tavilySearch(query) {
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      country: "india",
      max_results: 15
    })
  });

  if (!res || !res.ok) return [];

  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: r.title,
    link: r.url,
    snippet: r.content
  }));
}

async function extractLeadsWithGemini(category, searchResults) {
  if (searchResults.length === 0) return [];

  const consultantNote =
    category === "Institutional Property Consultants"
      ? `\n\nNOTE: for THIS category specifically, "brokers" below does NOT mean hospital/college/` +
        `hotel property consultants, campus developers, or institutional real estate advisors - ` +
        `those ARE the target for this category. Only exclude generic land-listing brokers and ` +
        `property portal websites.`
      : "";

  const prompt =
    `You are building a buyer-lead database for a commercial land sale. ${PROPERTY_BRIEF}\n\n` +
    `Here are raw web search results for the category "${category}":\n` +
    JSON.stringify(searchResults, null, 2) +
    `\n\nSTRICT RULE: Only include organizations that are based in INDIA, or clearly expanding ` +
    `INTO India/Tamil Nadu. Exclude brokers, property listing/aggregator sites, and generic news ` +
    `aggregators.${consultantNote}\n\n` +
    `Extract real organizations. For each organization, extract Website, Email, Phone, ContactPerson, Notes, SourceURL if present in the text. ` +
    `Respond with ONLY a valid JSON array of objects with keys: Company, Website, Email, Phone, ContactPerson, Notes, SourceURL. No markdown formatting, no commentary.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, 12000);

  if (!res || !res.ok) return [];

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function loadDatabase() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { meta: {}, companies: [] };
  }
}

async function saveDatabase(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function domainOf(website) {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) {
    return (website || "").toLowerCase();
  }
}

function generateId(company, website) {
  const base = `${(company || "").toLowerCase().trim()}|${domainOf(website || "")}`;
  return "auto_" + crypto.createHash('md5').update(base).digest('hex').slice(0, 12);
}

const MOBILE_SHAPE_REGEX = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

function extractMobileShaped(text) {
  const m = String(text || "").match(MOBILE_SHAPE_REGEX);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  return "91" + digits.slice(-10);
}

async function tryPhoneRescue(companyName) {
  const location = "Madurai Tamil Nadu";
  const directoryQueries = [
    `"${companyName}" mobile whatsapp contact phone number ${location}`,
    `"${companyName}" justdial indiamart phone contact ${location}`,
    `"${companyName}" official contact number india`
  ];

  for (const query of directoryQueries) {
    const results = await tavilySearch(query);
    for (const r of results) {
      const combined = `${r.title} ${r.snippet}`;
      const phone = extractMobileShaped(combined);
      if (phone) {
        return { phone, source: r.link };
      }
    }
  }
  return null;
}

const MAX_PHONE_RESCUE_PER_RUN = 100;

async function main() {
  const db = await loadDatabase();
  db.meta = db.meta || {};
  db.companies = db.companies || [];

  const existingKeys = new Set(
    db.companies.map((c) => `${(c.Company || "").toLowerCase().trim()}|${domainOf(c.Website || "")}`)
  );

  let totalAdded = 0;
  let phoneRescuesUsed = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const cat of CATEGORIES) {
    console.log(`Searching: ${cat.category} ...`);
    const results = await tavilySearch(cat.query);

    if (results.length > 0) {
      const leads = await extractLeadsWithGemini(cat.category, results);

      const leadsWithRealWebsite = leads.filter((l) => {
        const w = (l.Website || "").trim();
        return w !== "" && w.toLowerCase() !== "not public";
      });
      const droppedLeads = leads.filter((l) => {
        const w = (l.Website || "").trim();
        return w === "" || w.toLowerCase() === "not public";
      });

      const rescued = [];
      for (const lead of droppedLeads) {
        if (phoneRescuesUsed >= MAX_PHONE_RESCUE_PER_RUN) break;
        phoneRescuesUsed++;
        const result = await tryPhoneRescue(lead.Company);
        if (result) {
          rescued.push({
            ...lead,
            Website: result.source,
            Phone: result.phone,
            Notes: (lead.Notes || "") + " (phone rescued via directory lookup)"
          });
        }
      }

      const finalLeads = [...leadsWithRealWebsite, ...rescued];
      let addedInCat = 0;

      finalLeads.forEach((l) => {
        const company = (l.Company || "").trim();
        if (!company) return;

        if (isLocationBoundCategory(cat.category)) {
          if (looksForeign(`${company} ${l.Notes || ""}`)) return;
        }

        const key = `${company.toLowerCase()}|${domainOf(l.Website || "")}`;
        if (existingKeys.has(key)) return;
        existingKeys.add(key);

        db.companies.push({
          id: generateId(company, l.Website),
          Company: company,
          Category: cat.category,
          Website: l.Website || "Not public",
          Email: l.Email || "Not public",
          Phone: l.Phone || "Not public",
          ContactPerson: l.ContactPerson || "Not public",
          Status: "New",
          Notes: l.Notes || "",
          SourceURL: l.SourceURL || "",
          DateAdded: today
        });
        addedInCat++;
        totalAdded++;
      });

      console.log(`  -> ${addedInCat} new lead(s) added`);
    }

    // Incremental checkpointing per category to protect runner state
    db.meta.lastRun = new Date().toISOString();
    db.meta.lastRunAdded = totalAdded;
    db.meta.totalCompanies = db.companies.length;
    await saveDatabase(db);

    await delay(BATCH_DELAY_MS);
  }

  console.log(`\nSearch execution complete. Added ${totalAdded} new lead(s). Total database size: ${db.companies.length}.`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
