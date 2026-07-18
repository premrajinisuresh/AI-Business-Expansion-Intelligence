import fs from "fs/promises";
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

/* ============================================================
   scripts/cleanup-buyers-v6.mjs
   ONE-TIME PASS, two jobs:

   JOB 1 -- CLEAR: finds fields holding an absurd/garbage value
   (leaked CSS, junk directions-map links, malformed phone
   numbers, mismatched city/state, etc.) and blanks them back to
   "". Uses your own lead-validators.mjs for every "is this
   valid?" check -- unchanged, untouched.

   When a bad Email is cleared, this also fully resets the
   email-send tracking (EmailSent, EmailStatus back to "Pending",
   EmailSentDate, AND LastError) -- otherwise Send Emails would
   see "already sent" forever, or show a stale old error message.

   JOB 2 -- REPAIR (new): for a few fields, a blank/broken value
   can actually be rebuilt from OTHER data already on the same
   record, instead of just being left empty:
     - GoogleMaps: if broken/missing but a real Address exists,
       build a guaranteed-working Google Maps SEARCH link from
       the address (same as typing the address into Maps).
     - Mobile: if the field is a messy pile of several numbers
       jammed together, keep just the first clean, valid one.
     - WhatsApp: if missing but a valid Mobile number exists,
       build a real tap-to-chat wa.me link from that mobile
       number (normalized to 91XXXXXXXXXX format).
   These are safe *fallbacks* -- if Enrich later finds something
   better, its result will simply overwrite this fallback next run.

   Run this once, then re-run "Enrich Buyers V6" afterward so
   fields Enrich CAN find something better for get re-filled
   properly.
   ============================================================ */

const DB_PATH = new URL("../buyerdatabase5.json", import.meta.url).pathname;

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

function hasValue(v) {
  return v !== undefined && v !== null && String(v).trim() !== "" && v !== "Not public";
}

function clearIfInvalid(company, field, isValidFn) {
  const value = company[field];
  if (!hasValue(value)) return false;
  if (!isValidFn(value)) {
    company[field] = "";
    return true;
  }
  return false;
}

/* ---------- REPAIR helpers (new) ---------- */

// Turns a raw number into clean 91XXXXXXXXXX digits, or null if
// it doesn't look like a real Indian mobile number at all.
function normalizeIndianMobile(raw) {
  if (!hasValue(raw)) return null;
  // If the field has several numbers jammed together, look at
  // just the first one.
  const first = String(raw).split(/[,/|]/)[0];
  const digits = first.replace(/\D/g, "");

  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return null;
}

function buildGoogleMapsSearchLink(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Builds the best available search text for a Maps fallback link:
// prefers a real Address, falls back to Company + City if no
// address is available at all.
function bestMapsQuery(company) {
  if (hasValue(company.Address)) return company.Address;
  if (hasValue(company.Company) && hasValue(company.City)) {
    return `${company.Company}, ${company.City}`;
  }
  return null;
}

async function main() {
  const data = await loadDatabase();

  let companiesTouched = 0;
  let fieldsCleared = 0;
  let emailTrackingReset = 0;
  let mapsLinksRepaired = 0;
  let mobileNumbersCleaned = 0;
  let whatsappLinksBuilt = 0;

  for (const company of data.companies) {
    let touchedThisCompany = false;

    /* ---------- JOB 1: CLEAR bad values ---------- */

    if (clearIfInvalid(company, "Email", isValidEmail)) {
      fieldsCleared++;
      touchedThisCompany = true;
      company.EmailSent = false;
      company.EmailStatus = "Pending";
      company.EmailSentDate = "";
      company.LastError = "";
      emailTrackingReset++;
    }
    if (clearIfInvalid(company, "Phone", isValidPhone)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "Mobile", isValidMobile)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "WhatsApp", isValidWhatsApp)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "Address", (v) => isValidAddress(v, company.Category))) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "PIN", (v) => isValidPin(v, company.City))) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "GoogleMaps", isValidGoogleMaps)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "Facebook", isValidFacebook)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "LinkedIn", isValidLinkedIn)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "Instagram", isValidInstagram)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "X", isValidX)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "YouTube", isValidYouTube)) { fieldsCleared++; touchedThisCompany = true; }
    if (clearIfInvalid(company, "ContactPage", isValidContactPage)) { fieldsCleared++; touchedThisCompany = true; }

    if (hasValue(company.State) && !isValidState(company.State, company.City, company.Category)) {
      company.State = "";
      fieldsCleared++;
      touchedThisCompany = true;
    }
    if (hasValue(company.City) && !isValidCity(company.City, company.Category)) {
      company.City = "";
      fieldsCleared++;
      touchedThisCompany = true;
    }

    /* ---------- JOB 2: REPAIR from other fields ---------- */

    // Mobile: if it's a messy pile of numbers, keep just the
    // first clean valid one (re-check with the real validator
    // after cleaning, so we never write something it would reject).
    if (hasValue(company.Mobile) && company.Mobile.match(/[,/|]/)) {
      const cleaned = normalizeIndianMobile(company.Mobile);
      if (cleaned && isValidMobile(cleaned)) {
        company.Mobile = cleaned;
        mobileNumbersCleaned++;
        touchedThisCompany = true;
      }
    }

    // WhatsApp: if missing, build one from a valid Mobile number.
    if (!hasValue(company.WhatsApp)) {
      const source = normalizeIndianMobile(company.Mobile) || normalizeIndianMobile(company.Phone);
      if (source) {
        const candidate = `https://wa.me/${source}`;
        if (isValidWhatsApp(candidate)) {
          company.WhatsApp = candidate;
          whatsappLinksBuilt++;
          touchedThisCompany = true;
        }
      }
    }

    // GoogleMaps: if missing/blank, build a guaranteed-working
    // search link from the Address (or Company + City as backup).
    if (!hasValue(company.GoogleMaps)) {
      const query = bestMapsQuery(company);
      if (query) {
        const candidate = buildGoogleMapsSearchLink(query);
        if (isValidGoogleMaps(candidate)) {
          company.GoogleMaps = candidate;
          mapsLinksRepaired++;
          touchedThisCompany = true;
        }
      }
    }

    if (touchedThisCompany) companiesTouched++;
  }

  await saveDatabase(data);

  console.log(`Companies checked: ${data.companies.length}`);
  console.log(`Companies touched: ${companiesTouched}`);
  console.log(`Fields cleared: ${fieldsCleared}`);
  console.log(`Email-send tracking reset (so re-send is possible): ${emailTrackingReset}`);
  console.log(`Mobile numbers cleaned (messy list -> single number): ${mobileNumbersCleaned}`);
  console.log(`WhatsApp links built from a valid mobile number: ${whatsappLinksBuilt}`);
  console.log(`Google Maps links repaired with a working search link: ${mapsLinksRepaired}`);
  console.log("Cleanup Completed Successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
