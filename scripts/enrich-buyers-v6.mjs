/* ============================================================
   scripts/enrich-buyers-v6.mjs
   MICRO-BATCHED FREE-TIER OSINT ENRICHMENT PIPELINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 25000;
const BATCH_DELAY_MS = 12000; // 12-second safety buffer between requests
const MAX_RETRY_COUNT = 3;
const PHONE_HUNT_MAX_PER_RUN = 10; // Strict limit: 10 leads per execution

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MOBILE_REGEX = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;
const LANDLINE_MADURAI_REGEX = /(?<!\d)(?:0452[\s-]?)?\d{7,8}(?!\d)/;

function extractContactNumber(text) {
  const str = String(text || "");
  const mobileMatches = str.match(new RegExp(MOBILE_REGEX, "g"));
  if (mobileMatches && mobileMatches.length > 0) {
    for (const m of mobileMatches) {
      const digits = m.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      if (/^[6-9]\d{9}$/.test(last10)) return "91" + last10;
    }
  }
  const landlineMatches = str.match(new RegExp(LANDLINE_MADURAI_REGEX, "g"));
  if (landlineMatches && landlineMatches.length > 0) {
    for (const l of landlineMatches) {
      const digits = l.replace(/\D/g, "");
      if (digits.length >= 7) return digits.startsWith("0452") ? digits : "0452" + digits;
    }
  }
  return null;
}

async function huntPhoneNumber(company) {
  if (!GEMINI_API_KEY) return null;
  const companyName = company.Company || "";
  const location = company.City || "Madurai Tamil Nadu";

  const prompt = `Find the contact phone number for "${companyName}" in "${location}" via Google Search. Respond with ONLY valid JSON: {"phone": "..."} or {"phone": "Not public"}`;

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
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
      const parsed = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
      if (parsed.phone && parsed.phone !== "Not public") {
        return extractContactNumber(parsed.phone);
      }
    }
  } catch (e) {}
  return null;
}

async function loadDatabase() {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

async function saveDatabase(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function main() {
  const stats = { processed: 0, updated: 0, phoneHuntAttempts: 0, phoneHuntSuccess: 0 };
  const data = await loadDatabase();
  const companies = data.companies || [];

  const candidates = companies.filter((c) => {
    const hasPhone = (c.Mobile && c.Mobile !== "Not public") || (c.WhatsApp && c.WhatsApp !== "Not public");
    return !hasPhone && (c.RetryCount || 0) < MAX_RETRY_COUNT && stats.phoneHuntAttempts < PHONE_HUNT_MAX_PER_RUN;
  });

  console.log(`[Micro-Batch] Processing ${candidates.length} leads (Max ${PHONE_HUNT_MAX_PER_RUN} per run)...`);

  for (const company of candidates) {
    stats.phoneHuntAttempts++;
    const foundContact = await huntPhoneNumber(company);
    
    if (foundContact) {
      company.Mobile = foundContact;
      company.WhatsApp = company.WhatsApp && company.WhatsApp !== "Not public" ? company.WhatsApp : (foundContact.startsWith("91") ? `https://wa.me/${foundContact}` : "Not public");
      company.RetryCount = 0;
      stats.updated++;
      stats.phoneHuntSuccess++;
      console.log(`[Recovered] ${company.Company} -> ${foundContact}`);
    } else {
      company.RetryCount = (company.RetryCount || 0) + 1;
    }
    stats.processed++;
    await delay(BATCH_DELAY_MS);
  }

  await saveDatabase(data);
  console.log(`[Complete] Processed micro-batch. Recovered: ${stats.phoneHuntSuccess}`);
}

main().catch((e) => console.error("Fatal enrichment error:", e));
