/* ============================================================
   scripts/auto-buyer-search5.mjs
   Runs inside GitHub Actions on a schedule (see the workflow
   file .github/workflows/auto-buyer-search5.yml).

   UPDATED AGAIN: Gemini's own "Google Search grounding" button
   turned out to require a paid/billing-enabled account — it
   returned 429 RESOURCE_EXHAUSTED immediately on a free key.
   So this version splits the job into two free tools:
     1. Tavily          - does the actual live web searching
                           (1,000 free searches/month, no card)
     2. Gemini (plain)  - reads Tavily's results and writes out
                           clean structured leads (free tier,
                           no grounding tool used, so no 429)

   What it does, every run:
   1. For each of 12 buyer categories, searches the live web
      using Tavily.
   2. Sends those raw search results to Gemini and asks it to
      pull out real organizations + any public contact details
      (never inventing anything).
   3. Merges new, non-duplicate leads into buyerdatabase5.json.
   4. The workflow then commits & pushes the updated file, which
      Cloudflare Pages (connected to this same GitHub repo) will
      automatically redeploy.

   Needs these 2 GitHub repo secrets (Settings > Secrets and
   variables > Actions):
     TAVILY_API_KEY   - free, from https://tavily.com (no card)
     GEMINI_API_KEY   - free, from https://aistudio.google.com/apikey
   ============================================================ */

import fs from "fs";

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

// Gemini model alias that auto-tracks Google's current recommended
// free-tier Flash model, so this script doesn't break every time
// Google renames/retires a specific model version.
const GEMINI_MODEL = "gemini-flash-latest";

const PROPERTY_BRIEF =
  "THE PLOT: 23.5 Cents Prime Corner Commercial Land at Alagarkovil, Madurai, Tamil Nadu " +
  "(16 km from Madurai City), facing Alagarkovil Road and Natham-Alanganallur High Road. " +
  "Corner plot, four-lane highway frontage, bus stop in front, on a tourism corridor (Alagar " +
  "Kovil Temple, Alanganallur Jallikattu) and an education corridor. Budget expected: Rs 5-10 " +
  "Crore or more. Outright sale only, no brokers, no JV, no lease.";

/* 12 buyer categories, each with its own search query */
const CATEGORIES = [
  { category: "Hotels & Highway Hospitality", query: "hotel chain expansion Madurai Tamil Nadu highway new branch contact" },
  { category: "Restaurants & Food Courts", query: "restaurant chain food court expansion Madurai Tamil Nadu highway contact" },
  { category: "Local Madurai Investors & Business Families", query: "Madurai business family investor commercial land contact" },
  { category: "Hospitals & Healthcare Groups", query: "hospital chain healthcare group expansion Madurai Tamil Nadu new branch contact" },
  { category: "Educational Trusts & Colleges", query: "engineering arts aviation catering college new campus Madurai Tamil Nadu trust contact" },
  { category: "NRI & Diaspora Investors", query: "NRI investor Tamil Nadu native place real estate association contact" },
  { category: "Temple & Charitable Trusts", query: "temple trust charitable trust Tamil Nadu land purchase contact" },
  { category: "Wedding & Convention Halls", query: "wedding convention hall banquet brand Madurai Tamil Nadu expansion contact" },
  { category: "Highway Fuel, EV & Logistics", query: "fuel station EV charging logistics warehousing company Tamil Nadu highway expansion contact" },
  { category: "Franchise Master Operators", query: "franchise master operator expansion Tamil Nadu tier 2 town contact" },
  { category: "Government / PPP Institutional", query: "government tourism corporation PPP land Madurai Tamil Nadu contact" },
  { category: "Funded Startups / Scaleups", query: "funded startup expansion Tamil Nadu physical location contact" }
];

/* ---------------------------------------------------------
   Tavily does the actual live web search (free, 1,000/month)
   --------------------------------------------------------- */
async function tavilySearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
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

/* ---------------------------------------------------------
   Gemini (plain, no grounding tool) reads Tavily's results
   and writes out structured leads. Stays inside Gemini's free
   tier since it never touches the paid grounding feature.
   --------------------------------------------------------- */
async function extractLeadsWithGemini(category, searchResults) {
  if (searchResults.length === 0) return [];

  const prompt =
    `You are building a buyer-lead database for a commercial land sale. ${PROPERTY_BRIEF}\n\n` +
    `Here are raw web search results for the category "${category}":\n` +
    JSON.stringify(searchResults, null, 2) +
    `\n\nFrom ONLY the information above, extract real organizations that could genuinely be ` +
    `prosperous buyers. Exclude brokers, property listing/aggregator sites, and generic news ` +
    `aggregators. For each organization, output an object with fields: Company, Website, Email, ` +
    `Phone, ContactPerson, Notes, SourceURL. Use the exact string "Not public" for any field ` +
    `that is not clearly present in the search results — never invent an email or phone number. ` +
    `Respond with ONLY a valid JSON array of these objects, no markdown formatting, no commentary.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] }; // no tools -> plain free-tier call

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

function mergeLeads(db, newLeads, category) {
  const existingKeys = new Set(
    db.companies.map((c) => `${(c.Company || "").toLowerCase()}|${(c.Website || "").toLowerCase()}`)
  );
  const today = new Date().toISOString().slice(0, 10);
  let added = 0;

  newLeads.forEach((l) => {
    const company = (l.Company || "").trim();
    if (!company) return;
    const key = `${company.toLowerCase()}|${(l.Website || "").toLowerCase()}`;
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

  return added;
}

async function main() {
  const db = loadDatabase();
  db.meta = db.meta || {};
  db.companies = db.companies || [];

  let totalAdded = 0;

  for (const cat of CATEGORIES) {
    console.log(`Searching: ${cat.category} ...`);
    const results = await tavilySearch(cat.query);
    console.log(`  -> ${results.length} web result(s)`);

    if (results.length > 0) {
      const leads = await extractLeadsWithGemini(cat.category, results);
      const added = mergeLeads(db, leads, cat.category);
      console.log(`  -> ${added} new lead(s) added`);
      totalAdded += added;
    }

    // Small delay to stay comfortably within free-tier rate limits.
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
