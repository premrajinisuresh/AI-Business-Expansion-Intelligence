/* ==========================================
 AI Business Expansion Intelligence
 app.js Version 2
========================================== */

const APP = {

    version: "2.0",

    property: "23.5 Cents Commercial Corner Plot",

    location: "Alagarkovil Highway, Madurai"

};

/* -----------------------------
   Start Application
------------------------------*/

document.addEventListener("DOMContentLoaded", function(){

    console.log("AI Business Expansion Intelligence");

    console.log(APP);

    updateToday();

});

/* -----------------------------
   Date
------------------------------*/

function updateToday(){

    let d = new Date();

    console.log("Today :", d.toDateString());

}

/* -----------------------------
   Navigation
------------------------------*/

function home(){

    location.href="index.html";

}

function research(){

    location.href="research.html";

}

function company(){

    location.href="company.html";

}

function prospects(){

    location.href="Prospects.html";

}

function dashboard(){

    location.href="dashboard.html";

}

function settings(){

    location.href="settings.html";

}

/* -----------------------------
   Buyer Hunter
------------------------------*/

function openGoogle(){

    window.open(
    "https://www.google.com/search?q=Madurai+commercial+projects",
    "_blank");

}

function openHotels(){

    window.open(
    "https://www.google.com/search?q=Hotels+expanding+Madurai",
    "_blank");

}

function openBuilders(){

    window.open(
    "https://www.google.com/search?q=Builders+Madurai",
    "_blank");

}

function openRestaurant(){

    window.open(
    "https://www.google.com/search?q=Restaurant+franchise+Tamil+Nadu",
    "_blank");

}

function openPetrol(){

    window.open(
    "https://www.google.com/search?q=Petrol+bunk+dealership+Tamil+Nadu",
    "_blank");

}

function openWarehouse(){

    window.open(
    "https://www.google.com/search?q=Warehouse+companies+Madurai",
    "_blank");

}

function openHospital(){

    window.open(
    "https://www.google.com/search?q=Hospitals+expanding+Madurai",
    "_blank");

}

function openRetail(){

    window.open(
    "https://www.google.com/search?q=Retail+chains+Tamil+Nadu",
    "_blank");

}

/* -----------------------------
   AI Match
------------------------------*/

function score(industry){

    switch(industry){

        case "Hotel":
            return "★★★★★";

        case "Restaurant":
            return "★★★★★";

        case "Petrol":
            return "★★★★★";

        case "Retail":
            return "★★★★☆";

        case "Warehouse":
            return "★★★★☆";

        case "Hospital":
            return "★★★☆☆";

        default:
            return "★★☆☆☆";

    }

}

/* -----------------------------
   CRM
------------------------------*/

let crm=[];

function addCompany(name){

    crm.push(name);

    console.log(crm);

}

function totalCompanies(){

    return crm.length;

}

/* -----------------------------
   Daily Counter
------------------------------*/

let stats={

    research:0,

    companies:0,

    prospects:0,

    followup:0,

    meeting:0

};

function increase(item){

    if(stats[item]!=undefined){

        stats[item]++;

        console.log(stats);

    }

}

/* -----------------------------
   Property Information
------------------------------*/

function propertyInfo(){

    alert(

"23.5 Cents\\n"+

"Corner Plot\\n"+

"Alagarkovil Highway\\n"+

"Madurai\\n"+

"Direct Owner"

    );

}

/* -----------------------------
   Version
------------------------------*/

console.log("Version 2 Ready");
