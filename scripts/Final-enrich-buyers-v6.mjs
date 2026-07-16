import fs from "fs/promises";
import axios from "axios";
import * as cheerio from "cheerio";

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

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
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
      lower.includes("wixpress.com")
    ) {
      continue;
    }
    emails.add(lower);
  }

  return Array.from(emails);
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

  const indianMobileRegex = /(?:\+91[\s-]?|0)?[6-9]\d{9}\b/g;
  const mobileMatches = html.match(indianMobileRegex) || [];
  for (const m of mobileMatches) {
    mobiles.add(m.replace(/[\s-]/g, ""));
  }

  const landlineRegex = /(?:\+91[\s-]?)?0?\d{2,4}[\s-]\d{6,8}\b/g;
  const landlineMatches = html.match(landlineRegex) || [];
  for (const m of landlineMatches) {
    phones.add(m.replace(/\s+/g, " ").trim());
  }

  return {
    phone: Array.from(phones).slice(0, 5),
    mobile: Array.from(mobiles).slice(0, 5),
    whatsapp: Array.from(whatsapp).slice(0, 5)
  };
}

function extractAddress(html) {
  const result = { address: "", city: "", state: "", pin: "" };

  try {
    const $ = cheerio.load(html);
    const addressTag = $("address").first().text().trim();
    if (addressTag) {
      result.address = addressTag.replace(/\s+/g, " ").trim();
    }
  } catch {
    // ignore
  }

  const pinRegex = /\b\d{6}\b/;
  const pinMatch = html.match(pinRegex);
  if (pinMatch) {
    result.pin = pinMatch[0];
  }

  const indianStates = [
    "Tamil Nadu",
    "Kerala",
    "Karnataka",
    "Andhra Pradesh",
    "Telangana",
    "Maharashtra",
    "Gujarat",
    "Rajasthan",
    "Punjab",
    "Haryana",
    "Uttar Pradesh",
    "Madhya Pradesh",
    "Bihar",
    "West Bengal",
    "Odisha",
    "Delhi",
    "Goa",
    "Assam",
    "Jharkhand",
    "Chhattisgarh",
    "Uttarakhand",
    "Himachal Pradesh"
  ];
  for (const state of indianStates) {
    if (html.includes(state)) {
      result.state = state;
      break;
    }
  }

  const tamilCities = [
    "Chennai",
    "Madurai",
    "Coimbatore",
    "Trichy",
    "Tiruchirappalli",
    "Salem",
    "Erode",
    "Tirunelveli",
    "Vellore",
    "Thoothukudi",
    "Dindigul",
    "Thanjavur",
    "Karur",
    "Namakkal"
  ];
  for (const city of tamilCities) {
    if (html.includes(city)) {
      result.city = city;
      break;
    }
  }

  if (!result.address && result.pin) {
    const context = html.substring(
      Math.max(0, html.indexOf(result.pin) - 150),
      html.indexOf(result.pin) + 10
    );
    try {
      const $ctx = cheerio.load(context);
      const text = $ctx.text().replace(/\s+/g, " ").trim();
      if (text.length > 10 && text.length < 300) {
        result.address = text;
      }
    } catch {
      // ignore
    }
  }

  return result;
}

function extractGoogleMaps(html) {
  try {
    const $ = cheerio.load(html);
    let found = "";

    $("a[href*='google.com/maps'], a[href*='maps.google'], a[href*='goo.gl/maps']").each(
      (_, el) => {
        if (found) return;
        const href = $(el).attr("href");
        if (href) found = href;
      }
    );

    if (!found) {
      $("iframe[src*='google.com/maps'], iframe[src*='maps.google']").each(
        (_, el) => {
          if (found) return;
          const src = $(el).attr("src");
          if (src) found = src;
        }
      );
    }

    return found;
  } catch {
    return "";
  }
}

function extractSocialLinks(html) {
  const social = {
    facebook: "",
    linkedin: "",
    instagram: "",
    x: "",
    youtube: ""
  };

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

function mergeCompany(company, extracted) {
  let updated = false;

  const setIfEmpty = (field, value) => {
    if (!value) return;
    const current = company[field];
    if (isEmptyValue(current)) {
      company[field] = value;
      updated = true;
    }
  };

  setIfEmpty("Email", extracted.email);
  setIfEmpty("Phone", extracted.phone);
  setIfEmpty("Mobile", extracted.mobile);
  setIfEmpty("WhatsApp", extracted.whatsapp);
  setIfEmpty("Address", extracted.address);
  setIfEmpty("City", extracted.city);
  setIfEmpty("State", extracted.state);
  setIfEmpty("PIN", extracted.pin);
  setIfEmpty("GoogleMaps", extracted.googleMaps);
  setIfEmpty("Facebook", extracted.facebook);
  setIfEmpty("LinkedIn", extracted.linkedin);
  setIfEmpty("Instagram", extracted.instagram);
  setIfEmpty("X", extracted.x);
  setIfEmpty("YouTube", extracted.youtube);
  setIfEmpty("ContactPage", extracted.contactPage);

  return updated;
}

function ensureFields(company) {
  const fields = [
    "ContactPage",
    "Phone",
    "Mobile",
    "WhatsApp",
    "Address",
    "City",
    "State",
    "PIN",
    "GoogleMaps",
    "Facebook",
    "LinkedIn",
    "Instagram",
    "X",
    "YouTube"
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

    // Heartbeat so GitHub Actions doesn't flag the step as stalled
    // on runs with many companies (no output for ~10 min = killed).
    if (done % HEARTBEAT_EVERY === 0 || done === total) {
      console.log(
        `... progress ${done}/${total} (updated: ${stats.updated}, skipped: ${stats.skipped}, errors: ${stats.errors})`
      );
    }

    // Periodic autosave so partial progress survives even if the
    // job is later interrupted for any other reason.
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
