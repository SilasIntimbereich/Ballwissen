import {readFile} from "node:fs/promises";
const read=async path=>JSON.parse(await readFile(path,"utf8"));
const wc=await read("data/worldcup-2026.json");
if(wc.players.length!==1248)throw new Error("2026: expected 1,248 players, got "+wc.players.length);
const teams=new Map();for(const p of wc.players){if(!teams.has(p.team))teams.set(p.team,0);teams.set(p.team,teams.get(p.team)+1);}
if(teams.size!==48)throw new Error("2026: expected 48 teams, got "+teams.size);
for(const [team,n] of teams)if(n!==26)throw new Error("2026: "+team+" has "+n+" entries, expected 26.");
const hist=await read("data/historical-squads.json");
for(const year of [2002,2006,2010,2014,2018,2022]){
 const list=hist.tournaments?.[year];if(!list||list.length!==32)throw new Error(year+": expected 32 teams.");
 for(const team of list)if(team.players.length<23||team.players.length>26)throw new Error(year+" "+team.name+": invalid roster size "+team.players.length);
}
console.log("Dataset validation passed: 7 editions, 240 teams, 1,248 players in 2026.");
