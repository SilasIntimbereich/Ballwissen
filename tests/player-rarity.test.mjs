import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assignRosterRarities,rarityFromEvidence} from "../assets/js/rarity.js";
import {createPlayerRarityResolver,teamIdFor2026} from "../scripts/player-rarity.mjs";

test("evidence scoring recognises an internationally established player",()=>{
 assert.equal(rarityFromEvidence({caps:100,majorAwards:5,globalRecognition:5,clubProfile:5}),"Common");
});

test("team-aware rarity follows the collection-wide target curve and keeps France 2018 familiar",async()=>{
 const [publicData,rosters]=await Promise.all([
  readFile("dist/data/public-teams.json","utf8").then(JSON.parse),
  readFile("dist/data/practice-rosters.json","utf8").then(JSON.parse)
 ]);
 assignRosterRarities(rosters,publicData);
 const all=rosters.teams.flatMap(team=>team.players);
 const counts=Object.fromEntries(["Common","Rare","Niche","Legendary","Ball Knowledge"].map(tier=>[tier,all.filter(player=>player.rarity===tier).length]));
 assert.equal(all.length,5759);
 assert.deepEqual(counts,{
  Common:2809,
  Rare:1873,
  Niche:936,
  Legendary:94,
  "Ball Knowledge":47
 });
 for(const team of rosters.teams){
  if(publicData.teams.find(item=>item.id===team.id)?.teamDifficulty!=="legendary"){
   assert.equal(team.players.some(player=>["Legendary","Ball Knowledge"].includes(player.rarity)),false,
    team.id+" must not receive elite labels outside Legendary difficulty");
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

test("rarity curve scales proportionally and ranks the hardest-to-recall players highest",()=>{
 const teams=Array.from({length:100},(_,teamIndex)=>({
  id:"team-"+String(teamIndex).padStart(3,"0"),
  players:Array.from({length:teamIndex<50?62:61},(_,playerIndex)=>({
   name:"Unknown "+teamIndex+" Player "+playerIndex,
   number:playerIndex+1,
   position:"FW"
  }))
 }));
 const rosters={teams};
 const metadata={teams:teams.map(team=>({id:team.id,year:2000,teamDifficulty:"legendary"}))};
 assignRosterRarities(rosters,metadata);
 const all=teams.flatMap(team=>team.players);
 const counts=Object.fromEntries(["Common","Rare","Niche","Legendary","Ball Knowledge"].map(tier=>[
  tier,all.filter(player=>player.rarity===tier).length
 ]));
 assert.equal(all.length,6150);
 assert.deepEqual(counts,{
  Common:3000,
  Rare:2000,
  Niche:1000,
  Legendary:100,
  "Ball Knowledge":50
 });
 assert.equal(teams[49].players[61].rarity,"Ball Knowledge");
 assert.equal(teams[99].players[60].rarity,"Legendary");
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
 assert.equal(rosters.teams.filter(team=>team.players[0].rarity==="Rare").length,1);
 assert.equal(rosters.teams.filter(team=>team.players[0].rarity==="Common").length,1);
});


test("small rosters do not invent elite tiers when the proportional quota rounds to zero",()=>{
 const rosters={teams:[{id:"small-legendary",players:[
  {name:"Unknown Reserve",number:23,position:"FW"},
  {name:"Lionel Messi",number:10,position:"FW"}
 ]}]};
 const metadata={teams:[{id:"small-legendary",year:2026,teamDifficulty:"legendary"}]};
 assignRosterRarities(rosters,metadata);
 assert.equal(rosters.teams[0].players.filter(player=>player.rarity==="Ball Knowledge").length,0);
 assert.equal(rosters.teams[0].players.filter(player=>player.rarity==="Legendary").length,0);
});



