import {matches} from "./matching.js";
export {matches};

const loadJson=async path=>{
 const response=await fetch(path);
 if(!response.ok)throw new Error("Required roster data could not be loaded: "+path+" ("+response.status+")");
 return response.json();
};
const [historical,worldCup2026,difficulty,audit]=await Promise.all([
 loadJson("./data/historical-squads.json"),
 loadJson("./data/worldcup-2026.json"),
 loadJson("./data/team-difficulty.json"),
 loadJson("./data/roster-audit.json")
]);
const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const validHttps=value=>{try{return new URL(value).protocol==="https:";}catch{return false;}};
const tierOf=name=>Object.entries(difficulty.tiers||{}).find(([,names])=>names.includes(name))?.[0]||"niche";
const auditVerified=(team,record)=>{
 if(!record||record.status!=="verified")return false;
 if(record.tournament!==team.year||record.teamNameInDataset!==team.name||!String(record.teamNameInFifaPdf||"").trim())return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt||""))return false;
 if(!Array.isArray(record.players)||record.players.length!==team.players.length)return false;
 const keys=record.players.map(row=>Number(row.number)+"|"+normalize(row.playerName));
 if(new Set(keys).size!==keys.length)return false;
 return team.players.every(player=>{
  const row=record.players.find(item=>Number(item.number)===Number(player.number)&&normalize(item.playerName)===normalize(player.name));
  return !!row&&["matched","corrected"].includes(row.status)&&String(row.sourceName||"").trim()&&
   row.position===player.position&&(row.clubAtTournament??null)===(player.club??null)&&
   validHttps(row.primarySource||record.primarySource)&&validHttps(row.secondarySource||record.secondarySource);
 });
};
const tournaments={};
for(const [year,teams] of Object.entries(historical.tournaments||{})){
 tournaments[Number(year)]=teams.map(source=>{
  const team={...source,year:Number(year),teamDifficulty:source.teamDifficulty||tierOf(source.name)};
  team.players=(source.players||[]).map(player=>({...player,aliases:Array.isArray(player.aliases)?player.aliases:[]}));
  team.total=team.players.length;
  team.verified=auditVerified(team,audit.teams?.[team.id]);
  return team;
 });
}
const grouped=new Map();
for(const player of worldCup2026.players||[]){
 if(!grouped.has(player.team))grouped.set(player.team,[]);
 grouped.get(player.team).push({...player,aliases:Array.isArray(player.aliases)?player.aliases:[]});
}
const teams2026=[];
for(const [name,players] of grouped){
 players.sort((a,b)=>Number(a.number)-Number(b.number));
 const id=name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-2026";
 const team={id,name,year:2026,teamCode:players[0]?.teamCode||"",teamDifficulty:tierOf(name),players,total:players.length};
 team.verified=auditVerified(team,audit.teams?.[id]);
 teams2026.push(team);
}
teams2026.sort((a,b)=>a.name.localeCompare(b.name));
tournaments[2026]=teams2026;
for(const year of Object.keys(tournaments))tournaments[year].sort((a,b)=>a.name.localeCompare(b.name));
export const datasetStatus=Object.fromEntries(Object.entries(tournaments).map(([year,teams])=>[year,{
 teams:teams.length,
 players:teams.reduce((total,team)=>total+team.total,0),
 verified:teams.length>0&&teams.every(team=>team.verified),
 verifiedTeams:teams.filter(team=>team.verified).length,
 auditPending:teams.some(team=>!team.verified)
}]));
export {tournaments};
