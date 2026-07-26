/* ============================================================
   js/buyerfinder5.js
   FRONT-END CONTROLLER & DYNAMIC METADATA RENDERER
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const metaInfo = document.getElementById("metaInfo");
  const dbBody = document.getElementById("dbBody");
  const statTotal = document.getElementById("statTotal");
  const statNew = document.getElementById("statNew");
  const statContacted = document.getElementById("statContacted");
  const statInterested = document.getElementById("statInterested");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchBox = document.getElementById("searchBox");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportBtn = document.getElementById("exportBtn");

  let allCompanies = [];

  async function loadData() {
    try {
      metaInfo.textContent = "Loading latest buyer intelligence...";
      const res = await fetch("buyerdatabase5.json?t=" + Date.now());
      if (!res.ok) throw new Error("Failed to fetch database");
      const json = await res.json();

      let companies = [];
      let lastRunStr = "Recent run";
      let addedCount = 0;

      // Handle both raw arrays and metadata-wrapped objects seamlessly
      if (Array.isArray(json)) {
        companies = json;
      } else if (json && Array.isArray(json.companies)) {
        companies = json.companies;
        lastRunStr = json.lastRun || json.meta?.lastRun || "Recent run";
        addedCount = json.addedThisRun !== undefined ? json.addedThisRun : (json.meta?.addedThisRun || 0);
      }

      allCompanies = companies;

      // Dynamically update the metadata banner text exactly as requested
      metaInfo.textContent = `Last automated run: ${lastRunStr} · Added ${addedCount} new lead(s) that run · ${allCompanies.length} total in database`;

      updateStats(allCompanies);
      populateCategories(allCompanies);
      renderLeads(allCompanies);
    } catch (e) {
      metaInfo.textContent = `Error loading database: ${e.message}`;
    }
  }

  function updateStats(companies) {
    const total = companies.length;
    const newCount = companies.filter(c => (c.Status || "New") === "New").length;
    const contacted = companies.filter(c => c.Status === "Contacted").length;
    const interested = companies.filter(c => c.Status === "Interested").length;

    statTotal.textContent = total;
    statNew.textContent = newCount;
    statContacted.textContent = contacted;
    statInterested.textContent = interested;
  }

  function populateCategories(companies) {
    const categories = [...new Set(companies.map(c => c.Category || "General"))].sort();
    const currentVal = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
    categoryFilter.value = currentVal;
  }

  function renderLeads(companies) {
    const catVal = categoryFilter.value.toLowerCase();
    const statusVal = statusFilter.value.toLowerCase();
    const searchVal = searchBox.value.toLowerCase();

    const filtered = companies.filter(c => {
      const matchCat = !catVal || (c.Category || "General").toLowerCase() === catVal;
      const matchStatus = !statusVal || (c.Status || "New").toLowerCase() === statusVal;
      const matchSearch = !searchVal || 
        (c.Company || "").toLowerCase().includes(searchVal) || 
        (c.Notes || "").toLowerCase().includes(searchVal) ||
        (c.City || "").toLowerCase().includes(searchVal);
      return matchCat && matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      dbBody.innerHTML = '<div class="bf-empty">No matching leads found.</div>';
      return;
    }

    dbBody.innerHTML = filtered.map((c) => {
      const status = c.Status || "New";
      const mobile = c.Mobile && c.Mobile !== "Not public" ? c.Mobile : "";
      const whatsapp = c.WhatsApp && c.WhatsApp !== "Not public" ? c.WhatsApp : (mobile ? `https://wa.me/${mobile}` : "");
      
      return `
        <div class="bf-lead-card">
          <div class="bf-lead-head">
            <div>
              <div class="bf-company">${escapeHtml(c.Company)}</div>
              <div class="bf-cat">${escapeHtml(c.Category || "General")}</div>
            </div>
            <select class="bf-status-select" data-company="${escapeHtml(c.Company)}">
              <option value="New" ${status === "New" ? "selected" : ""}>New</option>
              <option value="Contacted" ${status === "Contacted" ? "selected" : ""}>Contacted</option>
              <option value="Interested" ${status === "Interested" ? "selected" : ""}>Interested</option>
              <option value="Not Interested" ${status === "Not Interested" ? "selected" : ""}>Not Interested</option>
              <option value="Closed" ${status === "Closed" ? "selected" : ""}>Closed</option>
            </select>
          </div>
          <div class="bf-fields">
            ${mobile ? `<div class="bf-field"><span class="bf-field-label">Mobile:</span> ${escapeHtml(mobile)}</div>` : ''}
            <div class="bf-field"><span class="bf-field-label">Address:</span> ${escapeHtml(c.Address || c.City || "Madurai")}</div>
            ${c.Website && c.Website !== "Not public" ? `<div class="bf-field"><span class="bf-field-label">Website:</span> <a href="${escapeHtml(c.Website)}" target="_blank">${escapeHtml(c.Website)}</a></div>` : ''}
          </div>
          ${whatsapp ? `
            <div class="bf-actions">
              <button class="bf-btn-wa" onclick="window.open('${escapeHtml(whatsapp)}', '_blank')">💬 WhatsApp</button>
            </div>
          ` : '<div class="bf-no-contact">No contact info yet</div>'}
        </div>
      `;
    }).join("");

    document.querySelectorAll(".bf-status-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const compName = e.target.getAttribute("data-company");
        const found = allCompanies.find(x => x.Company === compName);
        if (found) {
          found.Status = e.target.value;
          updateStats(allCompanies);
        }
      });
    });
  }

  function exportCSV() {
    let csv = "Company,Category,City,Mobile,WhatsApp,Status\n";
    allCompanies.forEach(c => {
      csv += `"${(c.Company || "").replace(/"/g, '""')}","${(c.Category || "").replace(/"/g, '""')}","${(c.City || "").replace(/"/g, '""')}","${(c.Mobile || "").replace(/"/g, '""')}","${(c.WhatsApp || "").replace(/"/g, '""')}","${(c.Status || "New")}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "buyer_database_v5.csv";
    a.click();
  }

  function escapeHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  categoryFilter.addEventListener("change", () => renderLeads(allCompanies));
  statusFilter.addEventListener("change", () => renderLeads(allCompanies));
  searchBox.addEventListener("input", () => renderLeads(allCompanies));
  refreshBtn.addEventListener("click", loadData);
  exportBtn.addEventListener("click", exportCSV);

  loadData();
});
