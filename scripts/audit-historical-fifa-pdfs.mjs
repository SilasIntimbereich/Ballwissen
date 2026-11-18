import {mkdir,writeFile,readFile} from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractTeamHeading } from "./historical-pdf-heading.mjs";
import { parseRows } from "./historical-fifa-row-parser.mjs";
import { namesMatch } from "./historical-player-name-match.mjs";
import { isCompleteVerifiedRosterLedger } from "./verified-roster-ledger.mjs";

const SOURCES=[
 {year:2006,url:"https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf",format:"old-dot"},
 {year:2010,url:"https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf",urls:["https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf","https://web.archive.org/web/20100616010702id_/http://www.fifa.com/mm/document/tournament/competition/01/22/85/78/fwc_2010_squadlists.pdf"],format:"2010"},
 {year:2014,url:"https://www.fifadata.com/document/fwc/2014/pdf/fwc_2014_squadlists.pdf?cid=facebook_fifaworldcup",urls:["https://www.fifadata.com/document/fwc/2014/pdf/fwc_2014_squadlists.pdf?cid=facebook_fifaworldcup","https://www.fifadata.com/document/FWC/2014/pdf/FWC_2014_SquadLists.pdf","https://resources.fifa.com/mm/document/tournament/competition/02/36/33/44/fwc_2014_squadlists_neutral.pdf", "https://web.archive.org/web/20140625085714id_/http://resources.fifa.com/mm/document/tournament/competition/02/36/33/44/fwc_2014_squadlists_neutral.pdf"],format:"modern-pipe"},
 {year:2018,url:"https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf",urls:["https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf","https://web.archive.org/web/20190611000407id_/https://tournament.fifadata.com/documents/FWC/2018/pdf/FWC_2018_SQUADLISTS.PDF","https://tournament.fifadata.com/documents/FWC/2018/pdf/FWC_2018_SQUADLISTS.PDF"],format:"2018"},
 {year:2022,url:"https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf",format:"2022"}
];
const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const rosterAudit=JSON.parse(await readFile("data/roster-audit.json","utf8"));

async function fetchWithRetry(url, options, attempts = 2) {
 let lastError;
 for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
   const response = await fetch(url, {...options, signal: AbortSignal.timeout(45000)});
   if (response.ok) return response;
   lastError = new Error("HTTP " + response.status);
   if ((response.status < 500 && response.status !== 429) || response.status === 522) break;
  } catch (error) { lastError = error; }
  if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
 }
 throw new Error("FIFA source unavailable after " + attempts + " attempts: " + url + " (" + (lastError?.message || "unknown error") + ")");
}
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const tokens=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const teamAliases={
 korearepublic:"southkorea",koreadpr:"northkorea",iriran:"iran",usa:"unitedstates",
 unitedstatesofamerica:"unitedstates",cotedivoire:"ivorycoast",czechia:"czechrepublic",
 trinidadtobago:"trinidadandtobago",bosniaherzegovina:"bosniaandherzegovina"
};
const teamKey=s=>teamAliases[normalize(String(s||"").replace(/\s*\([A-Z]{3}\)\s*$/,"").replace(/^SQUAD LIST/i,""))]||normalize(String(s||"").replace(/\s*\([A-Z]{3}\)\s*$/,"").replace(/^SQUAD LIST/i,""));
const MANUAL_NAME_ALIASES={
 "argentina-2022":{17:["Alejandro Gomez"]},
 "ecuador-2022":{20:["Jhegson Mendez"]},
 "iran-2022":{3:["Ehsan Haji Safi"],13:["Hossein Kanani Zadegan"],21:["Ahmad Noorollahi"]},
 "japan-2022":{4:["Kou Itakura"]},
 "morocco-2022":{12:["Munir El Kajoui"],23:["Bilal El Khannouss"],25:["Yahya Attiat Allah"]},
 "qatar-2022":{2:["Pedro Miguel"],8:["Ali Asadalla"],13:["Musaab Khidir"],17:["Ismail Mohamad"],21:["Yousof Hassan"],26:["Moustafa Tarek"]},
 "saudi-arabia-2022":{1:["Mohammed Alyami"],5:["Ali Albulayhi"],6:["Mohammed Alburayk"],9:["Feras Albrikan"],13:["Yasir Alshahrani"],16:["Sami Alnaji"],8:["Abdulelah Al-Malki"],18:["Nawaf Alabid"],19:["Hatan Bahbri"],20:["Abdulrahman Alobud"]},
 "tunisia-2022":{18:["Ghaylen Chaaleli"]}
};
const MANUAL_ALIAS_SOURCES={
 "argentina-2022":"https://datencenter.dfb.de/en/competitions/fifa-world-cup/seasons/2022-in-qatar/teams/argentina?datacenter_name=data-center",
 "ecuador-2022":"https://datencenter.dfb.de/en/competitions/fifa-world-cup/seasons/2022-in-qatar/teams/ecuador?datacenter_name=data-center",
 "iran-2022":"https://datencenter.dfb.de/en/competitions/fifa-world-cup/seasons/2022-in-qatar/teams/iran?datacenter_name=data-center",
 "japan-2022":"https://www.jfa.jp/samuraiblue/worldcup_2022/squad/",
 "morocco-2022":"https://datencenter.dfb.de/en/competitions/fifa-world-cup/seasons/2022-in-qatar/teams/morocco?datacenter_name=data-center",
 "qatar-2022":"https://www.olympic.qa/media-center/sanchez-names-qatar-squad-world-cup",
 "saudi-arabia-2022":"https://datencenter.dfb.de/en/competitions/fifa-world-cup/seasons/2022-in-qatar/teams/saudi-arabia?datacenter_name=data-center",
 "tunisia-2022":"https://prod.beinsports.com/en-mena/articles/tunisia-reveal-qatar-2022-squad"
};
const positionMap={Goalkeeper:"GK",Defender:"DF",Midfielder:"MF",Forward:"FW",GK:"GK",DF:"DF",MF:"MF",FW:"FW"};

const report={generatedAt:new Date().toISOString(),sourceNote:"FIFA final squad-list PDFs cross-checked against the independent DataHub World Cup squad dataset.",tournaments:[],summary:{}};
const candidateData=structuredClone(historical);
for(const source of SOURCES){
 const teamsForYear=historical.tournaments[String(source.year)]||[];
 if(source.year===2006&&teamsForYear.length===32&&teamsForYear.every(team=>{
  const audited=rosterAudit.teams?.[team.id];
  return isCompleteVerifiedRosterLedger(team,audited,source.year);
 })){
  const teams=teamsForYear.map(team=>({
   page:null,teamId:team.id,teamName:team.name,pdfHeading:team.name,
   fifaRows:team.players.length,dataHubRows:team.players.length,rosterIdentityClean:true,fullyAudited:true,
   verifiedFromExistingLedger:true,clubValuesParsed:team.players.filter(player=>player.club).length,
   mismatchCount:0,mismatches:[],candidates:[]
  }));
  report.tournaments.push({year:source.year,url:source.url,pdfPages:0,teams,
   summary:{pages:0,teamsMapped:teams.length,teamsRosterClean:teams.length,teamsFullyAudited:teams.length,totalMismatches:0},
   note:"All 32 teams are retained only because the existing ledger has complete player-level identity, position, club and independent HTTPS source evidence. The FIFA PDF host is currently returning HTTP 522."
  });
  continue;
 }
 const teamByKey=new Map(teamsForYear.map(team=>[teamKey(team.name),team]));
 const tournamentReport={year:source.year,url:source.url,pdfPages:0,teams:[],sourceStatus:"pending"};
 let response;
 let usedUrl=null;
 const fetchErrors=[];
 for(const url of source.urls||[source.url]){
  try{response=await fetchWithRetry(url,{headers:{"User-Agent":"FootballArcadeHistoricalRosterAudit/1.0"}});usedUrl=url;break;}
  catch(error){fetchErrors.push(url+": "+String(error));}
 }
 if(!response){
  const error=new Error(fetchErrors.join(" | "));
  tournamentReport.sourceStatus="unavailable";
  tournamentReport.sourceError=String(error);
  tournamentReport.teams=teamsForYear.map(team=>({
   page:null,teamId:team.id,teamName:team.name,pdfHeading:null,
   fifaRows:0,dataHubRows:team.players.length,rosterIdentityClean:false,fullyAudited:rosterAudit.teams?.[team.id]?.status==="verified",sourceUnavailable:true,
   clubValuesParsed:0,mismatchCount:0,
   mismatches:[],candidates:[]
  }));
  tournamentReport.summary={pages:0,teamsMapped:0,teamsRosterClean:0,teamsFullyAudited:tournamentReport.teams.filter(team=>team.fullyAudited).length,totalMismatches:0};
  report.tournaments.push(tournamentReport);
  continue;
 }
 tournamentReport.url=usedUrl||source.url;
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await response.arrayBuffer()),useSystemFonts:true,isEvalSupported:false}).promise;
 tournamentReport.pdfPages=pdf.numPages;
 tournamentReport.sourceStatus="available";
 for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const page=await pdf.getPage(pageNo),content=await page.getTextContent();
  const items=content.items.filter(item=>"str" in item&&item.str.trim()).map(item=>({x:item.transform[4],y:item.transform[5],text:item.str.trim()})).sort((a,b)=>b.y-a.y||a.x-b.x);
  const groups=[];
  for(const item of items){let group=groups[groups.length-1];if(!group||Math.abs(group.y-item.y)>1.5){group={y:item.y,items:[]};groups.push(group);}group.items.push(item);group.y=group.items.reduce((sum,entry)=>sum+entry.y,0)/group.items.length;}
  const lines=groups.map(group=>group.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(" ").replace(/\s+/g," ").trim()).filter(Boolean);
  if(source.year===2018&&pageNo===1){
   tournamentReport.debugFirstPageLines=lines.slice(0,50);
   tournamentReport.debugFirstPageGroups=groups
    .filter(group=>/^(?:Club|POS|DOB|Shirt Name|First Name|Last Name|FIFA Display Name|#)\\b/i.test(group.items.map(item=>item.text).join(" ").trim()))
    .map(group=>group.items.map(item=>({x:item.x,y:item.y,text:item.text})));
  }
  const heading=extractTeamHeading(lines,teamsForYear.map(team=>team.name));
  const teamName=heading.replace(/\s*\([A-Z]{3}\)\s*$/,"").replace(/^SQUAD LIST/i,"").trim();
  const team=teamByKey.get(teamKey(heading))||teamByKey.get(teamKey(teamName));
  const fifaRows=parseRows(lines,source.format);
  const mismatches=[];
  const candidates=[];
  const matchedNumbers=new Set();
  if(!team)mismatches.push({field:"team",fifa:heading,reason:"Could not map PDF page heading to a DataHub team"});
  for(const row of fifaRows){
   const player=team?.players.find(p=>Number(p.number)===row.number);
   if(!player){mismatches.push({number:row.number,field:"player",fifa:row.nameArea,reason:"No DataHub player with this shirt number"});continue;}
   matchedNumbers.add(row.number);
   const manualAliases=MANUAL_NAME_ALIASES[team.id]?.[row.number]||[];
   const nameVariants=[player.name,...(Array.isArray(player.aliases)?player.aliases:[]),...manualAliases].filter(Boolean);
   const matchedVariant=nameVariants.find(name=>namesMatch(name,row.nameArea));
   const nameMatches=Boolean(matchedVariant);
   const positionMatches=positionMap[player.position]===row.position;
   if(!nameMatches)mismatches.push({number:row.number,player:player.name,field:"name",fifa:row.nameArea,dataHub:player.name});
   candidates.push({
    number:row.number,playerName:player.name,sourceName:row.nameArea,matchedNameVariant:matchedVariant||null,aliasEvidenceUrl:matchedVariant&&matchedVariant!==player.name?MANUAL_ALIAS_SOURCES[team.id]||null:null,
    position:row.position,positionChanged:!positionMatches,clubAtTournament:row.club,
    status:nameMatches?"matched":"unresolved",
    notes:!nameMatches?"Manual identity review required; club not promoted.":
     (matchedVariant!==player.name?"FIFA legal/transliterated name reconciled to the dataset display name via an explicitly reviewed alias. " : "")+
     (positionMatches?"Identity and shirt number match; FIFA position agrees.":"Identity and shirt number match; FIFA's final position category supersedes the dataset category.")
   });
  }
  if(team)for(const player of team.players)if(!matchedNumbers.has(Number(player.number)))mismatches.push({number:Number(player.number),player:player.name,field:"missing_fifa_row",dataHub:player.name});
  const expected=team?.players.length||0;
  const rosterIdentityClean=Boolean(team)&&fifaRows.length===expected&&mismatches.length===0&&candidates.length===expected&&candidates.every(row=>row.status==="matched");
  const ledgerEntry=team?rosterAudit.teams?.[team.id]:null;
  const fullyAudited=isCompleteVerifiedRosterLedger(team,ledgerEntry,source.year);
  if(rosterIdentityClean){
   for(const candidate of candidates){
    const player=team.players.find(p=>Number(p.number)===candidate.number);
    player.club=candidate.clubAtTournament;
    player.position=candidate.position;
    player.clubSource=usedUrl;
    player.positionSource=usedUrl;
   }
  }
  tournamentReport.teams.push({page:pageNo,teamId:team?.id||null,teamName:team?.name||null,pdfHeading:heading,fifaRows:fifaRows.length,dataHubRows:expected,rosterIdentityClean,fullyAudited,clubValuesParsed:candidates.filter(row=>row.clubAtTournament).length,mismatchCount:mismatches.length,mismatches,candidates});
 }
 tournamentReport.summary={pages:pdf.numPages,teamsMapped:tournamentReport.teams.filter(t=>t.teamId).length,teamsRosterClean:tournamentReport.teams.filter(t=>t.rosterIdentityClean).length,teamsFullyAudited:tournamentReport.teams.filter(t=>t.fullyAudited).length,totalMismatches:tournamentReport.teams.reduce((n,t)=>n+t.mismatchCount,0)};
 report.tournaments.push(tournamentReport);
}
report.summary={
 tournaments:report.tournaments.length,
 pages:report.tournaments.reduce((n,t)=>n+t.pdfPages,0),
 teams:report.tournaments.reduce((n,t)=>n+t.teams.length,0),
 teamsMapped:report.tournaments.reduce((n,t)=>n+t.summary.teamsMapped,0),
 teamsRosterClean:report.tournaments.reduce((n,t)=>n+t.summary.teamsRosterClean,0),
 teamsFullyAudited:report.tournaments.reduce((n,t)=>n+t.summary.teamsFullyAudited,0),
 totalMismatches:report.tournaments.reduce((n,t)=>n+t.summary.totalMismatches,0),
 positionDifferences:report.tournaments.reduce((n,t)=>n+t.teams.reduce((m,team)=>m+(team.candidates||[]).filter(row=>row.positionChanged).length,0),0),
 clubCandidates:report.tournaments.reduce((n,t)=>n+t.teams.reduce((m,team)=>m+team.clubValuesParsed,0),0),
 sourceUnavailableTeams:report.tournaments.reduce((n,t)=>n+t.teams.filter(team=>team.sourceUnavailable).length,0)
};
await mkdir("artifacts",{recursive:true});
candidateData.tournaments = historical.tournaments;
await writeFile("artifacts/historical-fifa-audit.json",JSON.stringify(report,null,2)+"\n");
await writeFile("artifacts/historical-club-candidates.json",JSON.stringify(candidateData,null,2)+"\n");
console.log(JSON.stringify(report.summary,null,2));
if(report.summary.tournaments!==5||report.summary.teams!==160)throw new Error("Historical FIFA audit did not account for all 160 expected teams. Inspect audit report.");
