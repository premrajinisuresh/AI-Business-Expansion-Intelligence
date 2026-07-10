import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'buyerdatabase5.json');

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function loadDatabase() {
  const content = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(content);
}

async function saveDatabase(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function validateEmail(email) {
  if (!email || email === 'Not public') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function selectTemplate(category) {
  const templates = {
    'Hotels & Highway Hospitality': {
      subject: 'Partnership Inquiry for {{Company}}',
      body: '<p>Dear Team at {{Company}},</p><p>We are interested in discussing potential property collaborations.</p>'
    },
    'Restaurants & Food Courts': {
      subject: 'Inquiry regarding {{Company}} expansion',
      body: '<p>Hello {{Company}} Team,</p><p>We have strategic locations that might align with your expansion plans.</p>'
    },
    'NRI & Diaspora Investors': {
      subject: 'Investment Opportunities for {{Company}}',
      body: '<p>Greetings {{Company}},</p><p>We have curated investment opportunities that may interest your clients.</p>'
    },
    'Wedding & Convention Halls': {
      subject: 'Collaboration opportunity with {{Company}}',
      body: '<p>Dear {{Company}} Management,</p><p>We would like to explore a partnership regarding your event venue services.</p>'
    },
    'Highway Fuel, EV & Logistics': {
      subject: 'Strategic Partnership: {{Company}}',
      body: '<p>Hello {{Company}},</p><p>We are exploring opportunities in the highway infrastructure sector.</p>'
    },
    'default': {
      subject: 'Business Inquiry for {{Company}}',
      body: '<p>Dear {{Company}} Team,</p><p>We would like to connect regarding potential business opportunities.</p>'
    }
  };

  return templates[category] || templates['default'];
}

async function sendEmail(company) {
  const template = selectTemplate(company.Category);
  const subject = template.subject.replace('{{Company}}', company.Company);
  const body = template.body.replace(/{{Company}}/g, company.Company);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'Suresh Kumar <smartpos.systems@gmail.com>',
      to: ["prem.rajini.suresh@gmail.com"],
      subject: subject,
      html: body
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(JSON.stringify(errorData));
  }

  return await response.json();
}

async function processCompany(company) {

if (!validateEmail(company.Email)) {
    console.log("INVALID EMAIL:", company.Email);
    return "Skipped";
}

if (company.EmailSent === true) {
    console.log("ALREADY SENT");
    return "Skipped";
}
  try {
    await sendEmail(company);
    company.EmailSent = true;
    company.EmailSentDate = new Date().toISOString();
    company.EmailStatus = 'Sent';
    company.LastError = '';
    return 'Sent';
  } catch (error) {
    company.EmailStatus = 'Failed';
    company.LastError = error.message;
    return 'Failed';
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
    process.exit(1);
  }

  const db = await loadDatabase();
  
  // TEST MODE
db.companies = db.companies.slice(0,1);
 
  let stats = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (const company of db.companies) {
    stats.processed++;
    const result = await processCompany(company);
    
    if (result === 'Sent') stats.sent++;
    else if (result === 'Skipped') stats.skipped++;
    else if (result === 'Failed') stats.failed++;

    console.log(`${result}: ${company.Company}`);
    await sleep(1000);
  }

  await saveDatabase(db);
  console.log('Completed Successfully');
  console.log(`Stats: Processed: ${stats.processed}, Sent: ${stats.sent}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);
}

main().catch(err => {
  console.error('Critical Error:', err);
  process.exit(1);
});
