import test from "node:test";
import assert from "node:assert/strict";
import {matches,normalize} from "../assets/js/matching.js";

test("normalizes accents, punctuation and spacing",()=>{
 assert.equal(normalize("Kylian Mbappé"),"kylianmbappe");
 assert.equal(normalize("N'Golo Kanté"),"ngolokante");
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

import {readFile} from "node:fs/promises";\nconst worldCup2026=JSON.parse(await readFile(new URL("../data/worldcup-2026.json",import.meta.url),"utf8"));

test("accepts FIFA display-name variants for corrected 2026 squads",()=>{
 const player=(team,number)=>worldCup2026.players.find(row=>row.team===team&&row.number===number);
 assert.equal(matches("Arjan Malic",player("Bosnia and Herzegovina",24)),true);
 assert.equal(matches("Marwane Saadane",player("Morocco",5)),true);
 assert.equal(matches("Amine Sbai",player("Morocco",17)),true);
 assert.equal(matches("Logan Rogerson",player("New Zealand",7)),true);
 assert.equal(matches("Dennis Dargahi",player("Iran",24)),true);
 assert.equal(matches("Cameron Devlin",player("Australia",14)),true);
});
