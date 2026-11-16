import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";

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

test("public build includes complete data attribution and license notes",async()=>{\n const attribution=await readFile("dist/data/ATTRIBUTION.txt","utf8");\n assert.match(attribution,/CC BY-SA 4.0/);\n assert.match(attribution,/OpenFootball/);\n assert.match(attribution,/answer rosters in dist\\/data\\/practice-rosters\\.json/);\n});\n\ntest("raw source roster files are absent from the public deployment",async()=>{
 for(const path of ["dist/data/worldcup-2026.json","dist/data/historical-squads.json","dist/data/roster-audit.json"]){
  await assert.rejects(access(path));
 }
});
