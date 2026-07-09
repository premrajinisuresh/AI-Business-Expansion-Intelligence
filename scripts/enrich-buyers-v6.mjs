
import fs from 'node:fs';

const DB = 'buyerdatabase5.json';

if (!fs.existsSync(DB)) {
  console.error('Database not found.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(DB, 'utf8'));

if (!Array.isArray(data.companies)) {
  console.error('companies array not found.');
  process.exit(1);
}

let updated = 0;

for (const company of data.companies) {

  // Add new fields if they don't exist
  company.ContactPage ??= "";
  company.LinkedIn ??= "";
  company.Facebook ??= "";
  company.Instagram ??= "";
  company.X ??= "";
  company.YouTube ??= "";
  company.GoogleMaps ??= "";
  company.WhatsApp ??= "";

  // Skip companies that already have these fields filled
  if (
    company.LinkedIn ||
    company.Facebook ||
    company.Instagram ||
    company.GoogleMaps
  ) {
    continue;
  }

  console.log(`Needs enrichment: ${company.Company}`);
  updated++;
}

fs.writeFileSync(DB, JSON.stringify(data, null, 2));

console.log(`Companies needing enrichment: ${updated}`);
console.log("V6 enrichment completed.");
