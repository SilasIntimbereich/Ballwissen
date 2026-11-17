import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";

const SOURCE_URL = "https://www.myfootballfacts.com/world-football/fifa/world-cup/fifa-world-cup-by-year/2022-world-cup/2022-fifa-world-cup-playing-squad-details-with-kit-number-position-age-caps-and-club-affiliation/";
const normalize = value => String(value || "").replace(/[æÆ]/g,"ae").replace(/[øØ]/g,"o").replace(/[åÅ]/g,"a").replace(/[łŁ]/g,"l").replace(/[ß]/g,"ss").replace(/[œŒ]/g,"oe").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const teamAliases = { iriran:"iran", korearepublic:"southkorea", usa:"unitedstates", koreadpr:"northkorea", chinapr:"china" };
const clubPrefix = new Set(["fc","cf","ca","cr","se","sl","rsc","bsc","rc","rcd","vfl","sfc","ac","cd","afc","sc","club"]);
const clubSuffix = new Set(["fc","cf","sc","sfc","afc","calcio"]);
const clubAliases = {
  bayer04leverkusen:"bayerleverkusen",
  bayernmunchen:"bayernmunich",
  benca:"benfica",
  kobenhavn:"copenhagen",
  koln:"cologne",
  olympiquelyon:"lyon",
  olympiquemarseille:"marseille"
};

function decodeEntities(value) {
  const named = { "&amp;":"&", "&nbsp;":" ", "&quot;":"\"", "&#39;":"'", "&apos;":"'", "&lt;":"<", "&gt;":">", "&eacute;":"é", "&Eacute;":"É", "&ouml;":"ö", "&Ouml;":"Ö", "&uuml;":"ü", "&Uuml;":"Ü", "&aacute;":"á", "&Aacute;":"Á", "&iacute;":"í", "&Iacute;":"Í", "&uacute;":"ú", "&Uacute;":"Ú", "&agrave;":"à", "&Agrave;":"À", "&egrave;":"è", "&Egrave;":"È", "&euml;":"ë", "&Euml;":"Ë", "&atilde;":"ã", "&Atilde;":"Ã", "&ocirc;":"ô", "&Ocirc;":"Ô", "&ecirc;":"ê", "&Ecirc;":"Ê", "&ograve;":"ò", "&Ograve;":"Ò", "&ntilde;":"ñ", "&Ntilde;":"Ñ", "&ccedil;":"ç", "&Ccedil;":"Ç" };
  return value.replace(/&(?:amp|nbsp|quot|apos|lt|gt|eacute|Eacute|ouml|Ouml|uuml|Uuml|aacute|Aacute|iacute|Iacute|uacute|Uacute|agrave|Agrave|egrave|Egrave|euml|Euml|atilde|Atilde|ocirc|Ocirc|ecirc|Ecirc|ograve|Ograve|ntilde|Ntilde|ccedil|Ccedil);|&#\d+;|&#x[\da-f]+;/gi, entity => {
    if (named[entity]) return named[entity];
    const numeric = entity.match(/^&#(x[\da-f]+|\d+);$/i);
    if (!numeric) return entity;
    return String.fromCodePoint(numeric[1][0].toLowerCase()==="x" ? parseInt(numeric[1].slice(1),16) : Number(numeric[1]));
  });
}
function cellText(value) {
  return decodeEntities(value.replace(/<br\s*\/?\s*>/gi," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim();
}
function canonicalClub(value) {
  const raw = String(value || "").replace(/\s*\([A-Z]{3}\)\s*$/,"").trim();
  const parts = raw.split(/\s+/).map(normalize).filter(Boolean);
  while (parts.length && clubPrefix.has(parts[0])) parts.shift();
  while (parts.length && clubSuffix.has(parts[parts.length-1])) parts.pop();
  const key = parts.join("");
  return clubAliases[key] || key;
}
function canonicalTeam(value) {
  const key=normalize(value);
  return teamAliases[key] || key;
}
function parseRows(html) {
  const rows=[];
  let currentTeam=null;
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>cellText(m[1]));
    if(cells.length===1){
      const heading=cells[0].match(/^(.+?)\s+\(Group\s+[A-H]\)$/i);
      if(heading){currentTeam=heading[1].trim();continue;}
      if(/^Manager:/i.test(cells[0])) continue;
    }
    if(cells.length!==8 || !/^\d{1,2}$/.test(cells[0]) || !/^(GK|DF|MF|FW)$/i.test(cells[1])) continue;
    if(!currentTeam) continue;
    rows.push({number:Number(cells[0]),position:cells[1].toUpperCase(),name:cells[2],club:cells[6],teamName:currentTeam,clubCountry:cells[7]});
  }
  return rows;
}

const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const fifaAudit=JSON.parse(await readFile("artifacts/historical-fifa-audit.json","utf8"));
const teams=historical.tournaments["2022"]||[];
let response;
try{
  response=await fetch(SOURCE_URL,{headers:{"User-Agent":"FootballArcade2022IndependentClubAudit/1.0"},signal:AbortSignal.timeout(20000)});
}catch(error){
  const report={year:2022,primarySource:"https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf",secondarySource:SOURCE_URL,sourceStatus:"unavailable",sourceError:String(error),generatedAt:new Date().toISOString(),teams:[],summary:{sourceRows:0,teamsFound:0,teams:32,fullyCrossCheckedTeams:0,clubMismatches:0,nameMismatches:0,missingRows:0}};
  await mkdir("artifacts",{recursive:true});
  await writeFile("artifacts/2022-independent-club-audit.json",JSON.stringify(report,null,2)+String.fromCharCode(10));
  console.log(JSON.stringify(report.summary,null,2));
  process.exit(0);
}
if(!response.ok){
  const report={year:2022,primarySource:"https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf",secondarySource:SOURCE_URL,sourceStatus:"unavailable",httpStatus:response.status,generatedAt:new Date().toISOString(),teams:[],summary:{sourceRows:0,teamsFound:0,teams:32,fullyCrossCheckedTeams:0,clubMismatches:0,nameMismatches:0,missingRows:0}};
  await mkdir("artifacts",{recursive:true});
  await writeFile("artifacts/2022-independent-club-audit.json",JSON.stringify(report,null,2)+String.fromCharCode(10));
  console.log(JSON.stringify(report.summary,null,2));
  process.exit(0);
}
const html=await response.text();
const sourceRows=parseRows(html);
if(sourceRows.length<800) throw new Error("MyFootballFacts page parser found only "+sourceRows.length+" player rows; expected at least 800.");

const sourceByTeam=new Map();
for(const row of sourceRows){
  const key=canonicalTeam(row.teamName);
  if(!sourceByTeam.has(key)) sourceByTeam.set(key,[]);
  sourceByTeam.get(key).push(row);
}
const fifaTournament=fifaAudit.tournaments.find(t=>t.year===2022);
const report={year:2022,primarySource:"https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf",secondarySource:SOURCE_URL,generatedAt:new Date().toISOString(),teams:[],summary:{}};
for(const team of teams){
  const sourceTeam=sourceByTeam.get(canonicalTeam(team.name))||[];
  const fifaTeam=fifaTournament?.teams.find(t=>t.teamId===team.id);
  const fifaCandidates=new Map((fifaTeam?.candidates||[]).map(row=>[row.number,row]));
  const playerByNumber=new Map(team.players.map(p=>[Number(p.number),p]));
  const matchedNumbers=new Set();
  const mismatches=[];
  const comparisons=[];
  for(const row of sourceTeam){
    const player=playerByNumber.get(row.number);
    const fifa=fifaCandidates.get(row.number);
    if(!player||!fifa){
      mismatches.push({number:row.number,field:"missing_player_or_fifa_candidate",sourceName:row.name});
      continue;
    }
    matchedNumbers.add(row.number);
    const identityMatches=namesMatch(player.name,row.name) || namesMatch(fifa.sourceName,row.name);
    const fifaClub=String(fifa.clubAtTournament||"");
    const clubMatches=canonicalClub(fifaClub)===canonicalClub(row.club);
    const positionMatches=fifa.position===row.position;
    if(!identityMatches) mismatches.push({number:row.number,field:"name",datasetName:player.name,sourceName:row.name});
    if(!clubMatches) mismatches.push({number:row.number,field:"club",fifaClub,secondaryClub:row.club});
    comparisons.push({number:row.number,playerName:player.name,secondaryName:row.name,identityMatches,fifaPosition:fifa.position,secondaryPosition:row.position,positionMatches,fifaClub,secondaryClub:row.club,clubMatches,canonicalFifaClub:canonicalClub(fifaClub),canonicalSecondaryClub:canonicalClub(row.club)});
  }
  for(const player of team.players) if(!matchedNumbers.has(Number(player.number))) mismatches.push({number:Number(player.number),field:"missing_secondary_row",player:player.name});
  const fullyCrossChecked=sourceTeam.length===team.players.length&&comparisons.length===team.players.length&&mismatches.length===0;
  report.teams.push({teamId:team.id,teamName:team.name,sourcePlayerCount:sourceTeam.length,fullyCrossChecked,clubMatches:comparisons.filter(x=>x.clubMatches).length,clubMismatches:comparisons.filter(x=>!x.clubMatches).length,nameMismatches:comparisons.filter(x=>!x.identityMatches).length,mismatches,comparisons});
}
report.summary={sourceRows:sourceRows.length,teamsFound:sourceByTeam.size,teams:report.teams.length,fullyCrossCheckedTeams:report.teams.filter(t=>t.fullyCrossChecked).length,clubMismatches:report.teams.reduce((n,t)=>n+t.clubMismatches,0),nameMismatches:report.teams.reduce((n,t)=>n+t.nameMismatches,0),positionDifferences:report.teams.reduce((n,t)=>n+t.comparisons.filter(row=>!row.positionMatches).length,0),missingRows:report.teams.reduce((n,t)=>n+t.mismatches.filter(m=>m.field.startsWith("missing")).length,0)};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/2022-independent-club-audit.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report.summary,null,2));
if(report.teams.length!==32) throw new Error("2022 independent club audit did not account for 32 teams");
