import {matches} from "./matching.js";
export {matches};

const [publicData,practiceData]=await Promise.all([
 fetch("./data/public-teams.json").then(r=>{if(!r.ok)throw new Error("Public team metadata unavailable");return r.json();}),
 fetch("./data/practice-rosters.json").then(r=>{if(!r.ok)throw new Error("Practice rosters unavailable");return r.json();})
]);
const practiceById=new Map((practiceData.teams||[]).map(t=>[t.id,t.players||[]]));
const grouped={};
for(const meta of publicData.teams||[]){
 if(!grouped[meta.year])grouped[meta.year]=[];
 grouped[meta.year].push({...meta,players:practiceById.get(meta.id)||[]});
}
for(const year of Object.keys(grouped))grouped[year].sort((a,b)=>a.name.localeCompare(b.name));
export const tournaments=grouped;
export const datasetStatus=Object.fromEntries(Object.entries(tournaments).map(([year,teams])=>[year,{
 teams:teams.length,
 players:teams.reduce((n,t)=>n+t.total,0),
 verified:teams.length>0&&teams.every(t=>t.verified),
 verifiedTeams:teams.filter(t=>t.verified).length,
 auditPending:teams.some(t=>!t.verified)
}]));
