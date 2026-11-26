import test from "node:test";
import assert from "node:assert/strict";
import {assignRosterRarities,rarityFromEvidence,RARITY_DISTRIBUTION_TARGET} from "../assets/js/rarity.js";
import {createPlayerRarityResolver} from "../scripts/player-rarity.mjs";

const meta = teams => ({teams});

test("distribution target is descending and sums to 100 without enforcing quotas",()=>{
  const values=Object.values(RARITY_DISTRIBUTION_TARGET);
  assert.deepEqual(RARITY_DISTRIBUTION_TARGET,{
    Common:40,Rare:30,Niche:20,Legendary:7,"Ball Knowledge":3
  });
  assert.equal(values.reduce((sum,value)=>sum+value,0),100);
  assert.ok(values.every((value,index)=>index===0||values[index-1]>value));
});

test("evidence scale maps recognition directly to the five rarity tiers",()=>{
  assert.equal(rarityFromEvidence({globalRecognition:5}),"Common");
  assert.equal(rarityFromEvidence({globalRecognition:4}),"Rare");
  assert.equal(rarityFromEvidence({globalRecognition:3}),"Niche");
  assert.equal(rarityFromEvidence({globalRecognition:2}),"Legendary");
  assert.equal(rarityFromEvidence({globalRecognition:0}),"Ball Knowledge");
});

test("repeat World Cup appearances do not make a player more famous",()=>{
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
  assert.ok(rosters.teams.every(team=>team.players[0].rarity==="Niche"));
});

test("shirt number, position and team difficulty do not change a player's rarity",()=>{
  const first={id:"a",players:[{name:"One Tournament Player",number:1,position:"GK"}]};
  const second={id:"b",players:[{name:"One Tournament Player",number:99,position:"FW"}]};
  const rosters={teams:[first,second]};
  assignRosterRarities(rosters,meta([
    {id:"a",year:2018,verified:true,teamDifficulty:"common"},
    {id:"b",year:2022,verified:true,teamDifficulty:"legendary"}
  ]));
  assert.equal(first.players[0].rarity,"Niche");
  assert.equal(second.players[0].rarity,"Niche");
});

test("unverified squads neither receive nor influence verified player rarity",()=>{
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

test("global household names are Common even with one verified appearance",()=>{
  const rosters={teams:[{id:"france-2018",players:[
    {name:"Kylian Mbappé",number:10,position:"FW"},
    {name:"N'Golo Kanté",number:13,position:"MF"},
    {name:"Lionel Messi",number:10,position:"FW"}
  ]}]};
  assignRosterRarities(rosters,meta([{id:"france-2018",year:2018,verified:true}]));
  assert.ok(rosters.teams[0].players.every(player=>player.rarity==="Common"));
});

test("curated fame levels distinguish global stars from specialist-level names",()=>{
  const rosters={teams:[{id:"test",players:[
    {name:"Lionel Messi"},
    {name:"Granit Xhaka"},
    {name:"Almoez Ali"},
    {name:"Rabah Madjer"},
    {name:"Marek Hamsik"},
    {name:"Hugo Sochurek"}
  ]}]};
  assignRosterRarities(rosters,meta([{id:"test",year:2026,verified:true}]));
  assert.deepEqual(rosters.teams[0].players.map(player=>player.rarity),["Common","Rare","Niche","Legendary","Legendary","Ball Knowledge"]);
});

test("iconic international cult players are Legendary, not generic Rare",()=>{
  const rosters={teams:[{id:"icons",players:[
    {name:"Tim Cahill"},{name:"Keisuke Honda"},{name:"Ali Daei"},
    {name:"Asamoah Gyan"},{name:"Papa Bouba Diop"},{name:"Dwight Yorke"}
  ]}]};
  assignRosterRarities(rosters,meta([{id:"icons",year:2010,verified:true}]));
  assert.ok(rosters.teams[0].players.every(player=>player.rarity==="Legendary"));
});

test("unheralded Algeria 2010 squad members are not mislabeled Legendary",()=>{
  const rosters={teams:[{id:"algeria",players:[
    {name:"Joao Ricardo"},{name:"Lama"},{name:"Karim Ziani"}
  ]}]};
  assignRosterRarities(rosters,meta([{id:"algeria",year:2010,verified:true}]));
  assert.ok(rosters.teams[0].players.every(player=>player.rarity==="Niche"));
});

test("unlisted names use the conservative Niche fallback, not an appearance-count bonus",()=>{
  const rosters={teams:[{id:"one",players:[{name:"Unlisted Squad Player"}]},{id:"two",players:[{name:"Unlisted Squad Player"}]}]};
  assignRosterRarities(rosters,meta([{id:"one",year:2006,verified:true},{id:"two",year:2010,verified:true}]));
  assert.ok(rosters.teams.every(team=>team.players[0].rarity==="Niche"));
});

test("transliterated aliases do not affect a player's manually curated fame tier",()=>{
  const rosters={teams:[{id:"a",players:[{name:"Kjær"}]},{id:"b",players:[{name:"Kjaer"}]}]};
  assignRosterRarities(rosters,meta([{id:"a",year:2006,verified:true},{id:"b",year:2010,verified:true}]));
  assert.ok(rosters.teams.every(team=>team.players[0].rarity==="Niche"));
});

test("server rarity resolver uses the same verified-only fame assignments",()=>{
  const historical={tournaments:{
    2018:[
      {id:"france-2018",name:"France",players:[{name:"Kylian Mbappé"},{name:"Olivier Giroud"}]},
      {id:"practice-2018",name:"Practice",players:[{name:"Lionel Messi"}]}
    ]
  }};
  const worldCup2026={players:[{team:"Argentina",name:"Lionel Messi"}]};
  const audit={teams:{
    "france-2018":{status:"verified"},
    "practice-2018":{status:"unverified"},
    "argentina-2026":{status:"verified"}
  }};
  const resolve=createPlayerRarityResolver(historical,worldCup2026,{tiers:{}},audit);
  assert.equal(resolve({name:"Kylian Mbappé"},"france-2018"),"Common");
  assert.equal(resolve({name:"Lionel Messi"},"argentina-2026"),"Common");
  assert.equal(resolve({name:"Lionel Messi"},"practice-2018"),null);
});
