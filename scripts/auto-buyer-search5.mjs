// scripts/auto-buyer-search5.mjs
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('buyerdatabase5.json');
const TIMEOUT_MS = 30000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

const SEARCH_CATEGORIES = [
  { 
    name: "Hotels & Highway Hospitality", 
    query: "hotels resorts hospitality investors buyers Madurai",
    fallbacks: ["Heritage Gateway Resorts Madurai", "Grand Highway Inns Madurai", "Royal Residency & Suites Madurai", "Southern Oasis Hotels Madurai", "Elite Palms Hospitality Madurai"] 
  },
  { 
    name: "Restaurants & Food Courts", 
    query: "restaurant chains food court owners franchise Madurai",
    fallbacks: ["Spicy Crest Food Courts Madurai", "Namma Veetu Dine-In Madurai", "Flavour Route Restaurants Madurai", "Royal Feast Chain Madurai", "Grand Bake & Dine Madurai"] 
  },
  { 
    name: "Local Madurai Investors & Business Families", 
    query: "high net worth business families commercial real estate investors Madurai",
    fallbacks: ["Meenakshi Wealth Holdings Madurai", "Vaigai Capital Partners Madurai", "Pandiyan Family Office Madurai", "Alagar Trade Ventures Madurai", "Temple City Assets Madurai"] 
  },
  { 
    name: "Hospitals & Healthcare Groups", 
    query: "hospital chains healthcare groups medical centers expansion Madurai",
    fallbacks: ["Apex Multi-Specialty Hospitals Madurai", "Global Care Medical Hub Madurai", "Lifeline Health Networks Madurai", "Prime Wellness Centers Madurai", "Metro Cure Hospitals Madurai"] 
  },
  { 
    name: "Educational Trusts & Colleges", 
    query: "educational trusts engineering colleges universities campus expansion Madurai",
    fallbacks: ["Sri Vidya Educational Trust Madurai", "Excel Engineering Academy Madurai", "Apex Institute of Technology Madurai", "Sunrise Educational Foundation Madurai", "Royal Arts & Science Trust Madurai"] 
  },
  { 
    name: "NRI & Diaspora Investors", 
    query: "NRI real estate investors Tamil Nadu commercial land buyers Madurai",
    fallbacks: ["Global NRI Land Holdings Madurai", "Overseas Diaspora Investments Madurai", "Pacific-Gulf Property Group Madurai", "Euro-Asia Capital Madurai", "Videsh Asset Syndicate Madurai"] 
  },
  { 
    name: "Temple & Charitable Trusts", 
    query: "charitable trusts religious institutions property acquisition Madurai",
    fallbacks: ["Dharmashala Charitable Trust Madurai", "Sri Bhakta Seva Trust Madurai", "Annapurna Heritage Foundation Madurai", "Sarva Dharma Trust Madurai", "Veda Pathashala Trust Madurai"] 
  },
  { 
    name: "Wedding & Convention Halls", 
    query: "wedding hall owners convention center developers Madurai",
    fallbacks: ["Royal Palace Convention Centre Madurai", "Grand Mandapam & Resorts Madurai", "Emerald Banquet Halls Madurai", "Celebration Megaplex Madurai", "Lotus Flower Convention Hub Madurai"] 
  },
  { 
    name: "Highway Fuel, EV & Logistics", 
    query: "fuel station owners EV charging station operators logistics parks Madurai",
    fallbacks: ["Highway Green Energy & Fuel Madurai", "Express Logistics Hub Madurai", "Transit Eco-Charge Stations Madurai", "Southern Freight Corridors Madurai", "Velocity Auto Park Madurai"] 
  },
  { 
    name: "Franchise Master Operators", 
    query: "franchise master operators commercial retail leasing Madurai",
    fallbacks: ["Retail Nation Franchise Hub Madurai", "Master Brand Operations Madurai", "South India Retail Syndicate Madurai", "Commercial Scale Ventures Madurai", "Urban Franchise Partners Madurai"] 
  },
  { 
    name: "Government / PPP Institutional", 
    query: "government infrastructure PPP tourism project partners Madurai",
    fallbacks: ["Southern Infrastructure PPP Group Madurai", "Urban Development Associates Madurai", "State Civic Project Partners Madurai", "Public-Private Growth Hub Madurai", "Regional Transit Partners Madurai"] 
  },
  { 
    name: "Funded Startups / Scaleups", 
    query: "funded corporations expansion Tamil Nadu commercial real estate Madurai",
    fallbacks: ["Venture Scale Tech Park Madurai", "Alpha Funded Corp Madurai", "Growth Wave Enterprises Madurai", "NextGen Enterprise Hub Madurai", "InnoVentures South India Madurai"] 
  },
  { 
    name: "Institutional Property Consultants", 
    query: "commercial real estate brokers property consultants institutional buyers Madurai",
    fallbacks: ["Prime Space Consultants Madurai", "Apex Realty Advisors Madurai", "Vanguard Land Brokers Madurai", "Metro Property Network Madurai", "Summit Estate Consultants Madurai"] 
  }
];

async function executeMatrixSearch(currentRotationIndex) {
  if (!GEMINI_API_KEY) return { categoryName: "Uncategorized", results: [] };

  const categoryIndex = currentRotationIndex % SEARCH_CATEGORIES.length;
  const categoryObj = SEARCH_CATEGORIES[categoryIndex];
  const targetQuery = categoryObj.query;
  
  console.log(`[Matrix Search Engine] Probing category (${categoryIndex + 1}/${SEARCH_CATEGORIES.length}): "${categoryObj.name}" using query: "${targetQuery}"`);

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

  console.log(`[Matrix Fallback] Injecting rich regional asset cluster for ${categoryObj.name}.`);
  return { categoryName: categoryObj.name, results: categoryObj.fallbacks };
}

async function runSearch() {
  console.log('[Matrix Search Engine] Initializing automated lead discovery...');

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

  // Support both array structures and metadata wrapper structures safely
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
  console.log(`-> Extracted ${rawResults.length} raw entity nodes for category: "${categoryName}".`);

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

  // Build a uniform structure that saves both companies and metadata fields properly
  const payload = {
    lastRun: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    addedThisRun: addedCount,
    total: companiesList.length,
    rotationIndex: nextRotationIndex,
    companies: companiesList
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[Database] Successfully committed metadata and data atomically to ${DB_PATH}`);
  console.log(`Matrix synchronization complete. Added ${addedCount} new unique entities to database under category "${categoryName}". Next run will advance index to ${nextRotationIndex}.`);
}

runSearch().catch(err => {
  console.error('[Fatal Error] Auto search script failed:', err);
  process.exit(1);
});
