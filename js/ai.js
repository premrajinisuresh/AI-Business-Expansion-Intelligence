/* ==========================================
   AI Business Expansion Intelligence
   ai.js Version 1.0
========================================== */

const AI = {

    property: {
        title: "23.5 Cent Corner Commercial Land",
        location: "Alagarkovil Highway, Madurai",
        frontage: 46,
        size: 23.5
    }

};

/* ==========================================
   Industry Match Score
========================================== */

function getIndustryScore(industry){

    industry = industry.toLowerCase();

    switch(industry){

        case "hotel":
        case "hotels":
            return 98;

        case "restaurant":
        case "restaurants":
            return 97;

        case "petrol":
            return 98;

        case "ev":
            return 96;

        case "retail":
            return 95;

        case "builder":
        case "builders":
            return 94;

        case "warehouse":
            return 93;

        case "logistics":
            return 92;

        case "tourism":
            return 96;

        case "hospital":
            return 88;

        case "school":
            return 85;

        default:
            return 60;

    }

}

/* ==========================================
   Convert Score to Stars
========================================== */

function getStars(score){

    if(score>=95) return "★★★★★";

    if(score>=90) return "★★★★☆";

    if(score>=80) return "★★★☆☆";

    if(score>=70) return "★★☆☆☆";

    return "★☆☆☆☆";

}

/* ==========================================
   AI Recommendation
========================================== */

function recommendation(industry){

    let score=getIndustryScore(industry);

    let stars=getStars(score);

    return {

        industry:industry,

        score:score,

        stars:stars

    };

}

/* ==========================================
   Property Advantages
========================================== */

function advantages(){

    return [

        "Highway Frontage",

        "Corner Plot",

        "Commercial Potential",

        "Temple Tourism",

        "High Visibility",

        "Investment Growth"

    ];

}

/* ==========================================
   Daily AI Suggestion
========================================== */

function todaySuggestion(){

    return [

        "Research Hotels",

        "Research Restaurants",

        "Research Petrol Companies",

        "Research Retail Chains",

        "Research Logistics"

    ];

}

/* ==========================================
   AI Summary
========================================== */

function showAISummary(){

    console.log("===== AI SUMMARY =====");

    console.log(AI.property);

    console.table(todaySuggestion());

    console.table(advantages());

}

/* ==========================================
   Test
========================================== */

console.log(recommendation("Hotel"));

console.log("ai.js loaded");
