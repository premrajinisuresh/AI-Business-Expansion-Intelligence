/* ============================================================
   scripts/auto-buyer-search5.mjs
   ROBUST MULTI-VECTOR AUTOMATED BUYER SEARCH ENGINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 30000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

// Rotating pool of diverse search vectors to guarantee lead discovery
const SEARCH_VECTORS = [
  "top real estate developers and builders in Madurai Alagar Kovil Highway",
  "commercial property buyers and real estate investors Madurai",
  "top civil contractors, builders association members Madurai",
  "prominent land promoters and housing developers Madurai Tamil Nadu",
  "industrial property buyers and corporate real estate clients Madurai"
];

async function loadDatabase() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { companies: [] };
  }
}

async function saveDatabase(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function searchBuyers() {
  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    return [];
  }

  // Select vector based on day of year to ensure rotation across runs
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const queryVector = SEARCH_VECTORS[dayOfYear % SEARCH_VECTORS.length];

  console.log(`[Search Vector Rotation] Executing query: "${queryVector}"`);

  const prompt = `Search Google for real companies, firms, or active buyers matching: "${queryVector}".
  Extract up to 10 distinct entities.
  Respond with ONLY a valid JSON array of objects in this exact format:
  [
    {
      "Company": "Company Name",
      "City": "Madurai",
      "Website": "website URL or 'Not public'",
      "Mobile": "Not public",
      "WhatsApp": "Not public"
    }
  ]
  No markdown formatting outside the JSON array.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res && res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
      const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(`[Search Error]: ${e.message}`);
  }
  return [];
}

async function main() {
  const db = await loadDatabase();
  const existingCompanies = new Set((db.companies || []).map(c => (c.Company || "").toLowerCase().trim()));

  const rawResults = await searchBuyers();
  console.log(`-> Extracted ${rawResults.length} raw entities from search.`);

  let addedCount = 0;
  for (const item of rawResults) {
    const name = (item.Company || "").trim();
    if (name && !existingCompanies.has(name.toLowerCase())) {
      db.companies.push({
        Company: name,
        City: item.City || "Madurai",
        Website: item.Website || "Not public",
        Mobile: "Not public",
        WhatsApp: "Not public",
        RetryCount: 0
      });
      existingCompanies.add(name.toLowerCase());
      addedCount++;
    }
  }

  await saveDatabase(db);
  console.log(`Search complete. Added ${addedCount} new unique entities to database.`);
}

main().catch((e) => console.error("Fatal search error:", e));
