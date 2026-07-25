/* ============================================================
   scripts/auto-buyer-search5.mjs
   HIGH-RECALL COMBINATORIAL BUYER DISCOVERY & DEDUPLICATION ENGINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

const TIMEOUT_MS = 10000;
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

async function searchWeb(query) {
  if (!TAVILY_API_KEY) return [];
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 15 // Maximized to pull deep result sets
      })
    });
    if (res && res.ok) {
      const data = await res.json();
      return (data.results || []).map((r) => ({
        title: r.title || "",
        content: r.content || "",
        url: r.url || ""
      }));
    }
  } catch {}
  return [];
}

// String Normalization for High-Precision Fuzzy Deduplication
function normalizeCompanyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(pvt|ltd|limited|llp|corporation|corp|company|co|inc|group|industries|associates)\b/g, "")
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Check if two company names are fuzzy matches based on token overlap
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
  return common >= 2; // If 2+ significant words match, consider duplicate
}

async function extractCompaniesViaGemini(snippets, location) {
  if (!GEMINI_API_KEY || snippets.length === 0) return [];
  
  const prompt = `You are a data extraction engine. Analyze these search results and extract a list of distinct commercial entities, real estate buyers, builders, investors, or corporate organizations located in or active around ${location}.
  
  Snippets:
  ${JSON.stringify(snippets)}
  
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
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }, 10000);

    if (res && res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
      const cleanedJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanedJson);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
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

  // Combinatorial Search Matrix covering diverse entity verticals to ensure zero blind spots
  const queryMatrix = [
    `top real estate developers builders promoters investors ${location}`,
    `commercial property buyers industrial enterprises corporate offices ${location}`,
    `major hospital trusts educational institutions manufacturing units ${location}`,
    `high net worth business syndicates commercial real estate buyers Alagar Kovil Highway ${location}`,
    `chambers of commerce business associations industrial estates ${location}`
  ];

  console.log(`Starting combinatorial high-recall buyer search across ${queryMatrix.length} query vectors...`);

  let newlyDiscoveredCount = 0;

  for (const query of queryMatrix) {
    console.log(`Executing query matrix node: "${query}"`);
    const results = await searchWeb(query);
    if (results.length === 0) continue;

    const extracted = await extractCompaniesViaGemini(results, location);

    for (const item of extracted) {
      if (!item.Company || item.Company.length < 3) continue;

      // Check against existing database using fuzzy token matching
      const exists = existingCompanies.some((existing) => isDuplicate(existing.Company, item.Company));

      if (!exists) {
        // Add new record with baseline schema compatible with enrichment engine
        existingCompanies.push({
          Company: item.Company,
          Website: item.Website || "Not public",
          Mobile: "Not public",
          WhatsApp: "Not public",
          City: item.City || location,
          RetryCount: 0
        });
        newlyDiscoveredCount++;
        console.log(`[New Entity Discovered] Added: ${item.Company}`);
      }
    }

    await delay(1500); // Rate limit protection between query nodes
  }

  data.companies = existingCompanies;
  await saveDatabase(data);
  console.log(`Search complete. Successfully discovered and added ${newlyDiscoveredCount} new unique entities.`);
}

main().catch((e) => {
  console.error("Fatal search error:", e.message);
  process.exit(1);
});
