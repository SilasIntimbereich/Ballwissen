import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assignRosterRarities,rarityFromEvidence} from "../assets/js/rarity.js";
import {createPlayerRarityResolver} from "../scripts/player-rarity.mjs";

test("evidence scoring recognises an internationally established player",()=>{
 assert.equal(rarityFromEvidence({caps:100,majorAwards:5,globalRecognition:5,clubProfile:5}),"Common");
});

test("team-aware rarity keeps France 2018 familiar and elite tiers scarce",async()=>{
 const [publicData,rosters]=await Promise.all([
  readFile("dist/data/public-teams.json","utf8").then(JSON.parse),
  readFile("dist/data/practice-rosters.json","utf8").then(JSON.parse)
 ]);
 assignRosterRarities(rosters,publicData);
 const all=rosters.teams.flatMap(team=>team.players);
 const counts=Object.fromEntries(["Common","Rare","Niche","Legendary","Ball Knowledge"].map(tier=>[tier,all.filter(player=>player.rarity===tier).length]));
 assert.equal(all.length,5759);
 assert.deepEqual(Object.keys(counts).filter(tier=>counts[tier]>0).sort(),["Ball Knowledge","Common","Legendary","Niche","Rare"].sort());
 assert.ok(counts.Legendary<=10);
 assert.ok(counts["Ball Knowledge"]<=4);
 const france=rosters.teams.find(team=>team.id==="france-2018");
 assert.ok(france.players.filter(player=>player.rarity==="Common").length>=20);
 assert.equal(france.players.find(player=>/kylian mbapp/i.test(player.name)).rarity,"Common");
});

test("Supabase resolver uses the same team-aware rarity algorithm as the browser",async()=>{
 const [historical,worldCup2026,difficulty]=await Promise.all([
  readFile("data/historical-squads.json","utf8").then(JSON.parse),
  readFile("data/worldcup-2026.json","utf8").then(JSON.parse),
  readFile("data/team-difficulty.json","utf8").then(JSON.parse)
 ]);
 const resolve=createPlayerRarityResolver(historical,worldCup2026,difficulty);
 const france2018=historical.tournaments["2018"].find(team=>team.name==="France");
 assert.equal(resolve({name:"Kylian Mbappé"},france2018.id),"Common");
 assert.equal(resolve({name:"Kylian Mbappé"},"france-2026"),"Common");
 let checked=0;
 for(const [year,teams] of Object.entries(historical.tournaments||{})){
  for(const team of teams) for(const player of team.players||[]){
   assert.ok(["Common","Rare","Niche","Legendary","Ball Knowledge"].includes(resolve(player,team.id)));
   checked++;
  }
 }
 for(const player of worldCup2026.players||[]){
  const slug=String(player.team).normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  assert.ok(["Common","Rare","Niche","Legendary","Ball Knowledge"].includes(resolve(player,slug+"-2026")));
  checked++;
 }
 assert.ok(checked>5700);
});
