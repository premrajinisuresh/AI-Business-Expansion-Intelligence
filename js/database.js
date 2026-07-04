/* ==========================================
   AI Business Expansion Intelligence
   database.js Version 1.0
========================================== */

const DATABASE = {

    companies: [],
    prospects: [],
    industries: [],
    searches: []

};

/* ==========================================
   Load JSON Files
========================================== */

async function loadDatabase(){

    try{

        DATABASE.companies =
        await fetch("data/companies.json")
        .then(r=>r.json());

        DATABASE.prospects =
        await fetch("data/prospects.json")
        .then(r=>r.json());

        DATABASE.industries =
        await fetch("data/industries.json")
        .then(r=>r.json());

        DATABASE.searches =
        await fetch("data/searches.json")
        .then(r=>r.json());

        console.log("Database Loaded");

        console.log(DATABASE);

    }

    catch(e){

        console.error(e);

    }

}

/* ==========================================
   Statistics
========================================== */

function totalCompanies(){

    return DATABASE.companies.length;

}

function totalProspects(){

    return DATABASE.prospects.length;

}

function totalIndustries(){

    return DATABASE.industries.length;

}

function totalSearches(){

    return DATABASE.searches.length;

}

/* ==========================================
   Search Company
========================================== */

function findCompany(name){

    return DATABASE.companies.find(c=>{

        return c.name &&
        c.name.toLowerCase()==name.toLowerCase();

    });

}

/* ==========================================
   Add Company
========================================== */

function addCompany(company){

    DATABASE.companies.push(company);

    console.log("Company Added");

}

/* ==========================================
   Add Prospect
========================================== */

function addProspect(prospect){

    DATABASE.prospects.push(prospect);

    console.log("Prospect Added");

}

/* ==========================================
   Dashboard
========================================== */

function dashboardStats(){

    console.table({

        Companies:totalCompanies(),

        Prospects:totalProspects(),

        Industries:totalIndustries(),

        Searches:totalSearches()

    });

}

/* ==========================================
   Start
========================================== */

document.addEventListener(

"DOMContentLoaded",

function(){

    loadDatabase();

}

);

console.log("database.js loaded");
