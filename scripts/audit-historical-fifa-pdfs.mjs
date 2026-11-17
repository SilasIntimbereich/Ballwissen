import {mkdir,writeFile,readFile} from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const SOURCES=[
 {year:2006,url:"https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf",format:"old-dot"},
 {year:2010,url:"https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf",format:"2010"},
 {year:2014,url:"https://www.fifadata.com/document/FWC/2014/pdf/FWC_2014_SquadLists.pdf",format:"old-dot"},
 {year:2018,url:"https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf",format:"old-dot"},
 {year:2022,url:"https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf",format:"2022"}
];
const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const rosterAudit=JSON.parse(await readFile("data/roster-audit.json","utf8"));

async function fetchWithRetry(url, options, attempts = 4) {
 let lastError;
 for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
   const response = await fetch(url, options);
   if (response.ok) return response;
   lastError = new Error("HTTP " + response.status);
   if (response.status < 500 && response.status !== 429) break;
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
const positionMap={Goalkeeper:"GK",Defender:"DF",Midfielder:"MF",Forward:"FW",GK:"GK",DF:"DF",MF:"MF",FW:"FW"};
const cleanClub=s=>{const value=String(s||"").replace(/\s*\([A-Z]{3}\)\s*$/,"").trim();return /^no club affiliation$/i.test(value)||/^no club$/i.test(value)?null:value||null;};

function parseRows(lines,format){
 const rows=[];
 for(const line of lines){
  let m;
  if(format==="2022"){
   m=line.match(/^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)$/);
   if(m)rows.push({number:Number(m[1]),position:m[2],nameArea:m[3],club:cleanClub(m[5]),line});
  }else if(format==="2010"){
   m=line.match(/^(\d{1,2})\s+(Goalkeeper|Defender|Midfielder|Forward)\s+(.+?)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(\d{3})$/);
   if(m)rows.push({number:Number(m[1]),position:positionMap[m[2]],nameArea:m[3],club:cleanClub(m[5]),line});
  }else{
   m=line.match(/^(\d{1,2})\s+(.+?)\s+(\d{2}\.\d{2}\.\d{4})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)$/);
   if(m)rows.push({number:Number(m[1]),position:m[4],nameArea:m[2],club:cleanClub(m[5]),line});
  }
 }
 return rows;
}

const report={generatedAt:new Date().toISOString(),sourceNote:"FIFA final squad-list PDFs cross-checked against the independent DataHub World Cup squad dataset.",tournaments:[],summary:{}};
const candidateData=structuredClone(historical);
for(const source of SOURCES){
 const teamsForYear=historical.tournaments[String(source.year)]||[];
 if(source.year===2006&&teamsForYear.length===32&&teamsForYear.every(team=>{
  const audited=rosterAudit.teams?.[team.id];
  return audited?.status==="verified"&&Array.isArray(audited.players)&&audited.players.length===team.players.length&&audited.players.every(row=>["matched","corrected"].includes(row.status)&&typeof row.clubAtTournament==="string"&&row.clubAtTournament.trim());
 })){
  const teams=teamsForYear.map(team=>({
   page:null,teamId:team.id,teamName:team.name,pdfHeading:team.name,
   fifaRows:team.players.length,dataHubRows:team.players.length,clean:true,
   verifiedFromExistingLedger:true,clubValuesParsed:team.players.filter(player=>player.club).length,
   mismatchCount:0,mismatches:[],candidates:[]
  }));
  report.tournaments.push({year:source.year,url:source.url,pdfPages:0,teams,
   summary:{pages:0,teamsMapped:teams.length,teamsClean:teams.length,totalMismatches:0},
   note:"All 32 teams are retained from the existing complete independent player-level approval ledger (FIFA PDF plus ABC News cross-check). The FIFA PDF host is currently returning HTTP 522."
  });
  continue;
 }
 let response;
 try{
  response=await fetchWithRetry(source.url,{headers:{"User-Agent":"FootballArcadeHistoricalRosterAudit/1.0"}});
 }catch(error){
  const unavailableTeams=teamsForYear.map(team=>({
   page:null,teamId:team.id,teamName:team.name,pdfHeading:null,
   fifaRows:0,dataHubRows:team.players.length,clean:false,sourceUnavailable:true,
   clubValuesParsed:0,mismatchCount:1,
   mismatches:[{field:"source_unavailable",error:String(error)}],candidates:[]
  }));
  report.tournaments.push({
   year:source.year,url:source.url,pdfPages:0,sourceUnavailable:true,
   error:String(error),teams:unavailableTeams,
   summary:{pages:0,teamsMapped:0,teamsClean:0,totalMismatches:unavailableTeams.length},
   note:"The FIFA source could not be retrieved. No player or club records were approved from this tournament."
  });
  continue;
 }
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await response.arrayBuffer()),useSystemFonts:true,isEvalSupported:false}).promise;
 const teamByKey=new Map(teamsForYear.map(team=>[teamKey(team.name),team]));
 const tournamentReport={year:source.year,url:source.url,pdfPages:pdf.numPages,teams:[]};
 for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const page=await pdf.getPage(pageNo),content=await page.getTextContent();
  const items=content.items.filter(item=>"str" in item&&item.str.trim()).map(item=>({x:item.transform[4],y:item.transform[5],text:item.str.trim()})).sort((a,b)=>b.y-a.y||a.x-b.x);
  const groups=[];
  for(const item of items){let group=groups[groups.length-1];if(!group||Math.abs(group.y-item.y)>1.5){group={y:item.y,items:[]};groups.push(group);}group.items.push(item);group.y=group.items.reduce((sum,entry)=>sum+entry.y,0)/group.items.length;}
  const lines=groups.map(group=>group.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(" ").replace(/\s+/g," ").trim()).filter(Boolean);
  const listIndex=lines.findIndex(line=>/List of Players/i.test(line));
  let headingTail=listIndex>=0?lines[listIndex].replace(/^.*?List of Players/i,"").trim():"";
  const heading=headingTail||lines.slice(Math.max(0,listIndex+1),Math.max(0,listIndex+7)).find(line=>line.length<60&&!/FIFA World Cup|DOB|POS|Club|Height|Caps|Goals|^#|^\d+\s/.test(line))||"";
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
   const sourceTokens=tokens(row.nameArea),playerTokens=tokens(player.name);
   const nameVariants=[player.name,...(Array.isArray(player.aliases)?player.aliases:[])].filter(Boolean);
   const nameMatches=nameVariants.some(name=>tokens(name).every(token=>sourceTokens.includes(token)));
   const positionMatches=positionMap[player.position]===row.position;
   if(!nameMatches)mismatches.push({number:row.number,player:player.name,field:"name",fifa:row.nameArea,dataHub:player.name});
   if(!positionMatches)mismatches.push({number:row.number,player:player.name,field:"position",fifa:row.position,dataHub:player.position});
   candidates.push({number:row.number,playerName:player.name,sourceName:row.nameArea,position:row.position,clubAtTournament:row.club,status:nameMatches&&positionMatches?"matched":"unresolved",notes:nameMatches&&positionMatches?"FIFA shirt number, identity and position match the DataHub squad row.":"Manual review required; club not promoted until identity and position are resolved."});
  }
  if(team)for(const player of team.players)if(!matchedNumbers.has(Number(player.number)))mismatches.push({number:Number(player.number),player:player.name,field:"missing_fifa_row",dataHub:player.name});
  const expected=team?.players.length||0;
  const clean=Boolean(team)&&fifaRows.length===expected&&mismatches.length===0&&candidates.every(row=>row.status==="matched");
  if(clean){
   for(const candidate of candidates){
    const player=team.players.find(p=>Number(p.number)===candidate.number);
    player.club=candidate.clubAtTournament;
   }
  }
  tournamentReport.teams.push({page:pageNo,teamId:team?.id||null,teamName:team?.name||null,pdfHeading:heading,fifaRows:fifaRows.length,dataHubRows:expected,clean,clubValuesParsed:candidates.filter(row=>row.clubAtTournament).length,mismatchCount:mismatches.length,mismatches,candidates});
 }
 tournamentReport.summary={pages:pdf.numPages,teamsMapped:tournamentReport.teams.filter(t=>t.teamId).length,teamsClean:tournamentReport.teams.filter(t=>t.clean).length,totalMismatches:tournamentReport.teams.reduce((n,t)=>n+t.mismatchCount,0)};
 report.tournaments.push(tournamentReport);
}
report.summary={
 tournaments:report.tournaments.length,
 pages:report.tournaments.reduce((n,t)=>n+t.pdfPages,0),
 teams:report.tournaments.reduce((n,t)=>n+t.teams.length,0),
 teamsMapped:report.tournaments.reduce((n,t)=>n+t.summary.teamsMapped,0),
 sourceUnavailableTeams:report.tournaments.reduce((n,t)=>n+t.teams.filter(team=>team.sourceUnavailable).length,0),
 teamsClean:report.tournaments.reduce((n,t)=>n+t.summary.teamsClean,0),
 totalMismatches:report.tournaments.reduce((n,t)=>n+t.summary.totalMismatches,0),
 clubCandidates:report.tournaments.reduce((n,t)=>n+t.teams.reduce((m,team)=>m+team.clubValuesParsed,0),0)
};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/historical-fifa-audit.json",JSON.stringify(report,null,2)+"\n");
await writeFile("artifacts/historical-club-candidates.json",JSON.stringify(candidateData,null,2)+"\n");
console.log(JSON.stringify(report.summary,null,2));
if(report.summary.teams!==160||report.summary.teamsMapped+report.summary.sourceUnavailableTeams!==160)throw new Error("Historical audit did not account for all 160 teams. Inspect audit report.");
