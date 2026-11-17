import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assignRosterRarities,rarityFromEvidence} from "../assets/js/rarity.js";
import {createPlayerRarityResolver,teamIdFor2026} from "../scripts/player-rarity.mjs";

test("evidence scoring recognises an internationally established player",()=>{
 assert.equal(rarityFromEvidence({caps:100,majorAwards:5,globalRecognition:5,clubProfile:5}),"Common");
});

test("team-aware rarity keeps France 2018 familiar and elite tiers globally scarce",async()=>{
 const [publicData,rosters]=await Promise.all([
  readFile("dist/data/public-teams.json","utf8").then(JSON.parse),
  readFile("dist/data/practice-rosters.json","utf8").then(JSON.parse)
 ]);
 assignRosterRarities(rosters,publicData);
 const all=rosters.teams.flatMap(team=>team.players);
 const counts=Object.fromEntries(["Common","Rare","Niche","Legendary","Ball Knowledge"].map(tier=>[tier,all.filter(player=>player.rarity===tier).length]));
 assert.equal(all.length,5759);
 assert.deepEqual(Object.keys(counts).filter(tier=>counts[tier]>0).sort(),["Ball Knowledge","Common","Legendary","Niche","Rare"].sort());
 assert.ok(counts.Legendary<=10,"Legendary must remain globally scarce");
 assert.ok(counts["Ball Knowledge"]<=4,"Ball Knowledge must remain exceptionally rare");
 for(const team of rosters.teams){
  assert.ok(team.players.filter(player=>["Legendary","Ball Knowledge"].includes(player.rarity)).length<=1,
   team.id+" must not receive multiple elite labels");
 }
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
  assert.ok(["Common","Rare","Niche","Legendary","Ball Knowledge"].includes(resolve(player,teamIdFor2026(player.team))));
  checked++;
 }
 assert.ok(checked>5700);
});

test("Legendary labels are globally limited and never duplicated within one team",()=>{
 const rosters={teams:Array.from({length:8},(_,i)=>({
  id:"team-"+i,
  players:[
   {name:"Unknown "+i+" A",number:1,position:"FW"},
   {name:"Unknown "+i+" B",number:2,position:"FW"},
   {name:"Unknown "+i+" C",number:23,position:"GK"},
   {name:"Known Star "+i,number:10,position:"FW"}
  ]
 }))};
 const metadata={teams:rosters.teams.map((team,i)=>({id:team.id,year:2000+i*4,teamDifficulty:"legendary"}))};
 assignRosterRarities(rosters,metadata);
 const all=rosters.teams.flatMap(team=>team.players);
 assert.equal(all.filter(player=>player.rarity==="Ball Knowledge").length,4);
 assert.equal(all.filter(player=>player.rarity==="Legendary").length,4);
 for(const team of rosters.teams){
  assert.ok(team.players.filter(player=>["Legendary","Ball Knowledge"].includes(player.rarity)).length<=1);
 }
});

test("rarity scoring clamps invalid evidence instead of producing unstable tiers",()=>{
 assert.equal(rarityFromEvidence({caps:Infinity,goals:-100,majorAwards:NaN,globalRecognition:0,clubProfile:0}),"Ball Knowledge");
});

test("counts transliterated spellings as the same player across tournaments",()=>{
 const rosters={teams:[
  {id:"team-2010",players:[{name:"Kjær",position:"FW",number:9}]},
  {id:"team-2018",players:[{name:"Kjaer",position:"FW",number:9}]}
 ]};
 const metadata={teams:[
  {id:"team-2010",year:2010,teamDifficulty:"niche"},
  {id:"team-2018",year:2018,teamDifficulty:"niche"}
 ]};
 assignRosterRarities(rosters,metadata);
 for(const team of rosters.teams)assert.equal(team.players[0].rarity,"Rare");
});
