import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";
import {assignRosterRarities} from "../assets/js/rarity.js";

const publicData=JSON.parse(await readFile("dist/data/public-teams.json","utf8"));
const localData=JSON.parse(await readFile("dist/data/practice-rosters.json","utf8"));
const localById=new Map(localData.teams.map(team=>[team.id,team]));
const allowed=new Set(["Common","Rare","Niche","Legendary","Ball Knowledge"]);

test("public build contains metadata for all 240 tournament squads",()=>{
 assert.equal(publicData.teams.length,240);
 assert.equal(new Set(publicData.teams.map(team=>team.id)).size,240);
});

test("all 240 squads have complete local rosters for unranked offline gameplay",()=>{
 assert.equal(localData.teams.length,240);
 assert.equal(localById.size,240);
 for(const team of publicData.teams){
  const local=localById.get(team.id);
  assert.ok(local,"Missing local roster: "+team.id);
  assert.equal(local.players.length,team.total,"Incorrect roster size: "+team.id);
  assert.ok(local.players.length>0,"Empty roster: "+team.id);
 }
});

test("public build includes complete data attribution and license notes",async()=>{
 const attribution=await readFile("dist/data/ATTRIBUTION.txt","utf8");
 assert.match(attribution,/CC BY-SA 4\.0/);
 assert.match(attribution,/OpenFootball/);
 assert.match(attribution,/answer rosters in dist\/data\/practice-rosters\.json/);
});

test("raw source roster files are absent from the public deployment",async()=>{
 for(const path of ["dist/data/worldcup-2026.json","dist/data/historical-squads.json","dist/data/roster-audit.json"]){
  await assert.rejects(access(path));
 }
});

test("only independently verified players receive rarity assignments",()=>{
 let verifiedTeams=0,verifiedPlayers=0,unverifiedPlayers=0;
 for(const team of publicData.teams){
  const local=localById.get(team.id);
  if(team.verified){
   verifiedTeams++;
   verifiedPlayers+=local.players.length;
   for(const player of local.players){
    assert.ok(allowed.has(player.rarity),"Verified player has no valid rarity: "+team.id+" / "+player.name);
   }
  }else{
   unverifiedPlayers+=local.players.length;
   for(const player of local.players){
    assert.equal(player.rarity,undefined,"Unverified player was assigned a rarity: "+team.id+" / "+player.name);
   }
  }
 }
 assert.ok(verifiedTeams>0);
 assert.ok(verifiedPlayers>0);
 assert.ok(unverifiedPlayers>0);
 assert.equal(localData.teams.reduce((sum,team)=>sum+team.players.length,0),5759);
});

test("rarity rebuild is deterministic and does not alter unverified squads",()=>{
 const generated=structuredClone(localData);
 const beforeUnverified=new Map(generated.teams
  .filter(team=>publicData.teams.find(meta=>meta.id===team.id)?.verified!==true)
  .map(team=>[team.id,JSON.stringify(team.players)]));
 assignRosterRarities(generated,publicData);
 for(const team of generated.teams){
  const verified=publicData.teams.find(meta=>meta.id===team.id)?.verified===true;
  if(!verified)assert.equal(JSON.stringify(team.players),beforeUnverified.get(team.id));
  else for(const player of team.players)assert.ok(allowed.has(player.rarity));
 }
 const first=new Map(generated.teams.map(team=>[team.id,team.players.map(player=>player.rarity)]));
 assignRosterRarities(generated,publicData);
 for(const team of generated.teams){
  assert.deepEqual(team.players.map(player=>player.rarity),first.get(team.id),team.id+" rarity must be deterministic");
 }
 const france=generated.teams.find(team=>team.id==="france-2018");
 const famousFrancePlayers=["Hugo Lloris","Raphaël Varane","Paul Pogba","Antoine Griezmann","Olivier Giroud","Kylian Mbappé","Ousmane Dembélé","N'Golo Kanté","Steve Mandanda"];
 for(const name of famousFrancePlayers){
  assert.equal(france.players.find(player=>player.name===name)?.rarity,"Common",name+" must remain Common");
 }
});
