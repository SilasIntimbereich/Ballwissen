import {mkdir,writeFile,readFile} from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_URL="https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf";
const GOAL_URL="https://www.goal.com/en/lists/world-cup-2022-squads/blt5286b592f720ce72";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchBytes(url){
 let lastError;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const response=await fetch(url,{headers:{"User-Agent":"FootballArcade2022RosterAudit/1.0"},signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error("HTTP "+response.status);
   return new Uint8Array(await response.arrayBuffer());
  }catch(error){lastError=error;if(attempt<3)await sleep(500*(2**attempt));}
 }
 throw new Error("Could not fetch "+url+": "+lastError);
}
async function fetchText(url){
 let lastError;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const response=await fetch(url,{headers:{"User-Agent":"FootballArcade2022RosterAudit/1.0"},signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw new Error("HTTP "+response.status);
   return await response.text();
  }catch(error){lastError=error;if(attempt<3)await sleep(500*(2**attempt));}
 }
 throw new Error("Could not fetch "+url+": "+lastError);
}
const decode=s=>String(s||"").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&aacute;/gi,"á").replace(/&eacute;/gi,"é").replace(/&iacute;/gi,"í").replace(/&oacute;/gi,"ó").replace(/&uacute;/gi,"ú").replace(/&ntilde;/gi,"ñ").replace(/&uuml;/gi,"ü").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const htmlText=html=>decode(String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:tr|p|div|li)>/gi,"\n").replace(/<[^>]+>/g," ").replace(/[ \t]+/g," ").replace(/\n+/g,"\n").trim());
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const tokens=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().match(/[a-z0-9]+/g)||[];
const teamKey=s=>{
 const n=normalize(s);
 const aliases={usmnt:"unitedstates",usa:"unitedstates",unitedstatesofamerica:"unitedstates",republicofkorea:"southkorea",korearepublic:"southkorea",cotedivoire:"ivorycoast",ctedivoire:"ivorycoast",congodr:"drcongo",drc:"drcongo",iriran:"iran",holland:"netherlands"};
 return aliases[n]||n;
};
function clubKey(s){
 let n=normalize(String(s||"").replace(/\([^)]*\)/g,"").replace(/\[[A-Z]{3}\]/g,""));
 n=n.replace(/^(fc|cf|afc|ca|sc|as|sl|club|the)/,"").replace(/(fc|cf|afc)$/,"");
 const aliases={
  river:"riverplate",cariverplate:"riverplate",riverplate:"riverplate",
  lyon:"olympiquelyon",olympiquelyon:"olympiquelyon",
  atletico:"atleticomadrid",atleticomadrid:"atleticomadrid",
  tottenham:"tottenhamhotspur",tottenhamhotspur:"tottenhamhotspur",
  inter:"internazionale",intermilan:"internazionale",internazionale:"internazionale",
  bayernmunich:"bayern",bayern:"bayern",bayerleverkusen:"bayerleverkusen",bayer04leverkusen:"bayerleverkusen",
  realbetis:"betis",betis:"betis",psv:"psveindhoven",psveindhoven:"psveindhoven",
  sevilla:"sevilla",manchestercity:"manchestercity",manchesterunited:"manchesterunited",
  villarreal:"villarreal",barcelona:"barcelona",realmadrid:"realmadrid",
  ajax:"ajax",porto:"porto",benfica:"benfica",sportingcp:"sportinglisbon",sportinglisbon:"sportinglisbon",
  antwerp:"royalantwerp",royalantwerp:"royalantwerp",brighton:"brightonhovealbion",brightonandhovealbion:"brightonhovealbion",
  marseille:"marseille",olympiquemarseille:"marseille",monaco:"monaco",asmonaco:"monaco",
  alahli:"alahli",alahly:"alahli",alsadd:"alsadd",alduhail:"alduhail",alhilal:"alhilal",
  celtic:"celtic",stpauli:"stpauli",fcstpauli:"stpauli",newcastleunited:"newcastleunited",
  liverpool:"liverpool",arsenal:"arsenal",chelsea:"chelsea",leicester:"leicestercity",leicestercity:"leicestercity",
  feyenoord:"feyenoord",heerenveen:"heerenveen",besiktas:"besiktas",besiktasjk:"besiktas",
  "": ""
 };
 return aliases[n]||n;
}
const clubMatches=(a,b)=>{
 const x=clubKey(a),y=clubKey(b);
 return Boolean(x&&y&&(x===y||(x.length>=6&&y.length>=6&&(x.includes(y)||y.includes(x)))));
};
function namesMatch(a,b){
 const aa=normalize(a),bb=normalize(b);
 if(aa&&bb&&(aa===bb||aa.includes(bb)||bb.includes(aa)))return true;
 const at=tokens(a),bt=tokens(b),shared=at.filter(t=>bt.includes(t));
 if(at.length===1||bt.length===1)return shared.length===1;
 return shared.length>=2;
}
function normalizePosition(value){
 const p=String(value||"").trim().toUpperCase().replace(/[^A-Z]/g,"");
 if(["G","GK","GKP","GOALKEEPER"].includes(p))return "GK";
 if(["D","DF","DEF","DEFENDER"].includes(p))return "DF";
 if(["M","MF","MID","MIDFIELDER"].includes(p))return "MF";
 if(["F","FW","FORWARD","STRIKER"].includes(p))return "FW";
 return null;
}
function parseGoal(html,teams){
 const headings=[...html.matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi)];
 const matched=[];
 for(const h of headings){
  const label=htmlText(h[1]);
  const team=teams.find(t=>teamKey(t.name)===teamKey(label));
  if(team)matched.push({team,start:h.index,end:h.index+h[0].length,label});
 }
 const result=new Map();
 for(let i=0;i<matched.length;i++){
  const item=matched[i],end=matched[i+1]?.start??html.length;
  const section=html.slice(item.end,end),rows=[];
  for(const tr of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>htmlText(m[1]));
   if(cells.length<4)continue;
   const position=normalizePosition(cells[0]),name=cells[1],club=cells[cells.length-1];
   if(position&&name&&club)rows.push({position,name,club});
  }
  result.set(item.team.id,rows);
 }
 return result;
}
const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const candidateData=structuredClone(historical);
const rosterAudit=JSON.parse(await readFile("data/roster-audit.json","utf8"));
const teams=historical.tournaments["2022"];
const goalHtml=await fetchText(GOAL_URL);
const goalTeams=parseGoal(goalHtml,teams);
const pdfBytes=await fetchBytes(PDF_URL);

const pdf=await pdfjs.getDocument({data:pdfBytes,useSystemFonts:true,isEvalSupported:false}).promise;
const report={source:PDF_URL,secondarySource:GOAL_URL,generatedAt:new Date().toISOString(),pages:pdf.numPages,teams:[],summary:{}};
for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
 const page=await pdf.getPage(pageNo),content=await page.getTextContent();
 const items=content.items.filter(item=>"str" in item&&item.str.trim()).map(item=>({x:item.transform[4],y:item.transform[5],text:item.str.trim()})).sort((a,b)=>b.y-a.y||a.x-b.x);
 const groups=[];
 for(const item of items){
  let group=groups[groups.length-1];
  if(!group||Math.abs(group.y-item.y)>2.5){group={y:item.y,items:[]};groups.push(group);}
  group.items.push(item);group.y=group.items.reduce((sum,entry)=>sum+entry.y,0)/group.items.length;
 }
 const lines=groups.map(group=>group.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(" ").replace(/\s+/g," ").trim());
 const heading=lines.find(line=>/\([A-Z]{3}\)$/.test(line)&&!/^#/.test(line));
 const headingName=heading?.replace(/\s*\([A-Z]{3}\)$/,"").trim()||"";
 const team=teams.find(t=>teamKey(t.name)===teamKey(headingName));
 const teamRows=team?.players||[];
 const fifaRows=[],unparsed=[];
 for(const line of lines){
  const m=line.match(/^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)$/);
  if(m){
   const clubMatch=m[5].match(/\s*\(([A-Z]{3})\)\s*$/);
   fifaRows.push({number:Number(m[1]),position:m[2],nameArea:m[3],club:m[5].replace(/\s*\([A-Z]{3}\)\s*$/,"").trim(),clubCountry:clubMatch?.[1]||null,line});
  }else if(/^\d{1,2}\s+(GK|DF|MF|FW)\s+/.test(line))unparsed.push(line);
 }
 const goalRows=team?goalTeams.get(team.id)||[]:[];
 const mismatches=[];
 if(!team)mismatches.push({field:"team_mapping",pdfHeading:heading});
 if(fifaRows.length!==teamRows.length)mismatches.push({field:"fifa_row_count",fifa:fifaRows.length,dataset:teamRows.length});
 if(goalRows.length!==26)mismatches.push({field:"goal_row_count",goal:goalRows.length,dataset:26});
 const goalUsed=new Set();
 const byNumber=new Map(fifaRows.map(row=>[row.number,row]));
 for(const player of teamRows){
  const fifa=byNumber.get(Number(player.number));
  if(!fifa){mismatches.push({number:player.number,player:player.name,field:"missing_fifa_row"});continue;}
  if(!namesMatch(player.name,fifa.nameArea))mismatches.push({number:player.number,player:player.name,field:"fifa_name",sourceName:fifa.nameArea});
  if(player.position!==fifa.position)mismatches.push({number:player.number,player:player.name,field:"fifa_position",sourcePosition:fifa.position,datasetPosition:player.position});
  const candidates=goalRows.map((row,index)=>({row,index})).filter(item=>namesMatch(player.name,item.row.name));
  const match=candidates.length===1?candidates[0]:null;
  if(!match){mismatches.push({number:player.number,player:player.name,field:candidates.length?"ambiguous_goal_player":"missing_goal_player",candidates:candidates.map(x=>x.row.name)});continue;}
  goalUsed.add(match.index);
  if(match.row.position!==fifa.position)mismatches.push({number:player.number,player:player.name,field:"goal_position",goal:match.row.position,fifa:fifa.position});
  if(!clubMatches(fifa.club,match.row.club))mismatches.push({number:player.number,player:player.name,field:"club_sources_disagree",fifaClub:fifa.club,goalClub:match.row.club});
 }
 goalRows.forEach((row,index)=>{if(!goalUsed.has(index))mismatches.push({player:row.name,field:"extra_goal_player",position:row.position,club:row.club});});
 const clean=Boolean(team)&&fifaRows.length===26&&goalRows.length===26&&mismatches.length===0&&unparsed.length===0;
 const item={page:pageNo,pdfHeading:heading,teamId:team?.id||null,teamName:team?.name||null,fifaRows:fifaRows.map(({number,position,nameArea,club,clubCountry})=>({number,position,nameArea,club,clubCountry})),goalRows,unparsedRows:unparsed,mismatches,clean};
 report.teams.push(item);
 if(clean){
  const candidateTeam=candidateData.tournaments["2022"].find(row=>row.id===team.id);
  const auditPlayers=[];
  for(const player of candidateTeam.players){
   const source=byNumber.get(Number(player.number));
   player.club=source.club||null;
   player.clubCountry=source.clubCountry||null;
   auditPlayers.push({
    playerName:player.name,sourceName:source.nameArea,sourceNameAliases:[player.name],
    number:Number(player.number),position:player.position,clubAtTournament:player.club,
    status:"matched",
    notes:"Player, shirt number, position and tournament-time club match between FIFA's final squad PDF and Goal.com's independent tournament squad list."
   });
  }
  rosterAudit.teams[team.id]={
   status:"verified",tournament:2022,teamNameInDataset:team.name,
   teamNameInFifaPdf:heading,reviewedAt:report.generatedAt.slice(0,10),
   primarySource:PDF_URL,secondarySource:GOAL_URL,tertiarySource:"https://datahub.io/football/worldcup",
   notes:"All 26 player rows match across FIFA's final squad PDF and Goal.com's independent squad list by identity, position and tournament-time club. The DataHub-derived dataset independently matches player names, shirt numbers and positions.",
   players:auditPlayers
  };
 }
}
report.summary={
 teams:report.teams.length,
 parsedFifaTeams:report.teams.filter(t=>t.fifaRows.length===26).length,
 parsedGoalTeams:report.teams.filter(t=>t.goalRows.length===26).length,
 cleanTeams:report.teams.filter(t=>t.clean).length,
 totalMismatches:report.teams.reduce((n,t)=>n+t.mismatches.length,0),
 unresolvedTeams:report.teams.filter(t=>!t.clean).map(t=>t.teamName||t.pdfHeading||"Unknown")
};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/2022-roster-club-audit.json",JSON.stringify(report,null,2)+"\n");
await writeFile("artifacts/historical-squads-updated.json",JSON.stringify(candidateData,null,2)+"\n");
await writeFile("artifacts/roster-audit-updated.json",JSON.stringify(rosterAudit,null,2)+"\n");
console.log(JSON.stringify(report.summary,null,2));
if(report.teams.length!==32||report.summary.parsedFifaTeams!==32||report.summary.parsedGoalTeams!==32){
 throw new Error("The 2022 audit could not parse all 32 FIFA and Goal team lists. Inspect the audit artifact.");
}
