import {readFile} from "node:fs/promises";
import {createPlayerRarityResolver} from "./player-rarity.mjs";
import {createClient} from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. Never use this key in browser code.");
const db=createClient(url,key,{auth:{persistSession:false}});
const [historicalRaritySource,worldCupRaritySource,rarityOverrides]=await Promise.all([
 readFile("data/historical-squads.json","utf8").then(JSON.parse),
 readFile("data/worldcup-2026.json","utf8").then(JSON.parse),
 readFile("data/player-rarity-overrides.json","utf8").then(JSON.parse)
]);
const rarityOf=createPlayerRarityResolver(historicalRaritySource,worldCupRaritySource,rarityOverrides);
const difficulty=JSON.parse(await readFile("data/team-difficulty.json","utf8"));
const audit=JSON.parse(await readFile("data/roster-audit.json","utf8"));
const tierOf=name=>Object.entries(difficulty.tiers).find(([,names])=>names.includes(name))?.[0]||"niche";
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const validHttps=value=>{try{return new URL(value).protocol==="https:";}catch{return false;}};

function verifiedByAudit(team,teamId){
 const record=audit.teams?.[teamId];
 if(!record||record.status!=="verified")return false;
 if(record.tournament!==team.year||record.teamNameInDataset!==team.name||!String(record.teamNameInFifaPdf||"").trim())
  throw new Error("Audit tournament/team identity metadata mismatch for "+teamId);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt||""))
  throw new Error("Verified audit requires an ISO review date for "+teamId);
 const rows=record.players;
 if(!Array.isArray(rows)||rows.length!==(team.players||[]).length)
  throw new Error("Audit marked verified but player-row count does not match for "+teamId);
 const keys=rows.map(r=>Number(r.number)+"|"+normalize(r.playerName));
 if(new Set(keys).size!==keys.length)
  throw new Error("Duplicate audit player rows for "+teamId);
 for(const row of rows){
  if(!String(row.sourceName||"").trim()||!(team.players||[]).some(p=>Number(p.number)===Number(row.number)&&normalize(p.name)===normalize(row.playerName)))
   throw new Error("Audit has an extra or incomplete player row for "+teamId+": "+row.playerName);
 }
 for(const player of team.players||[]){
  const row=rows.find(r=>Number(r.number)===Number(player.number)&&normalize(r.playerName)===normalize(player.name));
  if(!row)throw new Error("Verified audit has no exact name/number match for "+teamId+": "+player.name);
  if(!["matched","corrected"].includes(row.status)||!String(row.sourceName||"").trim())
   throw new Error("Unresolved player audit status or missing source name for "+teamId+": "+player.name);
  const sourceTokens=String(row.sourceName).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const playerTokens=String(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const explicitAlias=(row.sourceNameAliases||[]).some(alias=>normalize(alias)===normalize(player.name));
  if(!explicitAlias&&!playerTokens.some(token=>sourceTokens.includes(token)))
   throw new Error("Audit source name does not match the player or a documented alias for "+teamId+": "+player.name);
  if(row.position!==player.position)
   throw new Error("Audited position differs from game data for "+teamId+": "+player.name);
  if(!Object.hasOwn(row,"clubAtTournament")||(row.clubAtTournament??null)!==(player.club??null))
   throw new Error("Audited tournament-time club differs from game data for "+teamId+": "+player.name);
  if(!validHttps(row.primarySource||record.primarySource)||!validHttps(row.secondarySource||record.secondarySource))
   throw new Error("Both HTTPS primary and secondary sources are required for "+teamId+": "+player.name);
 }
 return true;
}

const files=["data/historical-squads.json","data/worldcup-2026.json"];
let count=0,verifiedCount=0;
for(const file of files){
 let data;try{data=JSON.parse(await readFile(file,"utf8"));}catch{continue;}
 let groups=data.tournaments||{};
 if(data.year===2026&&Array.isArray(data.players)){
  const byTeam=new Map();
  for(const p of data.players){
   if(!byTeam.has(p.team))byTeam.set(p.team,[]);
   byTeam.get(p.team).push({name:p.player||p.name,position:p.pos||p.position,club:p.club||null,number:p.number||null,aliases:Array.isArray(p.aliases)?p.aliases:[]});
  }
  groups={2026:[...byTeam.entries()].map(([name,players])=>({id:slug(name)+"-2026",name,year:2026,players}))};
 }
 for(const [year,teams] of Object.entries(groups)){
  for(const team of teams){
   const teamId=team.id||slug(team.name)+"-"+year;
   const verified=verifiedByAudit(team,teamId);
   const metadata={id:teamId,tournament_year:Number(year),team_name:team.name,team_difficulty:team.teamDifficulty||tierOf(team.name),source_url:data.sourceUrl||data.source||null,verified};
   const {error:metaError}=await db.from("arcade_teams").upsert(metadata);
   if(metaError)throw new Error("Team metadata "+teamId+": "+metaError.message);
   const roster=(team.players||[]).map((p,i)=>({id:teamId+"-"+(i+1),name:p.name,position:p.position||"",club:p.club||"",number:p.number||null,rarity:rarityOf(p),aliases:Array.isArray(p.aliases)?p.aliases:[]}));
   const {error:rosterError}=await db.from("arcade_team_answers").upsert({team_id:teamId,roster,updated_at:new Date().toISOString()});
   if(rosterError)throw new Error("Roster "+teamId+": "+rosterError.message);
   count++;if(verified)verifiedCount++;
  }
 }
}
console.log("Synced",count,"teams to Supabase; player-level audit approved",verifiedCount,"teams.");
