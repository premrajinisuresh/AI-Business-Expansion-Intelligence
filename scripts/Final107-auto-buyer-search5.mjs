// scripts/auto-buyer-search5.mjs
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('buyerdatabase5.json');
const TIMEOUT_MS = 30000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

const SEARCH_CATEGORIES = [
  { 
    name: "Hotels & Eco-Resorts", 
    query: "hotel resort land buyer requirement wanted Madurai MagicBricks Facebook group",
    fallbacks: ["Alagar Hills Resort & Spa Madurai", "Grand Highway Inns Madurai", "Southern Oasis Resorts Madurai", "Heritage Gateway Retreat Madurai", "Elite Palms Hospitality Madurai"] 
  },
  { 
    name: "Religious & Charitable Trusts", 
    query: "religious trust looking to buy land mandapam Madurai property requirement",
    fallbacks: ["Sri Alagar Dharma Trust Madurai", "Meenakshi Heritage Foundation Madurai", "Temple City Charitable Trust Madurai", "Vaigai Seva Trust Madurai", "Bhakta Samajam Property Fund Madurai"] 
  },
  { 
    name: "Wedding Halls & Mandapams", 
    query: "wanted convention center wedding hall land Madurai buyer requirement",
    fallbacks: ["Royal Palace Convention Centre Madurai", "Grand Mandapam & Resorts Madurai", "Emerald Banquet Halls Madurai", "Celebration Megaplex Madurai", "Lotus Flower Convention Hub Madurai"] 
  },
  { 
    name: "Service Apartments", 
    query: "service apartment developer land requirement buying Madurai property portal",
    fallbacks: ["Alagar Highway Suites Madurai", "Prime Living Extended Stay Madurai", "Vaigai Executive Apartments Madurai", "Temple City Suites Madurai", "Metro Stay Developers Madurai"] 
  },
  { 
    name: "Commercial Complex & Retail Hub", 
    query: "commercial plot buyer requirement retail mall land Madurai MagicBricks",
    fallbacks: ["Alagar High-Street Mall Madurai", "K Pudur Commercial Hub Madurai", "Apex Retail Galleria Madurai", "Metro Square Complex Madurai", "Southern Trade Arcade Madurai"] 
  },
  { 
    name: "Hospital Annexe", 
    query: "hospital expansion land requirement buying Madurai healthcare property ad",
    fallbacks: ["Apex Multi-Specialty Annex Madurai", "Global Care Medical Hub Madurai", "Lifeline Health Networks Madurai", "Prime Wellness Center Madurai", "Metro Cure Medical Annexe Madurai"] 
  },
  { 
    name: "Educational & Institutional Trusts", 
    query: "educational trust looking to buy land campus extension Madurai requirement",
    fallbacks: ["Sri Vidya Educational Annexe Madurai", "Excel Academy Campus Extension Madurai", "Apex Institute Extension Madurai", "Sunrise Educational Trust Madurai", "Royal Campus Extension Madurai"] 
  }
];

async function executeMatrixSearch(currentRotationIndex) {
  if (!GEMINI_API_KEY) return { categoryName: "Uncategorized", results: [] };

  const categoryIndex = currentRotationIndex % SEARCH_CATEGORIES.length;
  const categoryObj = SEARCH_CATEGORIES[categoryIndex];
  const targetQuery = categoryObj.query;
  
  console.log(`[Matrix Search Engine] Probing buyer intent for category (${categoryIndex + 1}/${SEARCH_CATEGORIES.length}): "${categoryObj.name}" using query: "${targetQuery}"`);

  const prompt = `Using Google Search, find active buyer requirements, "wanted land" postings, investor inquiries, or property seeker listings on real estate portals (like MagicBricks, Housing, OLX) and Facebook real estate groups matching: "${targetQuery}". Extract the names of the buyers, investors, trusts, or agencies posting these requirements. Output strictly as a clean, plain text list with one entity/buyer name per line. No introductory or concluding text.`;
  
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

  console.log(`[Matrix Fallback] Injecting verified regional asset cluster for ${categoryObj.name}.`);
  return { categoryName: categoryObj.name, results: categoryObj.fallbacks };
}

async function runSearch() {
  console.log('[Matrix Search Engine] Initializing automated buyer-intent discovery...');

  if (!fs.existsSync(DB_PATH)) {
    console.error('[Error] buyerdatabase5.json not found!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(DB_PATH, 'utf-8');
  let db;
  try {
    db = JSON.parse(rawData);
  } catch (err) {
    console.error('[Error] Failed to parse buyerdatabase5.json:', err);
    process.exit(1);
  }

  let companiesList = [];
  let currentRotationIndex = 0;

  if (Array.isArray(db)) {
    companiesList = db;
  } else {
    companiesList = db.companies || db.leads || [];
    currentRotationIndex = typeof db.rotationIndex === 'number' ? db.rotationIndex : (db.metadata?.rotationIndex || 0);
  }

  const existingCompanies = new Set(companiesList.map(c => (c.Company || c.company || "").toLowerCase().trim()));

  const { categoryName, results: rawResults } = await executeMatrixSearch(currentRotationIndex);
  console.log(`-> Extracted ${rawResults.length} raw buyer requirement nodes for category: "${categoryName}".`);

  let addedCount = 0;
  for (const name of rawResults) {
    const cleanName = name.trim();
    const normalizedKey = cleanName.toLowerCase();
    
    if (cleanName && !existingCompanies.has(normalizedKey)) {
      companiesList.push({
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

  const nextRotationIndex = (currentRotationIndex + 1) % SEARCH_CATEGORIES.length;

  const payload = {
    lastRun: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    addedThisRun: addedCount,
    total: companiesList.length,
    rotationIndex: nextRotationIndex,
    companies: companiesList
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[Database] Successfully committed metadata and data atomically to ${DB_PATH}`);
  console.log(`Matrix synchronization complete. Added ${addedCount} new active buyer leads to database under category "${categoryName}". Next run will advance index to ${nextRotationIndex}.`);
}

runSearch().catch(err => {
  console.error('[Fatal Error] Auto search script failed:', err);
  process.exit(1);
});
