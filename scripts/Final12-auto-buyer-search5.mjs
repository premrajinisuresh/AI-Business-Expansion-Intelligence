/* ============================================================
   scripts/auto-buyer-search5.mjs
   Runs inside GitHub Actions on a schedule (see the workflow
   file .github/workflows/auto-buyer-search5.yml).

   UPDATED (v3): Job stays focused on SEARCHING and finding new
   companies only. Real contact-detail scraping (emails, phones,
   addresses, social links) is handled properly by the separate
   "Enrich Buyers V6" workflow -- doing it here too would be
   redundant and slow this job down for no benefit.

   Two real fixes kept from the last review:
   1. A few results (Johns Hopkins, Illinois hospital, etc.) were
      clearly outside India -> added an explicit, strict
      "India only" rule so the AI hard-rejects non-India results.
   2. The same real company (e.g. NHEV) was being added multiple
      times because its Website field was sometimes the homepage,
      sometimes a sub-page -> dedup now compares just the domain
      name, not the full URL, so the same company is always
      recognized as already-added.

   NEW: the "India only" rule above lives in the AI prompt, which
   is usually right but not 100% reliable (a Las Vegas hospital
   still slipped through once). Added a second, code-level backup
   check: for categories that require a real Tamil Nadu presence
   (hotels, hospitals, restaurants, etc. - NOT the categories where
   an overseas HQ is expected, like NRI investors or franchises),
   if the AI's own Company/Notes text mentions an obviously foreign
   place, the lead is skipped before ever being saved. This reuses
   the exact same rule as the enrichment/cleanup scripts so all
   three stay in agreement about what counts as "foreign".

   Needs these 2 GitHub repo secrets (Settings > Secrets and
   variables > Actions):
     TAVILY_API_KEY   - free, from https://tavily.com (no card)
     GEMINI_API_KEY   - free, from https://aistudio.google.com/apikey
   ============================================================ */

import fs from "fs";
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

const PROPERTY_BRIEF =
  "THE PLOT: 23.5 Cents Prime Corner Commercial Land at Alagarkovil, Madurai, Tamil Nadu, INDIA " +
  "(16 km from Madurai City), facing Alagarkovil Road and Natham-Alanganallur High Road. " +
  "Corner plot, four-lane highway frontage, bus stop in front, on a tourism corridor (Alagar " +
  "Kovil Temple, Alanganallur Jallikattu) and an education corridor. Budget expected: Rs 5-10 " +
  "Crore or more. Outright sale only, no brokers, no JV, no lease.";

const CATEGORIES = [
  { category: "Hotels & Highway Hospitality", query: "hotel chain expansion Madurai Tamil Nadu India highway new branch contact" },
  { category: "Restaurants & Food Courts", query: "restaurant chain food court expansion Madurai Tamil Nadu India highway contact" },
  { category: "Local Madurai Investors & Business Families", query: "Madurai Tamil Nadu India business family investor commercial land contact" },
  { category: "Hospitals & Healthcare Groups", query: "hospital chain healthcare group expansion Madurai Tamil Nadu India new branch contact" },
  { category: "Educational Trusts & Colleges", query: "engineering arts aviation catering college new campus Madurai Tamil Nadu India trust contact" },
  { category: "NRI & Diaspora Investors", query: "NRI investor Tamil Nadu India native place real estate association contact" },
  { category: "Temple & Charitable Trusts", query: "temple trust charitable trust Tamil Nadu India land purchase contact" },
  { category: "Wedding & Convention Halls", query: "wedding convention hall banquet brand Madurai Tamil Nadu India expansion contact" },
  { category: "Highway Fuel, EV & Logistics", query: "fuel station EV charging logistics warehousing company Tamil Nadu India highway expansion contact" },
  { category: "Franchise Master Operators", query: "franchise master operator expansion Tamil Nadu India tier 2 town contact" },
  { category: "Government / PPP Institutional", query: "government tourism corporation PPP land Madurai Tamil Nadu India contact" },
  { category: "Funded Startups / Scaleups", query: "funded startup expansion Tamil Nadu India physical location contact" },
  { category: "Institutional Property Consultants", query: "hospital college hotel real estate consultant institutional property advisor Tamil Nadu India buy sell contact" }
];

async function tavilySearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      country: "india",
      max_results: 8
    })
  });

  if (!res.ok) {
    console.error(`Tavily search failed for "${query}": ${res.status} ${await res.text()}`);
    return [];
  }

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
    `INTO India/Tamil Nadu. If an organization is headquartered in the USA, UK, or any country ` +
    `other than India with no India connection, DO NOT include it, even if it otherwise matches ` +
    `the category. When in doubt, leave it out.\n\n` +
    `From ONLY the information above, extract real organizations that could genuinely be ` +
    `prosperous buyers. Exclude brokers, property listing/aggregator sites, and generic news ` +
    `aggregators.${consultantNote} For each organization, output an object with fields: Company, ` +
    `Website, Email, Phone, ContactPerson, Notes, SourceURL. Use the exact string "Not public" ` +
    `for any field that is not clearly present in the search results — never invent an email or ` +
    `phone number. (A separate enrichment step will visit each website directly afterward to fill ` +
    `in real contact details, so it's fine to leave these as "Not public" for now.)\n\n` +
    `Respond with ONLY a valid JSON array of these objects, no markdown formatting, no commentary.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    console.error(`Gemini call failed for "${category}": ${res.status} ${await res.text()}`);
    return [];
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Could not parse Gemini output for "${category}":`, e.message);
    console.error("Raw text was:", text);
    return [];
  }
}

function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    return { meta: {}, companies: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch (e) {
    console.error("Could not parse existing database, starting fresh:", e.message);
    return { meta: {}, companies: [] };
  }
}

function domainOf(website) {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) {
    return (website || "").toLowerCase();
  }
}

function mergeLeads(db, newLeads, category) {
  const existingKeys = new Set(
    db.companies.map((c) => `${(c.Company || "").toLowerCase().trim()}|${domainOf(c.Website || "")}`)
  );
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;
  let rejectedForeign = 0;

  newLeads.forEach((l) => {
    const company = (l.Company || "").trim();
    if (!company) return;

    // Code-level backup to the AI's own "India only" instruction:
    // if this category requires a physical Tamil Nadu presence and
    // the AI's own description text mentions an obviously foreign
    // place, skip it rather than trust the prompt alone.
    if (isLocationBoundCategory(category)) {
      const descriptiveText = `${company} ${l.Notes || ""}`;
      if (looksForeign(descriptiveText)) {
        rejectedForeign++;
        return;
      }
    }

    const key = `${company.toLowerCase()}|${domainOf(l.Website || "")}`;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);

    db.companies.push({
      id: "auto_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
      Company: company,
      Category: category,
      Website: l.Website || "Not public",
      Email: l.Email || "Not public",
      Phone: l.Phone || "Not public",
      ContactPerson: l.ContactPerson || "Not public",
      Status: "New",
      Notes: l.Notes || "",
      SourceURL: l.SourceURL || "",
      DateAdded: today
    });
    added++;
  });

  if (rejectedForeign > 0) {
    console.log(`  -> ${rejectedForeign} lead(s) rejected as foreign for "${category}"`);
  }

  return added;
}

// Matches the same mobile-shape as Enrich (allows a space/hyphen
// after the 5th digit, e.g. "98841 98930", not just solid blocks).
const MOBILE_SHAPE_REGEX = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

function extractMobileShaped(text) {
  const m = String(text || "").match(MOBILE_SHAPE_REGEX);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return "91" + last10;
}

// RESCUE STEP: many small Indian businesses have no website at all,
// but DO have a phone number listed on a business directory (JustDial,
// Sulekha, IndiaMART, etc.) -- these are normal, plain webpages, not
// Google's special Business Profile panel, so searching and reading
// them is the same as visiting any other site. One extra free Tavily
// search per rescue attempt; capped per run so it can never come
// close to using up the monthly free search budget.
async function tryPhoneRescue(companyName) {
  const query = `${companyName} Madurai Tamil Nadu phone number contact justdial sulekha indiamart directory listing`;
  const results = await tavilySearch(query);
  for (const r of results) {
    const combined = `${r.title} ${r.snippet}`;
    const phone = extractMobileShaped(combined);
    if (phone) {
      return { phone, source: r.link };
    }
  }
  return null;
}

const MAX_PHONE_RESCUE_PER_RUN = 10;

async function main() {
  const db = loadDatabase();
  db.meta = db.meta || {};
  db.companies = db.companies || [];

  let totalAdded = 0;
  let phoneRescuesUsed = 0;

  for (const cat of CATEGORIES) {
    console.log(`Searching: ${cat.category} ...`);
    const results = await tavilySearch(cat.query);
    console.log(`  -> ${results.length} web result(s)`);

    if (results.length > 0) {
      const leads = await extractLeadsWithGemini(cat.category, results);

      // HARD filter, in code, not just a prompt instruction: Gemini
      // was still including companies with no real website roughly
      // half the time despite being told not to (a text instruction
      // is a suggestion to an AI, not a guarantee). This line makes
      // it an absolute rule instead: no website, no save, no
      // exceptions -- since Enrich can never find a phone number
      // for a company it has no page to visit.
      const leadsWithRealWebsite = leads.filter((l) => {
        const w = (l.Website || "").trim();
        return w !== "" && w.toLowerCase() !== "not public";
      });
      const droppedLeads = leads.filter((l) => {
        const w = (l.Website || "").trim();
        return w === "" || w.toLowerCase() === "not public";
      });

      // Before giving up on a website-less company entirely, try one
      // rescue search for its phone number on a business directory.
      // Capped globally per run so this can never meaningfully eat
      // into the monthly free search budget.
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
            Notes: (lead.Notes || "") + " (phone found via business directory, no company website)"
          });
        }
      }
      if (rescued.length > 0) {
        console.log(`  -> Rescued ${rescued.length} website-less lead(s) via directory phone lookup`);
      }

      const finalLeads = [...leadsWithRealWebsite, ...rescued];
      const droppedForNoWebsite = leads.length - finalLeads.length;
      if (droppedForNoWebsite > 0) {
        console.log(`  -> Dropped ${droppedForNoWebsite} lead(s) with no real website and no rescueable phone number`);
      }

      const added = mergeLeads(db, finalLeads, cat.category);
      console.log(`  -> ${added} new lead(s) added`);
      totalAdded += added;
    }

    await new Promise((r) => setTimeout(r, 4000));
  }

  db.meta.lastRun = new Date().toISOString();
  db.meta.lastRunAdded = totalAdded;
  db.meta.totalCompanies = db.companies.length;

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`\nDone. Added ${totalAdded} new lead(s). Database now has ${db.companies.length} total.`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
