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
 assert.equal(matches("CR7",{name:"Cristiano Ronaldo",aliases:["CR7"]}),false);
 assert.equal(matches("Cristiano Ronaldo",{name:"Cristiano Ronaldo",aliases:["CR7"]}),true);
});
test("rejects very short guesses and unrelated names",()=>{
 assert.equal(matches("Leo",{name:"Lionel Messi"}),false);
 assert.equal(matches("Ronaldo",{name:"Ronaldo Nazario"}),false);
});
