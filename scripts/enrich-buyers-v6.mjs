/* ============================================================
   scripts/enrich-buyers-v6.mjs
   DEBUG-ENABLED FLEXIBLE OSINT ENRICHMENT PIPELINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 25000;
const BASE_DELAY_MS = 12000;
const MAX_RETRY_COUNT = 3;
const PHONE_HUNT_MAX_PER_RUN = 15;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

const getJitteredDelay = (baseMs) => {
  const jitter = baseMs * 0.4 * (Math.random() - 0.5);
  return Math.floor(baseMs + jitter);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractContactNumber(text) {
  const str = String(text || "");
  
  // Clean out common formatting words to isolate digits
  const cleanedText = str.replace(/[^\d\s\-\+\(\)]/g, " ");
  
  // Find any sequence of 10 digits starting with 6-9 (Indian mobile) or landline prefixes
  const matches = cleanedText.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g);
  if (matches && matches.length > 0) {
    const digits = matches[0].replace(/\D/g, "");
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return "91" + last10;
  }

  // Fallback: look for any 10-digit block
  const generic10 = cleanedText.match(/\d{10}/g);
  if (generic10 && generic10.length > 0) {
    for (const num of generic10) {
      if (/^[6-9]\d{9}$/.test(num)) return "91" + num;
    }
  }

  return null;
}

async function huntPhoneNumber(company) {
  if (!GEMINI_API_KEY) return null;
  const companyName = company.Company || "";
  const location = company.City || "Madurai Tamil Nadu";

  const prompt = `Search Google for the official contact phone number, mobile number, landline, or WhatsApp number for "${companyName}" in "${location}". Look at Justdial, IndiaMART, and official website contact pages. Output all phone numbers found clearly.`;

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
      
      console.log(`[Raw Search Response for ${companyName}]:`, text.substring(0, 200)); // Log snippet for debugging
      
      const found = extractContactNumber(text);
      if (found) return found;
    }
  } catch (e) {
    console.error(`[Search Error] ${companyName}: ${e.message}`);
  }
  return null;
}

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

async function main() {
  const stats = { processed: 0, updated: 0, phoneHuntAttempts: 0, phoneHuntSuccess: 0 };
  const data = await loadDatabase();
  const companies = data.companies || [];

  const allCandidates = companies
    .filter((c) => {
      const hasPhone = (c.Mobile && c.Mobile !== "Not public") || (c.WhatsApp && c.WhatsApp !== "Not public");
      return !hasPhone && (c.RetryCount || 0) < MAX_RETRY_COUNT;
    })
    .sort((a, b) => (a.RetryCount || 0) - (b.RetryCount || 0));

  const candidates = allCandidates.slice(0, PHONE_HUNT_MAX_PER_RUN);

  console.log(`[Micro-Batch Architecture] Processing ${candidates.length} prioritized leads out of ${allCandidates.length} pending...`);

  for (const company of candidates) {
    stats.phoneHuntAttempts++;
    const foundContact = await huntPhoneNumber(company);
    
    if (foundContact) {
      company.Mobile = foundContact;
      company.WhatsApp = foundContact.startsWith("91") ? `https://wa.me/${foundContact}` : "Not public";
      company.RetryCount = 0;
      stats.updated++;
      stats.phoneHuntSuccess++;
      console.log(`[Recovered] ${company.Company} -> ${foundContact}`);
    } else {
      company.RetryCount = (company.RetryCount || 0) + 1;
    }
    stats.processed++;
    
    await delay(getJitteredDelay(BASE_DELAY_MS));
  }

  await saveDatabase(data);
  console.log(`[Execution Complete] Processed: ${stats.processed}, Recovered: ${stats.phoneHuntSuccess}`);
}

main().catch((e) => console.error("Fatal enrichment error:", e));
