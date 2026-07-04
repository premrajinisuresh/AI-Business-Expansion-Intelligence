/* ==========================================
   AI Business Expansion Intelligence
   intelligence.js Version 1.0
========================================== */

const INTELLIGENCE = {

    property: {
        title: "23.5 Cent Premium Corner Commercial Land",
        location: "Alagarkovil Highway, Madurai"
    },

    weights: {
        location: 30,
        industry: 30,
        frontage: 20,
        investment: 20
    }

};

/* ==========================================
   Calculate Match Score
========================================== */

function calculateMatch(company){

    let score = 0;

    if(company.industry)
        score += getIndustryScore(company.industry) * 0.4;

    if(company.location &&
       company.location.toLowerCase().includes("madurai"))
        score += 30;

    if(company.expanding === true)
        score += 20;

    return Math.min(Math.round(score),100);

}

/* ==========================================
   Priority
========================================== */

function getPriority(score){

    if(score>=90) return "HIGH";
    if(score>=75) return "MEDIUM";
    if(score>=60) return "LOW";

    return "IGNORE";

}

/* ==========================================
   Recommendation
========================================== */

function buildRecommendation(company){

    const score = calculateMatch(company);

    return {

        company: company.name,

        industry: company.industry,

        score: score,

        stars: getStars(score),

        priority: getPriority(score)

    };

}

/* ==========================================
   Daily Research Tasks
========================================== */

function todayResearch(){

    return [

        "Hotels",
        "Restaurants",
        "Petrol",
        "Retail",
        "Builders",
        "Logistics",
        "Warehouses",
        "Tourism"

    ];

}

/* ==========================================
   Display Research Plan
========================================== */

function showResearchPlan(){

    console.table(todayResearch());

}

/* ==========================================
   Startup
========================================== */

console.log("Intelligence Engine Loaded");

showResearchPlan();
