import test from "node:test";
import assert from "node:assert/strict";
import {matches,normalize} from "../assets/js/matching.js";

test("normalizes accents, punctuation and spacing",()=>{
 assert.equal(normalize("Kylian Mbappé"),"kylianmbappe");
 assert.equal(normalize("N'Golo Kanté"),"ngolokante");
});
test("normalizes common non-decomposing Latin letters",()=>{
 assert.equal(normalize("Kjær"),"kjaer");
 assert.equal(normalize("Nørgaard"),"norgaard");
 assert.equal(normalize("Łukasz"),"lukasz");
 assert.equal(normalize("Straße"),"strasse");
 assert.equal(normalize("João"),"joao");
});
test("accepts ASCII transliterations of player names",()=>{
 assert.equal(matches("Kjaer",{name:"Kjær"}),true);
 assert.equal(matches("Norgaard",{name:"Nørgaard"}),true);
 assert.equal(matches("Lukasz Piszczek",{name:"Łukasz Piszczek"}),true);
 assert.equal(matches("Przemyslaw Frankowski",{name:"Przemysław Frankowski"}),true);
});

test("accepts exact names despite accents and punctuation",()=>{
 assert.equal(matches("Kylian Mbappe",{name:"Kylian Mbappé"}),true);
 assert.equal(matches("N Golo Kante",{name:"N'Golo Kanté"}),true);
});
test("accepts a single minor typo in longer names",()=>{
 assert.equal(matches("Cristiano Ronald",{name:"Cristiano Ronaldo"}),true);
 assert.equal(matches("Ronald",{name:"Ronaldo"}),true);
});
test("supports explicit aliases",()=>{
 assert.equal(matches("CR7",{name:"Cristiano Ronaldo",aliases:["CR7"]}),true);
 assert.equal(matches("Cristiano Ronaldo",{name:"Cristiano Ronaldo",aliases:["CR7"]}),true);
});
test("rejects very short guesses and unrelated names",()=>{
 assert.equal(matches("Leo",{name:"Lionel Messi"}),false);
 assert.equal(matches("Ronaldo",{name:"Ronaldo Nazario"}),false);
});

import {readFile} from "node:fs/promises";
const worldCup2026=JSON.parse(await readFile(new URL("../data/worldcup-2026.json",import.meta.url),"utf8"));

test("accepts FIFA display-name variants for corrected 2026 squads",()=>{
 const player=(team,number)=>worldCup2026.players.find(row=>row.team===team&&row.number===number);
 assert.equal(matches("Arjan Malic",player("Bosnia and Herzegovina",24)),true);
 assert.equal(matches("Marwane Saadane",player("Morocco",5)),true);
 assert.equal(matches("Amine Sbai",player("Morocco",17)),true);
 assert.equal(matches("Logan Rogerson",player("New Zealand",7)),true);
 assert.equal(matches("Dennis Dargahi",player("Iran",24)),true);
 assert.equal(matches("Cameron Devlin",player("Australia",14)),true);
});

test("rejects typo guesses that could match two players",()=>{
 const squad=[{name:"Alex Mendez"},{name:"Alex Mendes"}];
 assert.equal(matches("Alex Mende",squad[0],squad),false);
 assert.equal(matches("Alex Mende",squad[1],squad),false);
});

test("rejects exact aliases that collide with another squad member",()=>{
 const squad=[{name:"Cristiano Ronaldo",aliases:["CR7"]},{name:"CR7"}];
 assert.equal(matches("CR7",squad[0],squad),false);
 assert.equal(matches("CR7",squad[1],squad),false);
});

test("preserves the first exact match for duplicate canonical names",()=>{
 const squad=[{name:"Nam-chol Pak"},{name:"Nam-Chol Pak"}];
 assert.equal(matches("Nam-chol Pak",squad[0],squad),true);
 assert.equal(matches("Nam-chol Pak",squad[1],squad),false);
});

test("uses shirt numbers to disambiguate duplicate player names",()=>{
 const squad=[{name:"Nam-chol Pak",number:4},{name:"Nam-Chol Pak",number:14}];
 assert.equal(matches("Nam-chol Pak #4",squad[0],squad),true);
 assert.equal(matches("#14 Nam-chol Pak",squad[1],squad),true);
 assert.equal(matches("Nam-chol Pak 14",squad[0],squad),false);
});

test("keeps a unique typo match when only one squad member is close",()=>{
 const squad=[{name:"Cristiano Ronaldo"},{name:"Lionel Messi"},{name:"Neymar Junior"}];
 assert.equal(matches("Cristiano Ronald",squad[0],squad),true);
});

test("supports aliases when checking ambiguous surname forms",()=>{
 const squad=[{name:"Joao Pedro dos Santos",aliases:["João Pedro dos Santos"]},{name:"Bernardo Silva"}];
 assert.equal(matches("Dos Santos",squad[0],squad),true);
});
