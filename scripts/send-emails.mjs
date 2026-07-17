import fs from "fs/promises";
import nodemailer from "nodemailer";
import { isValidEmail } from "./lead-validators.mjs";

// ============================================================
// CONFIG — every tunable value lives here. Nothing else in this
// file should contain a hardcoded email, limit, or delay.
// ============================================================
const CONFIG = {
  TEST_MODE: false,
  TEST_LIMIT: 5,
  TEST_EMAIL: "prem.rajini.suresh@gmail.com",
  OWNER_NAME: "Suresh Kumar",
  SENDER_NAME: "Suresh Kumar",

  // Dedicated Gmail account for this project, sent via Gmail's own SMTP
  // servers — no domain purchase or DNS verification needed, and can
  // send to any real recipient (unlike the Resend sandbox, which can
  // only ever send to the account owner's own address).
  // Requires GMAIL_USER + GMAIL_APP_PASSWORD as GitHub Actions secrets,
  // both tied to THIS account (not smartpos.systems@gmail.com).
  FROM_EMAIL: "suresh.kumar.alagarkovil@gmail.com",

  EMAIL_DELAY: 2000,

  // Supporting config (not in the original required list, but kept
  // here rather than hardcoded elsewhere in the file).
  SMTP_TIMEOUT_MS: 15000,
  SKIP_ALREADY_SENT: true,

  // A fresh/new Gmail account is capped lower than an established one
  // by Google's anti-abuse systems. Keep this conservative at first;
  // it can be raised once the account has some sending history.
  DAILY_SEND_LIMIT: 100,

  PROPERTY_TITLE: "23.5 Cents Corner Commercial Land — Alagarkovil Highway Junction, Madurai",
  PROPERTY_PRICE: "₹25 Lakhs per cent",
  PROPERTY_SALE_TYPE: "Outright Sale Only"
};

const DB_PATH = new URL("../buyerdatabase5.json", import.meta.url).pathname;

// NOTE: email validation now comes from the shared lead-validators.mjs
// (same file the enrichment/cleanup scripts use), so "is this a real
// email?" is defined in exactly one place across the whole project.
// This is a strict superset of the old local check (same format rule,
// same invalid-value list, PLUS a domain blacklist for known junk
// domains like sentry.io/wixpress.com), so nothing that used to pass
// stops passing — it can only additionally catch a few more bad ones.

// ============================================================
// DATABASE HELPERS
// ============================================================
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

function ensureEmailFields(company) {
  if (!("EmailSent" in company)) company.EmailSent = false;
  if (!("EmailSentDate" in company)) company.EmailSentDate = "";
  if (!("EmailStatus" in company)) company.EmailStatus = "Pending";
  if (!("LastError" in company)) company.LastError = "";
}

// ============================================================
// CATEGORY -> EMAIL TEMPLATE ENGINE
// ============================================================
const CATEGORY_RULES = [
  {
    key: "hospitals",
    match: ["hospital", "healthcare", "clinic", "medical", "psychiatric", "wellness"],
    subject: (c) => `Commercial Land Opportunity for ${c.Company} — Expand Your Healthcare Footprint in Madurai`,
    pitch:
      "As a healthcare provider looking to grow, a corner commercial plot on a high-traffic highway junction offers exceptional visibility and easy patient access — ideal for a new hospital wing, diagnostic center, or clinic branch."
  },
  {
    key: "education",
    match: ["education", "school", "college", "training", "academy", "institute", "coaching"],
    subject: (c) => `Land Opportunity for ${c.Company} — Prime Site for Your Next Campus in Madurai`,
    pitch:
      "Educational institutions expanding into Madurai need land that's easy for students and staff to reach. This corner commercial plot sits directly on a major highway junction, giving strong road frontage and visibility for a new campus, training center, or coaching institute."
  },
  {
    key: "corporate",
    match: ["corporate", "it", "software", "technology", "office", "business park"],
    subject: (c) => `Corner Commercial Land for ${c.Company} — Madurai Highway Junction`,
    pitch:
      "For corporates evaluating a regional office or business park in Madurai, this corner plot at a major highway junction offers strong connectivity and long-term development potential."
  },
  {
    key: "construction",
    match: ["construction", "builder", "developer", "infrastructure", "contractor"],
    subject: (c) => `Development-Ready Corner Plot for ${c.Company} — Madurai Highway Junction`,
    pitch:
      "For builders and developers scouting commercial sites, this 23.5-cent corner plot at a Madurai highway junction offers a rare combination of road frontage, visibility, and outright-sale simplicity — no lease or JV complications."
  },
  {
    key: "realestate",
    match: ["real estate", "investor", "investment", "reit", "property"],
    subject: (c) => `Investment-Grade Corner Land for ${c.Company} — Madurai Highway Junction`,
    pitch:
      "For investors and real estate firms seeking appreciating commercial land, this corner plot at a busy Madurai highway junction combines strong fundamentals — location, road frontage, and clean outright-sale terms."
  },
  {
    key: "retail",
    match: ["retail", "supermarket", "showroom", "mall", "store", "shopping"],
    subject: (c) => `High-Visibility Corner Plot for ${c.Company} — Madurai Highway Junction`,
    pitch:
      "Retail businesses thrive on visibility and footfall. This corner commercial plot sits right at a busy Madurai highway junction — ideal for a new showroom, supermarket, or retail outlet."
  },
  {
    key: "manufacturing",
    match: ["manufacturing", "factory", "industrial", "industries", "plant"],
    subject: (c) => `Highway-Facing Commercial Land for ${c.Company} — Madurai`,
    pitch:
      "For manufacturing and industrial units needing highway access for logistics, this corner plot at a Madurai highway junction offers strong connectivity for a warehouse, depot, or light-industrial facility."
  },
  {
    key: "restaurants",
    match: ["restaurant", "cafe", "food", "dining", "catering", "qsr"],
    subject: (c) => `Prime Highway Corner Plot for ${c.Company} — Madurai`,
    pitch:
      "Restaurants and food businesses depend on visibility to passing traffic. This corner plot at a major Madurai highway junction is well suited for a new restaurant, drive-in, or highway dining outlet."
  },
  {
    key: "petrolbunks",
    match: ["petrol", "fuel", "bunk", "gas station", "fuel station", "ev charging", "logistics", "warehousing"],
    subject: (c) => `Highway Corner Plot for ${c.Company} — Madurai Junction`,
    pitch:
      "Fuel retail, EV charging, and logistics operations all depend on highway visibility and easy turn-in access. This corner plot sits directly at a busy Madurai highway junction — a strong candidate for a new fuel/EV station, depot, or highway service point."
  },
  {
    key: "resorts",
    match: ["resort", "spa", "retreat"],
    subject: (c) => `Highway Corner Land for ${c.Company} — Gateway to Madurai`,
    pitch:
      "For resort and hospitality brands looking at Madurai's growing tourism corridor, this corner commercial plot at a highway junction offers an accessible, visible entry point for a new property."
  },
  {
    key: "hotels",
    match: ["hotel", "hospitality", "inn", "lodging", "accommodation"],
    subject: (c) => `Corner Commercial Land for ${c.Company} — Madurai Highway Junction`,
    pitch:
      "With Madurai's hospitality sector expanding, this corner plot at a major highway junction offers excellent visibility and access — well suited for a new hotel, business inn, or highway lodging property."
  },

  // ---- Added so every one of the 12 real auto-search categories
  // gets a properly targeted pitch instead of 5 of them silently
  // falling through to the generic default template. ----
  {
    key: "weddinghalls",
    match: ["wedding", "convention hall", "convention", "banquet", "marriage hall"],
    subject: (c) => `Corner Land for ${c.Company} — Wedding & Convention Destination Near Madurai`,
    pitch:
      "Madurai's temple-town wedding tourism is a growing draw for convention and banquet brands. This corner plot at a major highway junction, close to Alagar Kovil and the Alanganallur corridor, offers strong access and visibility for a new wedding or convention venue."
  },
  {
    key: "trusts",
    match: ["temple trust", "charitable trust", "religious trust", "endowment", "mutt"],
    subject: (c) => `Land Opportunity for ${c.Company} — Near Alagar Kovil, Madurai`,
    pitch:
      "For trusts looking to invest surplus funds or build pilgrim/community facilities, this corner commercial plot sits on the approach to Alagar Kovil Temple and the Alanganallur route, with strong road frontage and easy access for visitors."
  },
  {
    key: "government",
    match: ["government", "ppp", "public private partnership", "tourism corporation", "tourism board"],
    subject: (c) => `Corner Land Near Alagar Kovil, Madurai — Suitable for ${c.Company} Projects`,
    pitch:
      "This corner plot sits directly on Madurai's tourism and education corridor, near Alagar Kovil Temple and the Alanganallur Jallikattu route — a strong candidate site for a tourism facility, PPP infrastructure project, or public amenity."
  },
  {
    key: "franchise",
    match: ["franchise", "master operator", "master franchise"],
    subject: (c) => `Highway Corner Site for ${c.Company} — Madurai Expansion`,
    pitch:
      "For franchise brands and master operators expanding into Tier-2 Tamil Nadu towns, this corner commercial plot at a major Madurai highway junction offers the visibility and road frontage a new outlet needs."
  },
  {
    key: "startups",
    match: ["startup", "scaleup", "funded"],
    subject: (c) => `Physical Expansion Site for ${c.Company} — Madurai Highway Junction`,
    pitch:
      "For funded companies planning a physical footprint in Tamil Nadu, this corner commercial plot at a busy Madurai highway junction offers a visible, accessible site with clean outright-sale terms — no lease or JV complications."
  }
];

const DEFAULT_TEMPLATE = {
  key: "default",
  subject: (c) => `Commercial Land Opportunity for ${c.Company} — Madurai Highway Junction`,
  pitch:
    "This corner commercial plot at a major Madurai highway junction offers strong road frontage, visibility, and clean outright-sale terms — worth a look for your organization's expansion plans."
};

function resolveTemplate(company) {
  const category = String(company.Category || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some((kw) => category.includes(kw))) {
      return rule;
    }
  }
  return DEFAULT_TEMPLATE;
}

function buildEmailHtml(company, template) {
  const companyName = escapeHtml(company.Company || "there");
  const pitch = escapeHtml(template.pitch);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#1a3c34;padding:24px 32px;">
              <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:600;">Commercial Land Opportunity</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#c9e3dd;">Madurai Highway Junction — Corner Plot</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#222222;line-height:1.6;">Dear ${companyName} Team,</p>
              <p style="margin:0 0 16px;font-size:15px;color:#222222;line-height:1.6;">${pitch}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9f8;border-radius:6px;margin:20px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#1a3c34;font-weight:600;">Property Details</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333333;">${escapeHtml(CONFIG.PROPERTY_TITLE)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#333333;">Price: ${escapeHtml(CONFIG.PROPERTY_PRICE)}</p>
                    <p style="margin:0;font-size:14px;color:#333333;">Terms: ${escapeHtml(CONFIG.PROPERTY_SALE_TYPE)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:15px;color:#222222;line-height:1.6;">If this fits your expansion plans, I'd be happy to share more details, site photographs, or arrange a site visit at your convenience.</p>

              <p style="margin:24px 0 0;font-size:15px;color:#222222;line-height:1.6;">Best regards,<br/>${escapeHtml(CONFIG.SENDER_NAME)}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f0f0f0;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#888888;">This message was sent by ${escapeHtml(CONFIG.OWNER_NAME)} regarding a private commercial land sale in Madurai. Reply directly to this email to unsubscribe from future messages.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// GMAIL SMTP (via nodemailer) — sends as the dedicated project
// account; no domain or DNS verification needed.
// ============================================================
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variable/secret."
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    },
    connectionTimeout: CONFIG.SMTP_TIMEOUT_MS,
    greetingTimeout: CONFIG.SMTP_TIMEOUT_MS,
    socketTimeout: CONFIG.SMTP_TIMEOUT_MS
  });

  return transporter;
}

async function sendEmailViaGmail({ to, subject, html }) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: `${CONFIG.SENDER_NAME} <${CONFIG.FROM_EMAIL}>`,
    to,
    subject,
    html
  });

  return true;
}

// ============================================================
// LOGGING
// ============================================================
function logCompanyResult({ company, originalEmail, actualRecipient, mode, status, reason }) {
  console.log("--------------------------------");
  console.log(`Company: ${company.Company || ""}`);
  console.log(`Category: ${company.Category || ""}`);
  console.log(`Original Email: ${originalEmail || ""}`);
  console.log(`Actual Recipient: ${actualRecipient || ""}`);
  console.log(`Mode: ${mode}`);
  console.log(`Status: ${status}`);
  console.log(`Reason: ${reason}`);
  console.log("--------------------------------");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// MAIN PROCESS
// ============================================================
async function processCompany(company, data, stats) {
  ensureEmailFields(company);

  const originalEmail = company.Email;
  const mode = CONFIG.TEST_MODE ? "TEST" : "LIVE";

  if (CONFIG.SKIP_ALREADY_SENT && company.EmailSent === true) {
    stats.skipped += 1;
    logCompanyResult({
      company,
      originalEmail,
      actualRecipient: "",
      mode,
      status: "Skipped",
      reason: "Already sent previously"
    });
    return { attemptedValid: false };
  }

  if (!isValidEmail(originalEmail)) {
    company.EmailStatus = "Skipped";
    company.LastError = "Invalid or missing email address";
    stats.skipped += 1;
    logCompanyResult({
      company,
      originalEmail,
      actualRecipient: "",
      mode,
      status: "Skipped",
      reason: "Invalid or missing email address"
    });
    return { attemptedValid: false };
  }

  const actualRecipient = CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : originalEmail;
  const template = resolveTemplate(company);
  const subject = template.subject(company);
  const html = buildEmailHtml(company, template);

  stats.processed += 1;

  try {
    await sendEmailViaGmail({ to: actualRecipient, subject, html });

    company.EmailSent = true;
    company.EmailSentDate = new Date().toISOString();
    company.EmailStatus = "Sent";
    company.LastError = "";
    stats.sent += 1;

    logCompanyResult({
      company,
      originalEmail,
      actualRecipient,
      mode,
      status: "Sent",
      reason: "Delivered successfully"
    });

    // Save database after EVERY successful send so progress is never lost.
    await saveDatabase(data);
  } catch (err) {
    company.EmailStatus = "Failed";
    company.LastError = err.message || String(err);
    stats.failed += 1;

    logCompanyResult({
      company,
      originalEmail,
      actualRecipient,
      mode,
      status: "Failed",
      reason: company.LastError
    });
  }

  return { attemptedValid: true };
}

async function main() {
  const startTime = Date.now();

  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0
  };

  const data = await loadDatabase();
  let validAttempts = 0;

  for (const company of data.companies) {
    if (CONFIG.TEST_MODE && validAttempts >= CONFIG.TEST_LIMIT) {
      break;
    }

    if (!CONFIG.TEST_MODE && stats.sent >= CONFIG.DAILY_SEND_LIMIT) {
      console.log(
        `Daily send limit of ${CONFIG.DAILY_SEND_LIMIT} reached — stopping safely. Re-run tomorrow to continue with remaining companies.`
      );
      break;
    }

    const result = await processCompany(company, data, stats);

    if (result.attemptedValid) {
      validAttempts += 1;
      await sleep(CONFIG.EMAIL_DELAY);
    }
  }

  await saveDatabase(data);

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("================================");
  console.log(`Processed: ${stats.processed}`);
  console.log(`Sent: ${stats.sent}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Test Mode: ${CONFIG.TEST_MODE}`);
  console.log(`Elapsed Time: ${elapsedSeconds}s`);
  console.log("================================");
  console.log("Completed Successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
