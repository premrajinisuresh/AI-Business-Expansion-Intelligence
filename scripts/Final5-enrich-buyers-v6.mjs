import fs from "fs/promises";
import axios from "axios";
import * as cheerio from "cheerio";
import {
  isValidEmail,
  isValidPhone,
  isValidMobile,
  isValidWhatsApp,
  isValidAddress,
  isValidCity,
  isValidState,
  isValidPin,
  isValidGoogleMaps,
  isValidFacebook,
  isValidLinkedIn,
  isValidInstagram,
  isValidX,
  isValidYouTube,
  isValidContactPage
} from "./lead-validators.mjs";

const DB_PATH = new URL("../buyerdatabase5.json", import.meta.url).pathname;

const TIMEOUT_MS = 15000;

const CONTACT_KEYWORDS = [
  "contact",
  "contact-us",
  "contactus",
  "about",
  "about-us",
  "aboutus",
  "reach",
  "reach-us",
  "reachus",
  "support",
  "location",
  "locations",
  "branches",
  "corporate",
  "connect"
];

const EMPTY_VALUES = new Set(["", "not public", "n/a", "na", "null", "undefined"]);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return EMPTY_VALUES.has(normalized);
}

async function loadDatabase() {
  const raw = await fs.readFile(DB_PATH, "utf-8");
  const data = JSON.parse(raw);
  if (!data.companies || !Array.isArray(data.companies)) {
    throw new Error("Invalid database structure: 'companies' array missing.");
  }
  return data;
}

async function saveDatabase(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeUrl(base, link) {
  try {
    return new URL(link, base).href;
  } catch {
    return null;
  }
}

async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });
    if (typeof response.data !== "string") return null;
    return response.data;
  } catch {
    return null;
  }
}

function findContactPages(html, baseUrl) {
  const links = new Set();
  try {
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const hrefLower = href.toLowerCase();
      const textLower = ($(el).text() || "").toLowerCase();
      const matches = CONTACT_KEYWORDS.some(
        (kw) => hrefLower.includes(kw) || textLower.includes(kw)
      );
      if (matches) {
        const absolute = normalizeUrl(baseUrl, href);
        if (absolute && absolute.startsWith("http")) {
          links.add(absolute);
        }
      }
    });
  } catch {
    // ignore parse errors
  }
  return Array.from(links).slice(0, 8);
}

/* ---------------------------------------------------------
   Returns clean, human-readable text only — with <script>,
   <style>, <noscript> and <svg> removed first. Every text-based
   extractor (address/city/state/pin) MUST run against this, never
   against raw HTML, or CSS/JS source code leaks into the data
   (this was the cause of garbage like ".elementor-1318{...}"
   showing up in the Address field).
   --------------------------------------------------------- */
function getCleanText(html) {
  try {
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe").remove();
    return $("body").text().replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------
   EMAIL
   --------------------------------------------------------- */
function extractEmails(html) {
  const emails = new Set();

  try {
    const $ = cheerio.load(html);
    $("a[href^='mailto:']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
      if (email) emails.add(email.toLowerCase());
    });
  } catch {
    // ignore
  }

  const cleanText = getCleanText(html);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = cleanText.match(emailRegex) || [];
  for (const match of matches) {
    const lower = match.toLowerCase();
    if (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".svg") ||
      lower.endsWith(".webp") ||
      lower.includes("example.com") ||
      lower.includes("sentry.io") ||
      lower.includes("wixpress.com") ||
      lower.includes("godaddy.com") ||
      lower.includes("schema.org")
    ) {
      continue;
    }
    emails.add(lower);
  }

  return Array.from(emails);
}

/* ---------------------------------------------------------
   PHONE / MOBILE / WHATSAPP
   Fixed: added lookbehind/lookahead digit boundaries so a
   10-digit mobile can never be captured as a substring of a
   longer number run (this was producing malformed values like
   an 11-digit "mobile" before).
   --------------------------------------------------------- */
function normalizeDigits(raw) {
  return String(raw).replace(/[^\d]/g, "");
}

function last10(raw) {
  const digits = normalizeDigits(raw);
  return digits.slice(-10);
}

function dedupeNumbers(list, max) {
  const seen = new Set();
  const out = [];
  for (const n of list) {
    const key = last10(n);
    if (key.length !== 10 || seen.has(key)) continue;
    seen.add(key);
    out.push(n.trim());
    if (out.length >= max) break;
  }
  return out;
}

function extractPhones(html) {
  const phones = new Set();
  const mobiles = new Set();
  const whatsapp = new Set();

  try {
    const $ = cheerio.load(html);
    $("a[href^='tel:']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const num = href.replace(/^tel:/i, "").trim();
      if (num) phones.add(num);
    });
    $("a[href*='wa.me'], a[href*='api.whatsapp.com'], a[href*='whatsapp']").each(
      (_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/(\d{10,15})/);
        if (match) whatsapp.add(match[1]);
      }
    );
  } catch {
    // ignore
  }

  const cleanText = getCleanText(html);

  // (?<!\d) / (?!\d) ensure we never grab a 10-digit chunk out of
  // the middle of a longer number sequence.
  const indianMobileRegex = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g;
  const mobileMatches = cleanText.match(indianMobileRegex) || [];
  for (const m of mobileMatches) {
    mobiles.add(m.replace(/[\s-]/g, ""));
  }

  const landlineRegex = /(?<!\d)(?:\+91[\s-]?)?0\d{2,4}[\s-]\d{6,8}(?!\d)/g;
  const landlineMatches = cleanText.match(landlineRegex) || [];
  for (const m of landlineMatches) {
    phones.add(m.replace(/\s+/g, " ").trim());
  }

  return {
    phone: dedupeNumbers(Array.from(phones), 2),
    mobile: dedupeNumbers(Array.from(mobiles), 2),
    whatsapp: dedupeNumbers(Array.from(whatsapp), 2)
  };
}

/* ---------------------------------------------------------
   ADDRESS / CITY / STATE / PIN
   Fixed: removed the old "150 raw chars near the PIN" fallback
   entirely — that was reading unstripped HTML (including
   <style>/<script> content) and is what leaked CSS source code
   into the Address field. Now Address comes ONLY from JSON-LD
   structured data or a real <address> tag; if neither exists we
   leave it blank rather than guess. City/State/PIN are matched
   against cleaned, tag-free text only.
   --------------------------------------------------------- */
function extractAddress(html) {
  const result = { address: "", city: "", state: "", pin: "" };

  // 1. JSON-LD structured data (most reliable when present)
  try {
    const $ = cheerio.load(html);
    $("script[type='application/ld+json']").each((_, el) => {
      if (result.address) return;
      try {
        const parsed = JSON.parse($(el).contents().text());
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of nodes) {
          const addr = node && node.address;
          if (addr && typeof addr === "object") {
            result.address = result.address || addr.streetAddress || "";
            result.city = result.city || addr.addressLocality || "";
            result.state = result.state || addr.addressRegion || "";
            result.pin = result.pin || addr.postalCode || "";
          }
        }
      } catch {
        // not valid JSON-LD, skip
      }
    });
  } catch {
    // ignore
  }

  // 2. A genuine <address> tag
  if (!result.address) {
    try {
      const $ = cheerio.load(html);
      const addressTag = $("address").first().text().trim();
      if (addressTag && addressTag.length < 300) {
        result.address = addressTag.replace(/\s+/g, " ").trim();
      }
    } catch {
      // ignore
    }
  }

  const cleanText = getCleanText(html);

  // 3. PIN code, from clean text only
  if (!result.pin) {
    const pinMatch = cleanText.match(/\b\d{6}\b/);
    if (pinMatch) result.pin = pinMatch[0];
  }

  const indianStates = [
    "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana",
    "Maharashtra", "Gujarat", "Rajasthan", "Punjab", "Haryana",
    "Uttar Pradesh", "Madhya Pradesh", "Bihar", "West Bengal", "Odisha",
    "Delhi", "Goa", "Assam", "Jharkhand", "Chhattisgarh", "Uttarakhand",
    "Himachal Pradesh"
  ];
  if (!result.state) {
    for (const state of indianStates) {
      if (cleanText.includes(state)) {
        result.state = state;
        break;
      }
    }
  }

  const tamilCities = [
    "Chennai", "Madurai", "Coimbatore", "Trichy", "Tiruchirappalli",
    "Salem", "Erode", "Tirunelveli", "Vellore", "Thoothukudi",
    "Dindigul", "Thanjavur", "Karur", "Namakkal"
  ];
  if (!result.city) {
    for (const city of tamilCities) {
      if (cleanText.includes(city)) {
        result.city = city;
        break;
      }
    }
  }

  return result;
}

/* ---------------------------------------------------------
   GOOGLE MAPS
   Fixed: reject links that look like a two-point DIRECTIONS
   embed (theme demo leftovers, e.g. an unrelated Noida-to-Agra
   route) rather than a single business location pin.
   --------------------------------------------------------- */
function looksLikeDirectionsJunk(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes("/maps/dir/")) return true;
  // A simple single-place embed has one coordinate pair. A
  // multi-point directions embed repeats "!2d" (longitude marker)
  // for each waypoint - two or more means it's a route, not a pin.
  const coordMarkers = (url.match(/!2d/g) || []).length;
  if (coordMarkers >= 2) return true;
  return false;
}

function extractGoogleMaps(html) {
  try {
    const $ = cheerio.load(html);
    const candidates = [];

    $("a[href*='google.com/maps'], a[href*='maps.google'], a[href*='goo.gl/maps']").each(
      (_, el) => {
        const href = $(el).attr("href");
        if (href) candidates.push(href);
      }
    );
    $("iframe[src*='google.com/maps'], iframe[src*='maps.google']").each(
      (_, el) => {
        const src = $(el).attr("src");
        if (src) candidates.push(src);
      }
    );

    const clean = candidates.filter((url) => !looksLikeDirectionsJunk(url));
    return clean.length > 0 ? clean[0] : "";
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------
   SOCIAL LINKS
   --------------------------------------------------------- */
function extractSocialLinks(html) {
  const social = { facebook: "", linkedin: "", instagram: "", x: "", youtube: "" };

  try {
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const hrefLower = href.toLowerCase();

      if (!social.facebook && hrefLower.includes("facebook.com")) {
        social.facebook = href;
      } else if (!social.linkedin && hrefLower.includes("linkedin.com")) {
        social.linkedin = href;
      } else if (!social.instagram && hrefLower.includes("instagram.com")) {
        social.instagram = href;
      } else if (
        !social.x &&
        (hrefLower.includes("twitter.com") || hrefLower.includes("x.com"))
      ) {
        social.x = href;
      } else if (
        !social.youtube &&
        (hrefLower.includes("youtube.com") || hrefLower.includes("youtu.be"))
      ) {
        social.youtube = href;
      }
    });
  } catch {
    // ignore
  }

  return social;
}

/* ---------------------------------------------------------
   MERGE — never overwrite existing valid data
   --------------------------------------------------------- */
function mergeCompany(company, extracted) {
  let updated = false;

  // Never save a value unless it passes the same "is this sane?"
  // check used by the cleanup script - extraction improvements
  // reduce garbage, but this is the last line of defense.
  const setIfEmpty = (field, value, isValidFn) => {
    if (!value) return;
    if (isValidFn && !isValidFn(value)) return;
    const current = company[field];
    if (isEmptyValue(current)) {
      company[field] = value;
      updated = true;
    }
  };

  setIfEmpty("Email", extracted.email, isValidEmail);
  setIfEmpty("Phone", extracted.phone, isValidPhone);
  setIfEmpty("Mobile", extracted.mobile, isValidMobile);
  setIfEmpty("WhatsApp", extracted.whatsapp, isValidWhatsApp);
  setIfEmpty("Address", extracted.address, isValidAddress);
  setIfEmpty("PIN", extracted.pin, isValidPin);
  setIfEmpty("GoogleMaps", extracted.googleMaps, isValidGoogleMaps);
  setIfEmpty("Facebook", extracted.facebook, isValidFacebook);
  setIfEmpty("LinkedIn", extracted.linkedin, isValidLinkedIn);
  setIfEmpty("Instagram", extracted.instagram, isValidInstagram);
  setIfEmpty("X", extracted.x, isValidX);
  setIfEmpty("YouTube", extracted.youtube, isValidYouTube);
  setIfEmpty("ContactPage", extracted.contactPage, isValidContactPage);

  // City/State validated together - a State that doesn't match a
  // known-Tamil-Nadu City is rejected (see lead-validators.mjs).
  if (extracted.city && isEmptyValue(company.City) && isValidCity(extracted.city)) {
    company.City = extracted.city;
    updated = true;
  }
  if (
    extracted.state &&
    isEmptyValue(company.State) &&
    isValidState(extracted.state, company.City || extracted.city)
  ) {
    company.State = extracted.state;
    updated = true;
  }

  return updated;
}

function ensureFields(company) {
  const fields = [
    "ContactPage", "Phone", "Mobile", "WhatsApp", "Address", "City",
    "State", "PIN", "GoogleMaps", "Facebook", "LinkedIn", "Instagram",
    "X", "YouTube"
  ];
  for (const field of fields) {
    if (!(field in company)) {
      company[field] = "";
    }
  }
}

async function processCompany(company, stats) {
  ensureFields(company);

  const website = (company.Website || "").trim();

  if (isEmptyValue(website)) {
    stats.skipped += 1;
    return;
  }

  let url = website;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  stats.processed += 1;

  try {
    const homepageHtml = await fetchPage(url);
    if (!homepageHtml) {
      stats.errors += 1;
      return;
    }

    const aggregatedHtml = [homepageHtml];
    const contactPages = findContactPages(homepageHtml, url);

    for (const pageUrl of contactPages) {
      const pageHtml = await fetchPage(pageUrl);
      if (pageHtml) {
        aggregatedHtml.push(pageHtml);
      }
    }

    const combinedHtml = aggregatedHtml.join("\n");

    const emails = extractEmails(combinedHtml);
    const phones = extractPhones(combinedHtml);
    const address = extractAddress(combinedHtml);
    const googleMaps = extractGoogleMaps(combinedHtml);
    const social = extractSocialLinks(combinedHtml);

    const extracted = {
      email: emails.length > 0 ? emails[0] : "",
      phone: phones.phone.length > 0 ? phones.phone.join(", ") : "",
      mobile: phones.mobile.length > 0 ? phones.mobile.join(", ") : "",
      whatsapp: phones.whatsapp.length > 0 ? phones.whatsapp.join(", ") : "",
      address: address.address,
      city: address.city,
      state: address.state,
      pin: address.pin,
      googleMaps: googleMaps,
      facebook: social.facebook,
      linkedin: social.linkedin,
      instagram: social.instagram,
      x: social.x,
      youtube: social.youtube,
      contactPage: contactPages.length > 0 ? contactPages[0] : ""
    };

    const wasUpdated = mergeCompany(company, extracted);
    if (wasUpdated) {
      stats.updated += 1;
    }
  } catch {
    stats.errors += 1;
  }
}

const HEARTBEAT_EVERY = 20;
const AUTOSAVE_EVERY = 50;

async function main() {
  const stats = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  const data = await loadDatabase();
  const total = data.companies.length;

  for (let i = 0; i < total; i += 1) {
    const company = data.companies[i];
    await processCompany(company, stats);

    const done = i + 1;

    if (done % HEARTBEAT_EVERY === 0 || done === total) {
      console.log(
        `... progress ${done}/${total} (updated: ${stats.updated}, skipped: ${stats.skipped}, errors: ${stats.errors})`
      );
    }

    if (done % AUTOSAVE_EVERY === 0) {
      await saveDatabase(data);
    }
  }

  await saveDatabase(data);

  console.log(`Processed: ${stats.processed}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log("Completed Successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
