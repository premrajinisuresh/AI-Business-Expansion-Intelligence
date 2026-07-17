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
   ONE-TIME PASS: finds fields in buyerdatabase5.json that hold an
   absurd/garbage value (leaked CSS, junk directions-map links,
   malformed phone numbers, mismatched city/state, etc.) and blanks
   them back to "". It does NOT delete companies and does NOT
   touch fields that already look valid.

   FIXED: previously, when a bad Email was cleared here, the
   company's EmailSent/EmailStatus/EmailSentDate flags were left
   untouched -- so Send Emails would see "already sent" forever
   and permanently skip that company, even after Enrich later
   found a correct email. Now, clearing an invalid Email also
   resets those tracking fields, so the company becomes eligible
   for a real send again once a good address is found.

   Run this once, then re-run "Enrich Buyers V6" afterward so the
   now-empty fields get correctly re-filled (or stay blank if the
   site genuinely has nothing public for that field).
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

/* Reset the "already emailed" tracking whenever the Email field
   itself just got wiped out for being invalid -- otherwise Send
   Emails keeps thinking this company was already handled. */
function resetEmailSendTracking(company) {
  let reset = 0;
  if (hasValue(company.EmailSent) || company.EmailSent === true) {
    company.EmailSent = false;
    reset++;
  }
  if (hasValue(company.EmailStatus)) {
    company.EmailStatus = "";
    reset++;
  }
  if (hasValue(company.EmailSentDate)) {
    company.EmailSentDate = "";
    reset++;
  }
  return reset;
}

async function main() {
  const data = await loadDatabase();

  let companiesTouched = 0;
  let fieldsCleared = 0;
  let emailTrackingReset = 0;

  for (const company of data.companies) {
    let touchedThisCompany = false;

    const emailWasCleared = clearIfInvalid(company, "Email", isValidEmail);
    if (emailWasCleared) {
      fieldsCleared++;
      touchedThisCompany = true;
      const resetCount = resetEmailSendTracking(company);
      if (resetCount > 0) emailTrackingReset++;
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

    // City/State are checked together since a mismatch (e.g. a
    // known Tamil Nadu city paired with an unrelated state, or a
    // foreign location for a location-bound category) means the
    // value was almost certainly scraped from the wrong place.
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

    if (touchedThisCompany) companiesTouched++;
  }

  await saveDatabase(data);

  console.log(`Companies checked: ${data.companies.length}`);
  console.log(`Companies with absurd data cleared: ${companiesTouched}`);
  console.log(`Fields cleared: ${fieldsCleared}`);
  console.log(`Email-send tracking reset (so re-send is possible): ${emailTrackingReset}`);
  console.log("Cleanup Completed Successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
