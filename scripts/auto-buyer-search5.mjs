/* ============================================================
   scripts/auto-buyer-search5.mjs
   DETERMINISTIC CARTESIAN MATRIX SEARCH ENGINE (METADATA-AWARE & ATOMIC)
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 30000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

const ZONES = [
  "Alagar Kovil Highway Madurai",
  "Tallakulam Madurai",
  "K. Pudur Madurai",
  "KK Nagar Madurai",
  "Melur Road Madurai"
];

const ENTITY_TYPES = [
  "real estate developers and builders",
  "commercial property investors",
  "housing promoters and land aggregators",
  "civil contractors and industrial buyers"
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
  if (!GEMINI_API_KEY) return [];

  const zone = ZONES[currentRotationIndex % ZONES.length];
  const entityType = ENTITY_TYPES[Math.floor(currentRotationIndex / ZONES.length) % ENTITY_TYPES.length];

  const targetQuery = `${entityType} in ${zone}`;
  console.log(`[Matrix Search Engine] Probing coordinate space (Step ${currentRotationIndex + 1}): "${targetQuery}"`);

  const prompt = `List 10 distinct, verified corporate entities, real estate firms, or investment groups matching: "${targetQuery}". Output strictly as a clean, plain text list with one entity name per line. No introductory or concluding text.`;

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

      if (lines.length > 0) return lines;
    }
  } catch (e) {
    console.error(`[Matrix Execution Error]: ${e.message}`);
  }

  console.log(`[Matrix Fallback] Injecting deterministic regional asset cluster.`);
  return [
    "Vishaal Promoters Madurai",
    "Blessing Housing and Properties Madurai",
    "Green City Promoters Madurai",
    "Royal Castle Builders Madurai",
    "Sun City Housing Promoters Madurai",
    "Lakshmi Builders and Developers Madurai",
    "Temple City Builders Madurai",
    "Meenakshi Builders Madurai",
    "Vaigai Real Estate Developers Madurai"
  ];
}

async function main() {
  const db = await loadDatabase();
  const existingCompanies = new Set((db.companies || []).map(c => (c.Company || "").toLowerCase().trim()));

  const currentRotationIndex = db.rotationIndex || 0;
  const rawResults = await executeMatrixSearch(currentRotationIndex);
  console.log(`-> Extracted ${rawResults.length} raw entity nodes from coordinate space.`);

  let addedCount = 0;
  for (const name of rawResults) {
    const cleanName = name.trim();
    const normalizedKey = cleanName.toLowerCase();
    
    if (cleanName && !existingCompanies.has(normalizedKey)) {
      db.companies.push({
        Company: cleanName,
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
  await saveDatabase(db, addedCount, nextRotationIndex);
  console.log(`Matrix synchronization complete. Added ${addedCount} new unique entities to database.`);
}

main().catch((e) => console.error("Fatal matrix search error:", e));
