import test from "node:test";
import assert from "node:assert/strict";
import {assignRosterRarities,rarityFromEvidence} from "../assets/js/rarity.js";

const meta = teams => ({teams});

test("rarity is based on popularity evidence only",()=>{
  assert.equal(rarityFromEvidence({globalRecognition:5}),"Common");
  assert.equal(rarityFromEvidence({globalRecognition:4}),"Rare");
  assert.equal(rarityFromEvidence({globalRecognition:3}),"Niche");
  assert.equal(rarityFromEvidence({globalRecognition:2}),"Legendary");
  assert.equal(rarityFromEvidence({globalRecognition:0}),"Ball Knowledge");
});

test("verified World Cup appearances determine rarity across tournaments",()=>{
  const rosters={teams:[
    {id:"one",players:[{name:"Rising Player",number:1,position:"GK"}]},
    {id:"two",players:[{name:"Rising Player",number:99,position:"FW"}]},
    {id:"three",players:[{name:"Global Star",number:2,position:"DF"}]},
    {id:"four",players:[{name:"Global Star",number:27,position:"GK"}]},
    {id:"five",players:[{name:"Global Star",number:8,position:"MF"}]}
  ]};
  assignRosterRarities(rosters,meta([
    {id:"one",year:2006,verified:true,teamDifficulty:"legendary"},
    {id:"two",year:2010,verified:true,teamDifficulty:"common"},
    {id:"three",year:2014,verified:true,teamDifficulty:"niche"},
    {id:"four",year:2018,verified:true,teamDifficulty:"legendary"},
    {id:"five",year:2022,verified:true,teamDifficulty:"common"}
  ]));
  assert.equal(rosters.teams[0].players[0].rarity,"Rare");
  assert.equal(rosters.teams[1].players[0].rarity,"Rare");
  assert.ok(rosters.teams.slice(2).every(team=>team.players[0].rarity==="Common"));
});

test("shirt number, position and team difficulty do not change a player's rarity",()=>{
  const first={id:"a",players:[{name:"One Tournament Player",number:1,position:"GK"}]};
  const second={id:"b",players:[{name:"One Tournament Player",number:99,position:"FW"}]};
  const rosters={teams:[first,second]};
  assignRosterRarities(rosters,meta([
    {id:"a",year:2018,verified:true,teamDifficulty:"common"},
    {id:"b",year:2022,verified:true,teamDifficulty:"legendary"}
  ]));
  assert.equal(first.players[0].rarity,"Rare");
  assert.equal(second.players[0].rarity,"Rare");
});

test("unverified squads neither influence verified popularity nor get relabelled",()=>{
  const rosters={teams:[
    {id:"verified",players:[{name:"One Appearance Player",rarity:"old"}]},
    {id:"practice",players:[{name:"One Appearance Player",rarity:"keep-this"}]}
  ]};
  assignRosterRarities(rosters,meta([
    {id:"verified",year:2022,verified:true},
    {id:"practice",year:2026,verified:false}
  ]));
  assert.equal(rosters.teams[0].players[0].rarity,"Niche");
  assert.equal(rosters.teams[1].players[0].rarity,"keep-this");
});

test("well-known players stay Common even with only one verified appearance",()=>{
  const rosters={teams:[{id:"france-2018",players:[
    {name:"Kylian Mbappé",number:10,position:"FW"},
    {name:"N'Golo Kanté",number:13,position:"MF"}
  ]}]};
  assignRosterRarities(rosters,meta([{id:"france-2018",year:2018,verified:true}]));
  assert.ok(rosters.teams[0].players.every(player=>player.rarity==="Common"));
});

test("transliterated names share their verified appearance history",()=>{
  const rosters={teams:[
    {id:"a",players:[{name:"Kjær"}]},
    {id:"b",players:[{name:"Kjaer"}]}
  ]};
  assignRosterRarities(rosters,meta([
    {id:"a",year:2006,verified:true},
    {id:"b",year:2010,verified:true}
  ]));
  assert.ok(rosters.teams.every(team=>team.players[0].rarity==="Rare"));
});
