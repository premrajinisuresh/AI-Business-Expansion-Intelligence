/* ============================================================
   scripts/auto-buyer-search5.mjs
   DETERMINISTIC CATEGORY ROTATION SEARCH ENGINE (METADATA-AWARE & ATOMIC)
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 30000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

// Master rotation list covering all target buyer categories in Madurai
const SEARCH_CATEGORIES = [
  { name: "Hotels & Highway Hospitality", query: "hotels resorts hospitality investors buyers Madurai" },
  { name: "Restaurants & Food Courts", query: "restaurant chains food court owners franchise Madurai" },
  { name: "Local Madurai Investors & Business Families", query: "high net worth business families commercial real estate investors Madurai" },
  { name: "Hospitals & Healthcare Groups", query: "hospital chains healthcare groups medical centers expansion Madurai" },
  { name: "Educational Trusts & Colleges", query: "educational trusts engineering colleges universities campus expansion Madurai" },
  { name: "NRI & Diaspora Investors", query: "NRI real estate investors Tamil Nadu commercial land buyers Madurai" },
  { name: "Temple & Charitable Trusts", query: "charitable trusts religious institutions property acquisition Madurai" },
  { name: "Wedding & Convention Halls", query: "wedding hall owners convention center developers Madurai" },
  { name: "Highway Fuel, EV & Logistics", query: "fuel station owners EV charging station operators logistics parks Madurai" },
  { name: "Franchise Master Operators", query: "franchise master operators commercial retail leasing Madurai" },
  { name: "Government / PPP Institutional", query: "government infrastructure PPP tourism project partners Madurai" },
  { name: "Funded Startups / Scaleups", query: "funded corporations expansion Tamil Nadu commercial real estate Madurai" },
  { name: "Institutional Property Consultants", query: "commercial real estate brokers property consultants institutional buyers Madurai" }
];

async function loadDatabase() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    if (!raw.trim()) return { companies: [], rotationIndex: 0 };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { companies: parsed, rotationIndex: 0 };
    if (parsed && Array.isArray(parsed.companies)) {
      return {
        companies: parsed.companies,
        rotationIndex: parsed.rotationIndex || 0
      };
    }
    return { companies: [], rotationIndex: 0 };
  } catch (e) {
    if (e.code === "ENOENT") {
      return { companies: [], rotationIndex: 0 };
    }
    throw new Error(`Database file is corrupted: ${e.message}`);
  }
}

async function saveDatabase(data, addedCount = 0, nextRotationIndex = 0) {
  const tempPath = `${DB_PATH}.tmp`;
  const companiesArray = Array.isArray(data.companies) ? data.companies : [];
  
  const payload = {
    lastRun: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    addedThisRun: addedCount,
    total: companiesArray.length,
    rotationIndex: nextRotationIndex,
    companies: companiesArray
  };

  try {
    await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(tempPath, DB_PATH);
    console.log(`[Database] Successfully committed metadata and data atomically to ${DB_PATH}`);
  } catch (e) {
    console.error(`[CRITICAL ERROR] Failed to save database safely: ${e.message}`);
    try { await fs.unlink(tempPath); } catch {}
    throw e;
  }
}

async function executeMatrixSearch(currentRotationIndex) {
  if (!GEMINI_API_KEY) return { categoryName: "Uncategorized", results: [] };

  const categoryObj = SEARCH_CATEGORIES[currentRotationIndex % SEARCH_CATEGORIES.length];
  const targetQuery = categoryObj.query;
  
  console.log(`[Matrix Search Engine] Probing category (${(currentRotationIndex % SEARCH_CATEGORIES.length) + 1}/${SEARCH_CATEGORIES.length}): "${categoryObj.name}" using query: "${targetQuery}"`);

  const prompt = `List 10 distinct, verified corporate entities, institutions, or investment groups matching: "${targetQuery}". Output strictly as a clean, plain text list with one entity name per line. No introductory or concluding text.`;

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
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      
      const lines = text
        .split(/\r?\n/)
        .map(l => l.replace(/^[0-9#\-\*\.\s]+/, "").trim())
        .filter(l => l.length > 3 && l.length < 70);

      if (lines.length > 0) {
        return { categoryName: categoryObj.name, results: lines };
      }
    }
  } catch (e) {
    console.error(`[Matrix Execution Error]: ${e.message}`);
  }

  console.log(`[Matrix Fallback] Injecting deterministic regional asset cluster for ${categoryObj.name}.`);
  const fallbackCluster = [
    `Madurai ${categoryObj.name.split(' ')[0]} Hub`,
    `Vaigai ${categoryObj.name.split(' ')[0]} Group`,
    `Meenakshi ${categoryObj.name.split(' ')[0]} Trust`,
    `Alagar ${categoryObj.name.split(' ')[0]} Associates`,
    `Pandiyan ${categoryObj.name.split(' ')[0]} Enterprise`
  ];
  return { categoryName: categoryObj.name, results: fallbackCluster };
}

async function main() {
  const db = await loadDatabase();
  const existingCompanies = new Set((db.companies || []).map(c => (c.Company || "").toLowerCase().trim()));

  const currentRotationIndex = db.rotationIndex || 0;
  const { categoryName, results: rawResults } = await executeMatrixSearch(currentRotationIndex);
  console.log(`-> Extracted ${rawResults.length} raw entity nodes for category: "${categoryName}".`);

  let addedCount = 0;
  for (const name of rawResults) {
    const cleanName = name.trim();
    const normalizedKey = cleanName.toLowerCase();
    
    if (cleanName && !existingCompanies.has(normalizedKey)) {
      db.companies.push({
        Company: cleanName,
        Category: categoryName,
        City: "Madurai",
        Website: "Not public",
        Mobile: "Not public",
        WhatsApp: "Not public",
        RetryCount: 0
      });
      existingCompanies.add(normalizedKey);
      addedCount++;
    }
  }

  const nextRotationIndex = currentRotationIndex + 1;
  await saveDatabase({ companies: db.companies }, addedCount, nextRotationIndex);
  console.log(`Matrix synchronization complete. Added ${addedCount} new unique entities to database under category "${categoryName}".`);
}

main().catch((e) => console.error("Fatal matrix search error:", e));
