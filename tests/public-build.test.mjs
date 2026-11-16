import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";

const publicData=JSON.parse(await readFile("dist/data/public-teams.json","utf8"));
const practiceData=JSON.parse(await readFile("dist/data/practice-rosters.json","utf8"));
const practiceIds=new Set(practiceData.teams.map(team=>team.id));

test("public build contains metadata for all 240 tournament squads",()=>{
 assert.equal(publicData.teams.length,240);
 assert.equal(new Set(publicData.teams.map(team=>team.id)).size,240);
});

test("verified answer rosters are never shipped to the browser",()=>{
 const verified=publicData.teams.filter(team=>team.verified);
 assert.equal(verified.length,9);
 for(const team of verified){
  assert.equal(practiceIds.has(team.id),false);
  assert.equal(Object.hasOwn(team,"players"),false);
 }
});

test("only unverified teams are included as local practice rosters",()=>{
 assert.equal(practiceData.teams.length,231);
 for(const team of practiceData.teams){
  assert.equal(publicData.teams.find(item=>item.id===team.id)?.verified,false);
  assert.ok(team.players.length>0);
 }
});

test("raw source roster files are absent from the public deployment",async()=>{
 for(const path of ["dist/data/worldcup-2026.json","dist/data/historical-squads.json","dist/data/roster-audit.json"]){
  await assert.rejects(access(path));
 }
});
