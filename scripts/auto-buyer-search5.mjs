/* ============================================================
   scripts/auto-buyer-search5.mjs
   Runs inside GitHub Actions on a schedule (see the workflow
   file .github/workflows/auto-buyer-search5.yml).

   UPDATED (v3): fixes 3 problems found on 2026-07-16:
   1. Was only reading Tavily's short summary text, never the
      real page -> emails/phones that WERE publicly on a site's
      contact page were still being marked "Not public".
      FIX: now does a direct fetch of each result URL and pulls
      out any real email/phone found in the raw page text with
      simple pattern matching, and hands that to Gemini too.
   2. A few results (Johns Hopkins, Illinois hospital, etc.) were
      clearly outside India -> the AI wasn't told to hard-reject
      those. FIX: explicit, strict "India only" rule added below.
   3. The same real company (e.g. NHEV) was being added multiple
      times because its Website field was sometimes the homepage,
      sometimes a sub-page -> dedup key never matched.
      FIX: dedup now compares just the domain name, not the full
      URL, so the same company is recognized every time.

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
  { category: "Funded Startups / Scaleups", query: "funded startup expansion Tamil Nadu India physical location contact" }
];

/* ---------------------------------------------------------
   Tavily: now "advanced" depth + India country bias for
   fuller, better-targeted results.
   --------------------------------------------------------- */
async function tavilySearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      country: "india",
      max_results: 6
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
   NEW: actually visit each result's real page and pull out
   any email/phone sitting in the raw text -- this is the
   "open the book, not just read the cover" fix.
   --------------------------------------------------------- */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:\+91[-\s]?)?(?:\(?\d{2,4}\)?[-\s]?)?\d{4,6}[-\s]?\d{4,6}/g;

async function fetchRealContactInfo(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { emails: [], phones: [] };

    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, " "); // strip tags roughly

    const emails = [...new Set((text.match(EMAIL_PATTERN) || []).filter(
      (e) => !e.includes(".png") && !e.includes(".jpg") && !e.includes("example.com")
    ))].slice(0, 3);

    const phones = [...new Set((text.match(PHONE_PATTERN) || []).map((p) => p.trim()))]
      .filter((p) => p.replace(/\D/g, "").length >= 8)
      .slice(0, 3);

    return { emails, phones };
  } catch (e) {
    return { emails: [], phones: [] };
  }
}

/* ---------------------------------------------------------
   Gemini reads Tavily's summaries PLUS the real scraped
   contact info, and writes structured leads. Plain call,
   no grounding tool, stays in the free tier.
   --------------------------------------------------------- */
async function extractLeadsWithGemini(category, enrichedResults) {
  if (enrichedResults.length === 0) return [];

  const prompt =
    `You are building a buyer-lead database for a commercial land sale. ${PROPERTY_BRIEF}\n\n` +
    `Here are web search results for the category "${category}", each including the search ` +
    `summary AND any email/phone numbers found directly on the real page:\n` +
    JSON.stringify(enrichedResults, null, 2) +
    `\n\nSTRICT RULE: Only include organizations that are based in INDIA, or clearly expanding ` +
    `INTO India/Tamil Nadu. If an organization is headquartered in the USA, UK, or any country ` +
    `other than India with no India connection, DO NOT include it, even if it otherwise matches ` +
    `the category. When in doubt, leave it out.\n\n` +
    `From the information above, extract real organizations that could genuinely be prosperous ` +
    `buyers. Exclude brokers, property listing/aggregator sites, and generic news aggregators. ` +
    `For each organization, output an object with fields: Company, Website, Email, Phone, ` +
    `ContactPerson, Notes, SourceURL. Prefer the realEmails/realPhones values if present -- those ` +
    `were found directly on the organization's own page. Use the exact string "Not public" for ` +
    `any field that is not clearly available anywhere in the data -- never invent an email or ` +
    `phone number.\n\n` +
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

/* NEW: dedup by domain name only, not the full URL, so
   "https://nhev.in" and "https://nhev.in/about-us-ev" are
   correctly recognized as the SAME company. */
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

  newLeads.forEach((l) => {
    const company = (l.Company || "").trim();
    if (!company) return;
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
      // Visit each real page and try to pull out actual contact info.
      const enriched = [];
      for (const r of results) {
        const { emails, phones } = await fetchRealContactInfo(r.link);
        enriched.push({ ...r, realEmails: emails, realPhones: phones });
      }

      const leads = await extractLeadsWithGemini(cat.category, enriched);
      const added = mergeLeads(db, leads, cat.category);
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
