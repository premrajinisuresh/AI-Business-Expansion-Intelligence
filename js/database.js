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


           function saveProspect(){


const prospect={

company:document.getElementById("companyName").value,

industry:document.getElementById("companyIndustry").value,

location:document.getElementById("companyLocation").value,

decisionMaker:document.querySelector('input[placeholder="Decision Maker"]').value,

phone:document.querySelector('input[placeholder="Phone / Email"]').value,

status:document.querySelector("select").value,

date:new Date().toLocaleDateString()

};



              
let prospects=JSON.parse(localStorage.getItem("prospects")) || [];

prospects.push(prospect);

localStorage.setItem("prospects",JSON.stringify(prospects));
console.log(prospects);
alert("Prospect Saved Successfully");

}



function loadProspects(){

let prospects =
JSON.parse(localStorage.getItem("prospects")) || [];

let body =
document.getElementById("prospectBody");

if(!body) return;

body.innerHTML = "";

prospects.forEach(function(p){

body.innerHTML += `
<div class="card">
    <h3>${p.company}</h3>
    <p><b>Industry:</b> ${p.industry}</p>
    <p><b>Location:</b> ${p.location}</p>
    <p><b>Decision Maker:</b> ${p.decisionMaker}</p>
    <p><b>Phone:</b> ${p.phone}</p>
    <p><b>Status:</b> ${p.status}</p>
    <p><b>Date:</b> ${p.date}</p>
</div>
`;

});

}
