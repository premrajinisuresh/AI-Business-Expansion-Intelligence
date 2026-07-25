/* ============================================================
   scripts/enrich-buyers-v6.mjs
   ULTIMATE HIGH-YIELD OSINT & MULTI-PLATFORM ENRICHMENT PIPELINE
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 9000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1500;
const MAX_RETRY_COUNT = 3;
const PHONE_HUNT_MAX_PER_RUN = 500;

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-flash-latest";

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

// Comprehensive Indian Contact Regex:
// 1. Mobile: 10 digits starting with 6-9, optional +91 or 91
// 2. Landline: Madurai STD code (0452) followed by 7-8 digits
const MOBILE_REGEX = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;
const LANDLINE_MADURAI_REGEX = /(?<!\d)(?:0452[\s-]?)?\d{7,8}(?!\d)/;

function extractContactNumber(text) {
  const str = String(text || "");
  
  // Try Mobile first (preferred)
  const mobileMatches = str.match(new RegExp(MOBILE_REGEX, "g"));
  if (mobileMatches && mobileMatches.length > 0) {
    for (const m of mobileMatches) {
      const digits = m.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      if (/^[6-9]\d{9}$/.test(last10)) {
        return "91" + last10;
      }
    }
  }

  // Fallback to Madurai Landline (0452)
  const landlineMatches = str.match(new RegExp(LANDLINE_MADURAI_REGEX, "g"));
  if (landlineMatches && landlineMatches.length > 0) {
    for (const l of landlineMatches) {
      const digits = l.replace(/\D/g, "");
      if (digits.length >= 7) {
        const formatted = digits.startsWith("0452") ? digits : "0452" + digits;
        return formatted;
      }
    }
  }

  return null;
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
        max_results: 10
      })
    });
    if (res && res.ok) {
      const data = await res.json();
      return (data.results || []).map((r) => `${r.title} ${r.content} ${r.url}`);
    }
  } catch {}
  return [];
}

async function huntPhoneNumber(company) {
  const companyName = company.Company || "";
  const location = company.City || "Madurai Tamil Nadu";
  const website = company.Website && company.Website !== "Not public" ? company.Website : "";

  // Ultimate Multi-Tier OSINT & Platform Matrix
  const queries = [
    `"${companyName}" "${location}" phone OR mobile OR contact (site:justdial.com OR site:indiamart.com OR site:sulekha.com)`,
    `"${companyName}" "${location}" (MSME Udyam OR GSTIN) registration phone number`,
    `"${companyName}" "${location}" (site:facebook.com OR site:instagram.com OR site:linkedin.com) contact`,
    `"${companyName}" "${location}" google maps business profile phone number`,
    website ? `"${companyName}" site:${website} contact footer` : `"${companyName}" "${location}" official contact mobile whatsapp`
  ];

  for (const q of queries) {
    const snippets = await searchWeb(q);
    for (const text of snippets) {
      const found = extractContactNumber(text);
      if (found) return found;
    }
  }

  // Advanced Gemini Semantic Fallback for complex snippet text
  if (GEMINI_API_KEY) {
    const rawSnippets = await searchWeb(`"${companyName}" "${location}" contact phone number OR mobile`);
    if (rawSnippets.length > 0) {
      const prompt = `Extract a mobile phone number, WhatsApp number, or landline number for "${companyName}" from these search snippets:\n${JSON.stringify(rawSnippets)}\nRespond with ONLY valid JSON: {"phone": "..."} or {"phone": "Not public"}`;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }, 8000);
        if (res && res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
          const parsed = JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
          if (parsed.phone && parsed.phone !== "Not public") {
            const cleaned = extractContactNumber(parsed.phone);
            if (cleaned) return cleaned;
          }
        }
      } catch {}
    }
  }

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

  // Reset retry count on candidates to ensure a comprehensive sweep using the ultimate matrix
  const candidates = companies.filter((c) => {
    const hasPhone = (c.Mobile && c.Mobile !== "Not public") || (c.WhatsApp && c.WhatsApp !== "Not public");
    const retries = c.RetryCount || 0;
    if (!hasPhone && retries >= MAX_RETRY_COUNT) {
      c.RetryCount = 0; // Fresh sweep
    }
    return !hasPhone && stats.phoneHuntAttempts < PHONE_HUNT_MAX_PER_RUN;
  });

  console.log(`Starting ultimate OSINT enrichment pipeline for ${candidates.length} candidates...`);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (company) => {
      stats.phoneHuntAttempts++;

      const foundContact = await huntPhoneNumber(company);
      if (foundContact) {
        company.Mobile = foundContact;
        company.WhatsApp = company.WhatsApp && company.WhatsApp !== "Not public" ? company.WhatsApp : (foundContact.startsWith("91") ? `https://wa.me/${foundContact}` : "Not public");
        company.RetryCount = 0;
        stats.updated++;
        stats.phoneHuntSuccess++;
      } else {
        company.RetryCount = (company.RetryCount || 0) + 1;
      }
      stats.processed++;
    }));

    if (stats.processed % 25 === 0 || i + BATCH_SIZE >= candidates.length) {
      await saveDatabase(data);
      console.log(`[Checkpoint] Processed ${stats.processed} leads. Total recovered: ${stats.phoneHuntSuccess}`);
    }

    await delay(BATCH_DELAY_MS);
  }

  await saveDatabase(data);
  console.log(`Enrichment complete. Total ultimate OSINT recoveries: ${stats.phoneHuntSuccess}`);
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
