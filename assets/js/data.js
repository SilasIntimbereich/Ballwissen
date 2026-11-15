import {matches} from "./matching.js";
export {matches};
const [worldCup2026,historical,difficultyData]=await Promise.all([
 fetch("../../data/worldcup-2026.json").then(r=>{if(!r.ok)throw new Error("2026 squad data unavailable");return r.json();}),
 fetch("../../data/historical-squads.json").then(r=>r.ok?r.json():({tournaments:{}})).catch(()=>({tournaments:{}})),
 fetch("../../data/team-difficulty.json").then(r=>r.ok?r.json():({tiers:{}})).catch(()=>({tiers:{}}))
]);
const tierOf=name=>Object.entries(difficultyData.tiers||{}).find(([,names])=>names.includes(name))?.[0]||"niche";
const grouped=new Map();
for(const p of worldCup2026.players){if(!grouped.has(p.team))grouped.set(p.team,[]);grouped.get(p.team).push({name:p.player||p.name,position:p.pos||p.position,club:p.club,number:Number(p.number),teamCode:p.fifa_code||p.teamCode,rarity:null});}
const teams2026=[...grouped.entries()].map(([name,players])=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-2026",name,year:2026,teamDifficulty:tierOf(name),verified:false,players:players.sort((a,b)=>a.number-b.number)})).sort((a,b)=>a.name.localeCompare(b.name));
const historicalTournaments=historical.tournaments||{};
export const tournaments={...historicalTournaments,2026:teams2026};
export const datasetStatus={...Object.fromEntries(Object.entries(historicalTournaments).map(([year,teams])=>[year,{teams:teams.length,players:teams.reduce((n,t)=>n+t.players.length,0),verified:false,auditPending:true}])),2026:{teams:teams2026.length,players:worldCup2026.players.length,verified:false,auditPending:true},};
