import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRound,submitGuess} from "../assets/js/gameplay.js";
import {matches,normalize} from "../assets/js/matching.js";

const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const worldCup2026=JSON.parse(await readFile("data/worldcup-2026.json","utf8"));
const teams=[
 ...Object.values(historical.tournaments).flat(),
 ...[...new Map(worldCup2026.players.map(player=>[player.team,[]])).keys()].map(name=>({
  id:name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-2026",
  name,players:worldCup2026.players.filter(player=>player.team===name).map(player=>({
   name:player.name,position:player.position,club:player.club,number:player.number
  }))
 }))
];

test("every source-listed player name is accepted in the correct squad slot",()=>{
 let checked=0;
 for(const team of teams){
  const round=createRound(team.players);
  for(const player of team.players){
   const duplicateName=team.players.filter(candidate=>normalize(candidate.name)===normalize(player.name)).length>1;
   const guess=duplicateName?player.name+" "+player.number:player.name;
   const outcome=submitGuess(round,guess,matches);
   assert.equal(outcome.status,"correct",team.id+" should accept "+guess);
   assert.equal(outcome.player.name,player.name,team.id+" should map "+guess+" to the correct player");
   checked++;
  }
  assert.equal(round.found.size,team.players.length,team.id+" should be fully guessable");
 }
 assert.equal(checked,5759,"the game should validate every one of the 5,759 source player records");
});
