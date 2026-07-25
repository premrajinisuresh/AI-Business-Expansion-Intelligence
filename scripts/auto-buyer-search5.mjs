/* ============================================================
   scripts/auto-buyer-search5.mjs
   RATE-LIMIT RESILIENT GEMINI SEARCH ENGINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 30000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3, backoff = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (response.status === 429) {
        console.warn(`[Rate Limit 429] Encountered quota limit. Retrying in ${backoff / 1000}s (Attempt ${attempt}/${retries})...`);
        await delay(backoff);
        backoff *= 2; // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timer);
      if (attempt === retries) {
        console.error(`[Fetch Exception] ${error.message}`);
        return null;
      }
      await delay(backoff);
    }
  }
  return null;
}

async function searchAndExtractViaGemini(query, location) {
  if (!GEMINI_API_KEY) {
    console.error("[Error] GEMINI_API_KEY is missing!");
    return [];
  }

  const prompt = `Search for and extract a comprehensive list of distinct commercial entities, real estate buyers, builders, investors, hospital trusts, educational institutions, and corporate organizations located in or active around ${location} matching: "${query}".
  
  Respond with ONLY a valid JSON array of objects with these exact keys:
  [
    {"Company": "Name here", "Website": "URL or 'Not public'", "City": "${location}"}
  ]
  If none found, return []. No markdown outside json.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }]
    })
  });

  if (res && res.ok) {
    try {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
      const cleanedJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanedJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`[JSON Parse Error] ${e.message}`);
    }
  } else if (res) {
    const errText = await res.text();
    console.error(`[Gemini Error] Status: ${res.status}, Body: ${errText}`);
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

  // Consolidated high-yield queries to respect rate limits
  const queries = [
    `top real estate developers builders promoters commercial property buyers Alagar Kovil Highway Madurai`,
    `major industrial enterprises corporate offices hospital trusts educational institutions Madurai`
  ];

  console.log(`Starting resilient Gemini search across ${queries.length} query vectors...`);
  let newlyDiscoveredCount = 0;

  for (const query of queries) {
    console.log(`Executing query: "${query}"`);
    const extracted = await searchAndExtractViaGemini(query, location);
    console.log(`-> Extracted ${extracted.length} entities.`);

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
    // Safe delay between queries to prevent 429 quota blocks
    await delay(6000);
  }

  data.companies = existingCompanies;
  await saveDatabase(data);
  console.log(`Search complete. Added ${newlyDiscoveredCount} new entities.`);
}

main().catch((e) => console.error("Fatal search error:", e));
