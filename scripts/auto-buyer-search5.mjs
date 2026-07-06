/* ============================================================
   scripts/auto-buyer-search5.mjs
   Runs inside GitHub Actions on a schedule (see the workflow
   file .github/workflows/auto-buyer-search5.yml).

   UPDATED: Google shut down free "search the entire web" access
   for new Custom Search Engines (Jan 2026), so this script no
   longer uses Google CSE at all. Instead it uses Gemini's own
   built-in web search ("Google Search grounding") — one API,
   one free key, same result.

   What it does, every run:
   1. For each of 12 buyer categories, asks Gemini (with its
      google_search tool turned on) to search the live web itself
      and pull out real organizations + any public contact
      details (never inventing anything).
   2. Merges new, non-duplicate leads into buyerdatabase5.json.
   3. The workflow then commits & pushes the updated file, which
      Cloudflare Pages (connected to this same GitHub repo) will
      automatically redeploy.

   Needs only ONE GitHub repo secret (Settings > Secrets and
   variables > Actions):
     GEMINI_API_KEY   - free, from https://aistudio.google.com/apikey
   ============================================================ */

import fs from "fs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error(
    "Missing required secret: GEMINI_API_KEY. " +
    "Add it under repo Settings > Secrets and variables > Actions."
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

/* 12 buyer categories, each with its own search angle */
const CATEGORIES = [
  { category: "Hotels & Highway Hospitality", angle: "hotel chains expanding branches on Tamil Nadu highways" },
  { category: "Restaurants & Food Courts", angle: "restaurant chains and food courts expanding on Tamil Nadu highways" },
  { category: "Local Madurai Investors & Business Families", angle: "prosperous Madurai business families and investors buying commercial land" },
  { category: "Hospitals & Healthcare Groups", angle: "hospital chains and healthcare groups opening new branches in Madurai, Tamil Nadu" },
  { category: "Educational Trusts & Colleges", angle: "engineering, arts, aviation, or catering college trusts opening new campuses near Madurai" },
  { category: "NRI & Diaspora Investors", angle: "NRI investor associations from Madurai native place investing in real estate" },
  { category: "Temple & Charitable Trusts", angle: "temple trusts or charitable trusts in Tamil Nadu with surplus funds purchasing land" },
  { category: "Wedding & Convention Halls", angle: "wedding and convention hall brands expanding in Madurai, Tamil Nadu" },
  { category: "Highway Fuel, EV & Logistics", angle: "fuel station, EV charging, or logistics/warehousing companies expanding on Tamil Nadu highways" },
  { category: "Franchise Master Operators", angle: "franchise master operators expanding into Tamil Nadu tier-2 towns" },
  { category: "Government / PPP Institutional", angle: "government tourism corporations or PPP projects acquiring land near Madurai" },
  { category: "Funded Startups / Scaleups", angle: "recently funded startups or scaleups expanding physical locations in Tamil Nadu" }
];

/* ---------------------------------------------------------
   Ask Gemini to search the LIVE web itself (google_search tool)
   and directly return structured leads — one call per category,
   no separate search API involved.
   --------------------------------------------------------- */
async function findLeadsWithGemini(category, angle) {
  const prompt =
    `You are building a buyer-lead database for a commercial land sale. ${PROPERTY_BRIEF}\n\n` +
    `Use your live web search to find REAL, currently active organizations related to: ${angle}.\n\n` +
    `Only include genuinely prosperous organizations capable of an outright purchase of ` +
    `Rs 5-10 Crore or more. Exclude brokers, property listing/aggregator sites, and generic ` +
    `news aggregators. For each organization, extract only what you find on their own official ` +
    `website or in a reputable news source: Company, Website, Email, Phone, ContactPerson, Notes ` +
    `(why they fit), SourceURL. Use the exact string "Not public" for any field that is not ` +
    `clearly available — never invent an email or phone number.\n\n` +
    `Respond with ONLY a valid JSON array of these objects, no markdown formatting, no commentary, ` +
    `no surrounding text.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }] // <-- this is Gemini's own built-in live web search
  };

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
    console.log(`Researching: ${cat.category} ...`);
    const leads = await findLeadsWithGemini(cat.category, cat.angle);
    console.log(`  -> ${leads.length} candidate lead(s) from Gemini`);

    const added = mergeLeads(db, leads, cat.category);
    console.log(`  -> ${added} new lead(s) added`);
    totalAdded += added;

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
