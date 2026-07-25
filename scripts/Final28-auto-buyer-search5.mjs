/* ============================================================
   scripts/auto-buyer-search5.mjs
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 25000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    console.error(`[Fetch Error] ${error.message}`);
    clearTimeout(timer);
    return null;
  }
}

async function searchAndExtractViaGemini(query, location) {
  if (!GEMINI_API_KEY) {
    console.error("[Error] GEMINI_API_KEY is missing!");
    return [];
  }

  const prompt = `Search for and extract a list of distinct commercial entities, real estate buyers, builders, investors, or corporate organizations located in or active around ${location} matching this query: "${query}".
  
  Respond with ONLY a valid JSON array of objects with these exact keys:
  [
    {"Company": "Name here", "Website": "URL or 'Not public'", "City": "${location}"}
  ]
  If none found, return []. No markdown outside json.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      })
    }, TIMEOUT_MS);

    if (res && res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
      const cleanedJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanedJson);
      return Array.isArray(parsed) ? parsed : [];
    } else {
      const errText = res ? await res.text() : "No response";
      console.error(`[Gemini Search Error] Status: ${res?.status}, Body: ${errText}`);
    }
  } catch (e) {
    console.error(`[Gemini Search Exception] ${e.message}`);
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

  const queries = [
    `top real estate developers builders promoters investors Madurai`,
    `commercial property buyers industrial enterprises corporate offices Madurai`,
    `major hospital trusts educational institutions manufacturing units Madurai`,
    `high net worth business syndicates commercial real estate Alagar Kovil Highway Madurai`,
    `chambers of commerce business associations industrial estates Madurai`
  ];

  console.log(`Starting Gemini Google-grounded search across ${queries.length} queries...`);
  let newlyDiscoveredCount = 0;

  for (const query of queries) {
    console.log(`Executing query via Gemini Search: "${query}"`);
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
    await delay(2000);
  }

  data.companies = existingCompanies;
  await saveDatabase(data);
  console.log(`Search complete. Added ${newlyDiscoveredCount} new entities.`);
}

main().catch((e) => console.error("Fatal search error:", e));
