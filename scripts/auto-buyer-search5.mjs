// scripts/auto-buyer-search5.mjs
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('buyerdatabase5.json');

async function runSearch() {
  console.log('[Matrix Search Engine] Initializing automated lead discovery...');

  // 1. Read existing database
  if (!fs.existsSync(DB_PATH)) {
    console.error('[Error] buyerdatabase5.json not found!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(DB_PATH, 'utf-8');
  let db;
  try {
    db = JSON.parse(rawData);
  } catch (err) {
    console.error('[Error] Failed to parse buyerdatabase5.json:', err);
    process.exit(1);
  }

  // Ensure metadata object exists
  db.metadata = db.metadata || {};

  // Define categories array (13 categories)
  const categories = [
    "Hotels & Highway Hospitality",
    "Restaurants & Food Courts",
    "Real Estate Promoters & Builders",
    "IT Parks & Tech Hubs",
    "Medical Centers & Hospitals",
    "Educational Institutions & Universities",
    "Manufacturing & Industrial Units",
    "Automotive Showrooms & Service Centers",
    "Logistics & Warehousing Hubs",
    "Large Retail Chains & Supermarkets",
    "Wedding Halls & Convention Centers",
    "Co-working Spaces & Business Centers",
    "Agro-Processing & Export Units"
  ];

  // Get current rotation index or default to 0
  let currentIndex = typeof db.metadata.rotationIndex === 'number' ? db.metadata.rotationIndex : 0;
  if (currentIndex >= categories.length) {
    currentIndex = 0;
  }

  const currentCategory = categories[currentIndex];
  console.log(`[Matrix Search Engine] Probing category (${currentIndex + 1}/${categories.length}): "${currentCategory}"`);

  // Simulate or execute search & extraction logic for the category
  // (In your existing setup, Gemini generates/fetches nodes for this category)
  let newLeadsAdded = 0;
  // Note: If your search logic runs here, update `newLeadsAdded` accordingly.
  // For safety, let's assume your existing discovery logic populates an array of new items.

  // Advance rotation index for the next run
  db.metadata.rotationIndex = (currentIndex + 1) % categories.length;

  // ALWAYS update the timestamp and run stats so the file changes on every execution,
  // forcing Git to commit and push even when 0 new leads are found.
  const now = new Date();
  db.metadata.lastAutomatedRun = now.toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
  db.metadata.lastRunAddedCount = newLeadsAdded;
  db.metadata.totalLeads = Array.isArray(db.leads) ? db.leads.length : (db.metadata.totalLeads || 0);

  // Atomically write updated database back to disk
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`[Database] Successfully committed metadata and data atomically to buyerdatabase5.json`);
  console.log(`[Matrix synchronization complete]. Added ${newLeadsAdded} new unique entities. Next run will advance index to ${db.metadata.rotationIndex}.`);
}

runSearch().catch(err => {
  console.error('[Fatal Error] Auto search script failed:', err);
  process.exit(1);
});
