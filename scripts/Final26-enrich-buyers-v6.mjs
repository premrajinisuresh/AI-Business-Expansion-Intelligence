/* ============================================================
   scripts/enrich-buyers-v6.mjs
   OPTIMIZED: High-Yield, Hang-Proof Enrichment Engine with Batching & Timeouts
   ============================================================ */

import fs from "fs/promises";

const DB_PATH = "buyerdatabase5.json";
const TIMEOUT_MS = 8000;
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

async function searchWeb(query) {
  if (!TAVILY_API_KEY) return [];
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 5
      })
    });
    if (res && res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
      }
    }
  } catch {}
  return [];
}

async function huntPhoneNumberViaSearch(company) {
  if (!GEMINI_API_KEY) return null;
  const location = company.City || "Madurai Tamil Nadu";
  const generalQuery = `"${company.Company}" mobile phone whatsapp contact number ${location}`;
  return await runPhoneSearchPass(company, generalQuery);
}

async function runPhoneSearchPass(company, query) {
  const results = await searchWeb(query);
  if (results.length === 0) return null;

  const prompt =
    `From ONLY these web search results, find a real mobile phone or WhatsApp number for ` +
    `"${company.Company}". Results:\n${JSON.stringify(results, null, 2)}\n\n` +
    `Respond with ONLY a JSON object: {"phone": "..."} or {"phone": "Not public"}.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }, 10000);

    if (!res || !res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.phone && parsed.phone !== "Not public" ? parsed.phone : null;
  } catch {
    return null;
  }
}

async function loadDatabase() {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

async function saveDatabase(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeDigits(raw) {
  return String(raw).replace(/[^\d]/g, "");
}

function formatMobileForStorage(raw) {
  const digits = normalizeDigits(raw);
  const last = digits.slice(-10);
  return /^[6-9]/.test(last) ? "91" + last : digits;
}

async function main() {
  const stats = { processed: 0, updated: 0, phoneHuntAttempts: 0, phoneHuntSuccess: 0 };
  const data = await loadDatabase();
  const companies = data.companies || [];

  const candidates = companies.filter((c) => {
    const hasPhone = (c.Mobile && c.Mobile !== "Not public") || (c.WhatsApp && c.WhatsApp !== "Not public");
    const retries = c.RetryCount || 0;
    return !hasPhone && retries < MAX_RETRY_COUNT && stats.phoneHuntAttempts < PHONE_HUNT_MAX_PER_RUN;
  });

  console.log(`Starting enrichment batch for ${candidates.length} candidates...`);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (company) => {
      if (stats.phoneHuntAttempts >= PHONE_HUNT_MAX_PER_RUN) return;
      stats.phoneHuntAttempts++;

      const found = await huntPhoneNumberViaSearch(company);
      if (found) {
        const candidate = formatMobileForStorage(found);
        if (candidate.length >= 10) {
          company.Mobile = candidate;
          company.WhatsApp = company.WhatsApp && company.WhatsApp !== "Not public" ? company.WhatsApp : candidate;
          company.RetryCount = 0;
          stats.updated++;
          stats.phoneHuntSuccess++;
        } else {
          company.RetryCount = (company.RetryCount || 0) + 1;
        }
      } else {
        company.RetryCount = (company.RetryCount || 0) + 1;
      }
      stats.processed++;
    }));

    // Checkpoint save every 25 records
    if (stats.processed % 25 === 0 || i + BATCH_SIZE >= candidates.length) {
      await saveDatabase(data);
      console.log(`[Checkpoint] Processed ${stats.processed} leads. Successes: ${stats.phoneHuntSuccess}`);
    }

    await delay(BATCH_DELAY_MS);
  }

  await saveDatabase(data);
  console.log(`Enrichment complete. Total phone hunt successes: ${stats.phoneHuntSuccess}`);
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
