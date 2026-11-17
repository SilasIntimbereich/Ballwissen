import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";
import {assignRosterRarities} from "../assets/js/rarity.js";

const publicData=JSON.parse(await readFile("dist/data/public-teams.json","utf8"));
const localData=JSON.parse(await readFile("dist/data/practice-rosters.json","utf8"));
const localById=new Map(localData.teams.map(team=>[team.id,team]));

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

test("every player in every verified squad has a valid rarity assignment",()=>{
 const allowed=new Set(["Common","Rare","Niche","Legendary","Ball Knowledge"]);
 let verifiedTeams=0,verifiedPlayers=0,allPlayers=0;
 for(const team of publicData.teams){
  const local=localById.get(team.id);
  for(const player of local.players){
   allPlayers++;
   assert.ok(allowed.has(player.rarity),"Missing or invalid rarity: "+team.id+" / "+player.name);
  }
  if(team.verified){
   verifiedTeams++;
   verifiedPlayers+=local.players.length;
   for(const player of local.players){
    assert.ok(allowed.has(player.rarity),"Verified player has no rarity: "+team.id+" / "+player.name);
   }
  }
 }
 assert.ok(verifiedTeams>0,"At least one independently verified squad must be present");
 assert.ok(verifiedPlayers>0,"Verified squads must contain player records");
 assert.equal(allPlayers,5759,"Every source roster player must be packaged with a rarity");
});


test("rarity assignment keeps elite tiers genuinely scarce and famous players Common",()=>{
 const generated=structuredClone(localData);
 assignRosterRarities(generated,publicData);
 const all=generated.teams.flatMap(team=>team.players);
 const counts=Object.fromEntries(["Common","Rare","Niche","Legendary","Ball Knowledge"].map(tier=>[tier,all.filter(player=>player.rarity===tier).length]));
 assert.equal(all.length,5759);
 assert.ok(counts["Legendary"]<=10,"Legendary must stay extremely rare");
 assert.ok(counts["Ball Knowledge"]<=4,"Ball Knowledge must be exceptionally rare");
 const france=generated.teams.find(team=>team.id==="france-2018");
 assert.ok(france.players.filter(player=>player.rarity==="Common").length>=20,"France 2018 should be mostly Common");
 assert.equal(france.players.find(player=>/kylian mbapp/i.test(player.name)).rarity,"Common");
});
