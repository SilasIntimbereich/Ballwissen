import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assignRosterRarities,rarityFromEvidence} from "../assets/js/rarity.js";
import {createPlayerRarityResolver,teamIdFor2026} from "../scripts/player-rarity.mjs";

test("evidence scoring recognises an internationally established player",()=>{
 assert.equal(rarityFromEvidence({caps:100,majorAwards:5,globalRecognition:5,clubProfile:5}),"Common");
});

test("team-aware rarity keeps France 2018 familiar and assigns elite picks per Legendary squad",async()=>{
 const [publicData,rosters]=await Promise.all([
  readFile("dist/data/public-teams.json","utf8").then(JSON.parse),
  readFile("dist/data/practice-rosters.json","utf8").then(JSON.parse)
 ]);
 assignRosterRarities(rosters,publicData);
 const all=rosters.teams.flatMap(team=>team.players);
 const counts=Object.fromEntries(["Common","Rare","Niche","Legendary","Ball Knowledge"].map(tier=>[tier,all.filter(player=>player.rarity===tier).length]));
 assert.equal(all.length,5759);
 assert.deepEqual(Object.keys(counts).filter(tier=>counts[tier]>0).sort(),["Ball Knowledge","Common","Legendary","Niche","Rare"].sort());
 for(const team of rosters.teams){
  const elite=team.players.filter(player=>["Legendary","Ball Knowledge"].includes(player.rarity));
  assert.ok(elite.length<=3,team.id+" must have at most three elite picks");
  assert.ok(elite.filter(player=>player.rarity==="Ball Knowledge").length<=1,
   team.id+" must have at most one Ball Knowledge pick");
  assert.ok(elite.filter(player=>player.rarity==="Legendary").length<=2,
   team.id+" must have at most two Legendary picks");
  if(publicData.teams.find(item=>item.id===team.id)?.teamDifficulty!=="legendary"){
   assert.equal(elite.length,0,team.id+" must not receive elite labels outside Legendary difficulty");
  }
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

test("each Legendary squad receives one Ball Knowledge and two Legendary picks when eligible",()=>{
 const rosters={teams:Array.from({length:8},(_,i)=>({
  id:"team-"+i,
  players:[
   {name:"Unknown "+i+" A",number:1,position:"FW"},
   {name:"Unknown "+i+" B",number:2,position:"FW"},
   {name:"Unknown "+i+" C",number:23,position:"GK"},
   {name:"Lionel Messi",number:10,position:"FW"}
  ]
 }))};
 const metadata={teams:rosters.teams.map((team,i)=>({id:team.id,year:2000+i*4,teamDifficulty:"legendary"}))};
 assignRosterRarities(rosters,metadata);
 const all=rosters.teams.flatMap(team=>team.players);
 assert.equal(all.filter(player=>player.rarity==="Ball Knowledge").length,8);
 assert.equal(all.filter(player=>player.rarity==="Legendary").length,16);
 for(const team of rosters.teams){
  assert.equal(team.players.filter(player=>player.rarity==="Ball Knowledge").length,1);
  assert.equal(team.players.filter(player=>player.rarity==="Legendary").length,2);
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


test("a Legendary squad with fewer than three eligible players does not invent elite picks",()=>{
 const rosters={teams:[{id:"small-legendary",players:[
  {name:"Unknown Reserve",number:23,position:"FW"},
  {name:"Lionel Messi",number:10,position:"FW"}
 ]}]};
 const metadata={teams:[{id:"small-legendary",year:2026,teamDifficulty:"legendary"}]};
 assignRosterRarities(rosters,metadata);
 assert.equal(rosters.teams[0].players.filter(player=>player.rarity==="Ball Knowledge").length,1);
 assert.equal(rosters.teams[0].players.filter(player=>player.rarity==="Legendary").length,0);
});


test("uses higher shirt numbers as a deterministic obscurity tie-breaker",()=>{
 const rosters={teams:[{id:"legendary-tie",players:[
  {name:"Unknown One",number:1,position:"FW"},
  {name:"Unknown Seven",number:7,position:"FW"},
  {name:"Unknown Eighteen",number:18,position:"FW"},
  {name:"Unknown TwentyTwo",number:22,position:"FW"},
  {name:"Lionel Messi",number:10,position:"FW"}
 ]}]};
 const metadata={teams:[{id:"legendary-tie",year:2026,teamDifficulty:"legendary"}]};
 assignRosterRarities(rosters,metadata);
 const byNumber=new Map(rosters.teams[0].players.map(player=>[player.number,player.rarity]));
 assert.equal(byNumber.get(22),"Ball Knowledge");
 assert.equal(byNumber.get(18),"Legendary");
 assert.equal(byNumber.get(7),"Legendary");
 assert.equal(byNumber.get(1),"Niche");
 assert.equal(byNumber.get(10),"Common");
});
