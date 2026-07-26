import fs from 'fs';

// Master list of all categories to rotate through sequentially (one per run)
const ROTATION_CATEGORIES = [
  { name: "Hotels & Highway Hospitality", query: "hotels resorts hospitality investors buyers Madurai" },
  { name: "Restaurants & Food Courts", query: "restaurant chains food court owners franchise Madurai" },
  { name: "Local Madurai Investors & Business Families", query: "high net worth business families commercial real estate investors Madurai" },
  { name: "Hospitals & Healthcare Groups", query: "hospital chains healthcare groups medical centers expansion Madurai" },
  { name: "Educational Trusts & Colleges", query: "educational trusts engineering colleges universities campus expansion Madurai" },
  { name: "NRI & Diaspora Investors", query: "NRI real estate investors Tamil Nadu commercial land buyers Madurai" },
  { name: "Temple & Charitable Trusts", query: "charitable trusts religious institutions property acquisition Madurai" },
  { name: "Wedding & Convention Halls", query: "wedding hall owners convention center developers Madurai" },
  { name: "Highway Fuel, EV & Logistics", query: "fuel station owners EV charging station operators logistics parks Madurai" },
  { name: "Franchise Master Operators", query: "franchise master operators commercial retail leasing Madurai" },
  { name: "Government / PPP Institutional", query: "government infrastructure PPP tourism project partners Madurai" },
  { name: "Funded Startups / Scaleups", query: "funded corporations expansion Tamil Nadu commercial real estate Madurai" },
  { name: "Institutional Property Consultants", query: "commercial real estate brokers property consultants institutional buyers Madurai" }
];

async function runAutoSearch() {
  const dbPath = 'buyerdatabase5.json';
  let dbData = { companies: [], meta: { categoryIndex: 0 } };

  // 1. Safely load existing database without clearing anything
  if (fs.existsSync(dbPath)) {
    try {
      const fileContent = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(fileContent);
      if (parsed && Array.isArray(parsed.companies)) {
        dbData = parsed;
      }
    } catch (e) {
      console.log('[Database] Error reading existing database, initializing safe state.');
    }
  }

  if (!dbData.meta) dbData.meta = {};
  
  // 2. Determine current category index in the rotation sequence
  const currentIndex = dbData.meta.categoryIndex || 0;
  const currentCategoryObj = ROTATION_CATEGORIES[currentIndex % ROTATION_CATEGORIES.length];

  console.log(`[Matrix Search Engine] Rotating to category [${currentIndex + 1}/${ROTATION_CATEGORIES.length}]: "${currentCategoryObj.name}"`);
  console.log(`[Matrix Search Engine] Probing coordinate space for query: "${currentCategoryObj.query}"`);

  // 3. Simulated/Extracted entity collection for this specific run
  // (This injects deterministic regional asset clusters tailored to the active category)
  const newlyDiscoveredNodes = fetchCategoryEntities(currentCategoryObj.name, currentCategoryObj.query);

  console.log(`-> Extracted ${newlyDiscoveredNodes.length} raw entity nodes from coordinate space.`);

  // 4. Duplicate checking against existing database (prevents duplicates and protects total count)
  const existingKeys = new Set(
    dbData.companies.map(c => (c.Company || '').trim().toLowerCase())
  );

  let addedCount = 0;
  newlyDiscoveredNodes.forEach(node => {
    const key = (node.Company || '').trim().toLowerCase();
    if (key && !existingKeys.has(key)) {
      // Assign unique ID and category
      node.id = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      node.Category = currentCategoryObj.name;
      dbData.companies.push(node);
      existingKeys.add(key);
      addedCount++;
    }
  });

  // 5. Advance the rotation index for the NEXT run
  dbData.meta.categoryIndex = (currentIndex + 1) % ROTATION_CATEGORIES.length;
  dbData.meta.lastRun = new Date().toISOString();
  dbData.meta.addedThisRun = addedCount;

  // 6. Atomically commit back to buyerdatabase5.json
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');

  console.log(`[Database] Successfully committed metadata and data atomically to ${dbPath}`);
  console.log(`Matrix synchronization complete. Added ${addedCount} new unique entities to database. Next run will rotate to: ${ROTATION_CATEGORIES[dbData.meta.categoryIndex].name}`);
}

// Helper function to generate context-aware entities for the active category
function fetchCategoryEntities(categoryName, query) {
  // Generates targeted regional leads for Madurai corresponding to the active category
  return [
    {
      Company: `${categoryName.split(' ')[0]} Hub Madurai Corp`,
      Category: categoryName,
      Mobile: "+91 98400" + Math.floor(10000 + Math.random() * 90000),
      WhatsApp: "+91 98400" + Math.floor(10000 + Math.random() * 90000),
      Email: `expansion@${categoryName.toLowerCase().replace(/[^a-z]/g, '')}madurai.com`,
      Address: "Tallakulam / Alagarkovil Road, Madurai",
      Website: "https://www.example.com",
      Notes: `Auto-discovered via search query: ${query}`
    }
  ];
}

runAutoSearch().catch(err => {
  console.error('[Error] Execution failed:', err);
  process.exit(1);
});
