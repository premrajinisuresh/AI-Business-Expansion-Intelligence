/* =========================================================
   AI Business Expansion Intelligence
   intelligence.js Version 2.0
========================================================= */

const INTELLIGENCE={

version:"2.0",

property:{

title:"23.5 Cent Premium Corner Commercial Land",

location:"Alagarkovil Highway, Madurai",

frontage:46,

size:23.5,

type:"Corner Plot",

pricePerCent:25,

country:"India"

},

weights:{

industry:30,

location:25,

investment:15,

visibility:10,

tourism:10,

road:10

}

};

/* ==========================================
   Company Object
========================================== */

function companyProfile(){

return{

name:"",

industry:"",

location:"",

website:"",

linkedin:"",

phone:"",

email:"",

decisionMaker:"",

designation:"",

expanding:false,

branches:0,

employees:0,

remarks:""

};

}

/* ==========================================
   Property Object
========================================== */

function propertyProfile(){

return{

location:"Alagarkovil Highway",

city:"Madurai",

size:23.5,

frontage:46,

type:"Commercial",

corner:true,

tourism:true,

highway:true,

visibility:true

};

}

/* ==========================================
   Industry Score
========================================== */

function industryScore(industry){

industry=industry.toLowerCase();

switch(industry){

case "hotel":

case "hotels":

return 98;

case "restaurant":

case "restaurants":

return 97;

case "petrol":

return 97;

case "ev":

return 95;

case "retail":

return 94;

case "builder":

case "builders":

return 93;

case "warehouse":

return 92;

case "logistics":

return 91;

case "tourism":

return 95;

case "hospital":

return 88;

case "school":

return 82;

default:

return 60;

}

}


/* ==========================================
   Location Score
========================================== */

function locationScore(location){

if(!location) return 0;

location=location.toLowerCase();

if(location.includes("madurai")) return 25;

if(location.includes("dindigul")) return 20;

if(location.includes("trichy")) return 18;

return 10;

}

/* ==========================================
   Expansion Score
========================================== */

function expansionScore(company){

if(company.expanding===true)

return 20;

return 5;

}

/* ==========================================
   Investment Score
========================================== */

function investmentScore(company){

let score=0;

if(company.industry){

switch(company.industry.toLowerCase()){

case "hotel":

score=15;

break;

case "restaurant":

score=15;

break;

case "petrol":

score=15;

break;

case "retail":

score=14;

break;

case "warehouse":

score=13;

break;

default:

score=8;

}

}

return score;

}

/* ==========================================
   Total Score
========================================== */

function calculateScore(company){

let total=0;

total+=industryScore(company.industry);

total+=locationScore(company.location);

total+=expansionScore(company);

total+=investmentScore(company);

if(total>100)

total=100;

return total;

}

/* ==========================================
   Star Rating
========================================== */

function starRating(score){

if(score>=95)

return "★★★★★";

if(score>=85)

return "★★★★☆";

if(score>=70)

return "★★★☆☆";

if(score>=55)

return "★★☆☆☆";

return "★☆☆☆☆";

}


/* ==========================================
   Priority
========================================== */

function priority(score){

if(score>=95)

return "URGENT";

if(score>=85)

return "HIGH";

if(score>=70)

return "MEDIUM";

if(score>=55)

return "LOW";

return "IGNORE";

}

/* ==========================================
   AI Reason
========================================== */

function reasons(company){

let list=[];

list.push("Highway frontage");

list.push("Corner commercial plot");

list.push("High tourism potential");

list.push("Commercial growth corridor");

if(company.expanding)

list.push("Expansion activity identified");

if(company.location)

list.push("Location : "+company.location);

return list;

}

/* ==========================================
   Next Action
========================================== */

function nextAction(score){

if(score>=95)

return "Call Immediately";

if(score>=85)

return "Find Decision Maker";

if(score>=70)

return "Research Company";

if(score>=55)

return "Monitor";

return "Discard";

}

/* ==========================================
   Complete Analysis
========================================== */

function analyse(company){

const score=calculateScore(company);

return{

company:company.name,

industry:company.industry,

location:company.location,

score:score,

stars:starRating(score),

priority:priority(score),

reasons:reasons(company),

action:nextAction(score)

};

}

/* ==========================================
   Daily Research
========================================== */

function dailyResearch(){

return[

"Hotels",

"Restaurants",

"Petrol",

"Retail",

"Builders",

"Warehouses",

"Logistics",

"Hospitals",

"Tourism"

];

}


/* ==========================================
   Daily Dashboard
========================================== */

function dashboardSummary(){

console.log("========== AI BUSINESS REPORT ==========");

console.log("Property");

console.table(INTELLIGENCE.property);

console.log("Today's Research");

console.table(dailyResearch());

}

/* ==========================================
   AI Recommendation
========================================== */

function recommendation(company){

let result=analyse(company);

console.log("========== AI RECOMMENDATION ==========");

console.table(result);

console.log("Reasons");

console.table(result.reasons);

return result;

}

/* ==========================================
   Research Queue
========================================== */

function researchQueue(){

return[

"Hotels",

"Restaurants",

"Petrol",

"EV Charging",

"Retail Chains",

"Builders",

"Warehouses",

"Logistics",

"Hospitals",

"Schools",

"Tourism",

"Commercial Developers"

];

}

/* ==========================================
   Best Target Industries
========================================== */

function bestTargets(){

return[

{

rank:1,

industry:"Hotels",

score:98

},

{

rank:2,

industry:"Restaurants",

score:97

},

{

rank:3,

industry:"Petrol",

score:97

},

{

rank:4,

industry:"Tourism",

score:96

},

{

rank:5,

industry:"Retail",

score:94

}

];

}

/* ==========================================
   Start Intelligence
========================================== */

console.log("==================================");

console.log("AI Business Expansion Intelligence");

console.log("Version 2.0");

console.log("==================================");

dashboardSummary();

console.table(bestTargets());

console.log("Intelligence Engine Ready");

function runAI(){

const company={

name:document.getElementById("companyName").value,

industry:document.getElementById("companyIndustry").value,

location:document.getElementById("companyLocation").value,

expanding:document.getElementById("companyExpanding").checked

};

const result=recommendation(company);

document.getElementById("aiResult").innerHTML=`

<b>AI BUSINESS ANALYSIS</b>

Company : ${result.company}

Industry : ${result.industry}

Score : ${result.score}

Stars : ${result.stars}

Priority : ${result.priority}

Next Action : ${result.action}

Reasons

${result.reasons.join("\n")}

`;

   }
