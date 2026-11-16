import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createPlayerRarityResolver} from "../scripts/player-rarity.mjs";

test("rarity uses appearance count and curated player overrides, not team difficulty",()=>{
 const historical={tournaments:{
  2002:[{players:[{name:"Three Cup Player"},{name:"Two Cup Player"},{name:"Legend Icon"},{name:"Niche Pro"},{name:"One-Off Player"}]}],
  2006:[{players:[{name:"Three Cup Player"},{name:"Two Cup Player"},{name:"Legend Icon"}]}],
  2010:[{players:[{name:"Three Cup Player"}]}]
 }};
 const wc={players:[]};
 const resolve=createPlayerRarityResolver(historical,wc,{legendary:["Legend Icon"],niche:["Niche Pro"]});
 assert.equal(resolve({name:"Three Cup Player"}),"Common");
 assert.equal(resolve({name:"Two Cup Player"}),"Rare");
 assert.equal(resolve({name:"Niche Pro"}),"Niche");
 assert.equal(resolve({name:"Legend Icon"}),"Legendary");
 assert.equal(resolve({name:"One-Off Player"}),"Ball Knowledge");
});

test("every imported player receives one of the five rarity labels",async()=>{
 const [historical,wc,overrides]=await Promise.all([
  readFile("data/historical-squads.json","utf8").then(JSON.parse),
  readFile("data/worldcup-2026.json","utf8").then(JSON.parse),
  readFile("data/player-rarity-overrides.json","utf8").then(JSON.parse)
 ]);
 const resolve=createPlayerRarityResolver(historical,wc,overrides);
 const players=[...Object.values(historical.tournaments).flatMap(teams=>teams.flatMap(team=>team.players)),...wc.players];
 const labels=new Set(players.map(resolve));
 assert.deepEqual([...labels].sort(),["Ball Knowledge","Common","Legendary","Niche","Rare"].sort());
});
