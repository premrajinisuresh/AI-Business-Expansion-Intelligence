/* ============================================================
   scripts/auto-buyer-search5.mjs
   SINGLE-QUERY ROTATING FREE-TIER SEARCH ENGINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 30000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchAndExtractViaGemini(query, location) {
  if (!GEMINI_API_KEY) return [];

  const prompt = `Search for and extract a list of distinct commercial entities, real estate buyers, builders, investors, hospital trusts, educational institutions, and corporate organizations located in or active around ${location} matching: "${query}".
  
  Respond with ONLY a valid JSON array of objects with these exact keys:
  [
    {"Company": "Name here", "Website": "URL or 'Not public'", "City": "${location}"}
  ]
  If none found, return []. No markdown outside json.`;

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
      const cleanedJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanedJson);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error(`[Search Exception] ${e.message}`);
  }
  return [];
}

function normalizeCompanyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(pvt|ltd|limited|llp|corporation|corp|company|co|inc|group|industries|associates)\b/g, "")
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicate(existingName, newName) {
  const norm1 = normalizeCompanyName(existingName);
  const norm2 = normalizeCompanyName(newName);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)) return true;

  const tokens1 = new Set(norm1.split(" "));
  const tokens2 = new Set(norm2.split(" "));
  let common = 0;
  for (const t of tokens1) {
    if (tokens2.has(t) && t.length > 2) common++;
  }
  return common >= 2;
}

async function loadDatabase() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { companies: [] };
  }
}

async function saveDatabase(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function main() {
  const data = await loadDatabase();
  const existingCompanies = data.companies || [];
  const location = "Madurai Tamil Nadu";

  // Single rotating query pool to minimize per-run API density
  const queryPool = [
    `top real estate developers builders promoters commercial property buyers Alagar Kovil Highway Madurai`,
    `major industrial enterprises corporate offices hospital trusts educational institutions Madurai`,
    `commercial real estate investors wholesale distributors industrial estates Madurai`
  ];

  // Pick one query based on current hour to rotate coverage safely
  const queryIndex = Math.floor(Date.now() / (1000 * 60 * 60)) % queryPool.length;
  const selectedQuery = queryPool[queryIndex];

  console.log(`Executing single-vector search: "${selectedQuery}"`);
  const extracted = await searchAndExtractViaGemini(selectedQuery, location);
  console.log(`-> Extracted ${extracted.length} entities.`);

  let newlyDiscoveredCount = 0;
  for (const item of extracted) {
    if (!item.Company || item.Company.length < 3) continue;
    const exists = existingCompanies.some((existing) => isDuplicate(existing.Company, item.Company));

    if (!exists) {
      existingCompanies.push({
        Company: item.Company,
        Website: item.Website || "Not public",
        Mobile: "Not public",
        WhatsApp: "Not public",
        City: item.City || location,
        RetryCount: 0
      });
      newlyDiscoveredCount++;
      console.log(`[Added] ${item.Company}`);
    }
  }

  data.companies = existingCompanies;
  await saveDatabase(data);
  console.log(`Search complete. Added ${newlyDiscoveredCount} new entities.`);
}

main().catch((e) => console.error("Fatal search error:", e));
