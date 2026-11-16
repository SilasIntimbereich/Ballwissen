import {matches} from "./matching.js";
export {matches};

const [publicData,practiceData]=await Promise.all([
 fetch("./data/public-teams.json").then(response=>{if(!response.ok)throw new Error("Public team metadata unavailable");return response.json();}),
 fetch("./data/practice-rosters.json").then(response=>{if(!response.ok)throw new Error("Practice rosters unavailable");return response.json();})
]).catch(error=>{
 console.error("Roster data could not be loaded. The menu will stay usable, but team selection is unavailable until the data files are deployed.",error);
 return [{teams:[]},{teams:[]}];
});
const practiceById=new Map((practiceData.teams||[]).map(item=>[item.id,item.players||[]]));
const tournaments={};
for(const meta of publicData.teams||[]){
 if(!tournaments[meta.year])tournaments[meta.year]=[];
 tournaments[meta.year].push({...meta,players:practiceById.get(meta.id)||[]});
}
for(const year of Object.keys(tournaments))tournaments[year].sort((a,b)=>a.name.localeCompare(b.name));
export const datasetStatus=Object.fromEntries(Object.entries(tournaments).map(([year,teams])=>[year,{
 teams:teams.length,
 players:teams.reduce((total,team)=>total+team.total,0),
 verified:teams.length>0&&teams.every(team=>team.verified),
 verifiedTeams:teams.filter(team=>team.verified).length,
 auditPending:teams.some(team=>!team.verified)
}]));
export {tournaments};
