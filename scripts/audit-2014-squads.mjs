import {mkdir,writeFile,readFile} from "node:fs/promises";

const PLANET_INDEX="https://www.planetworldcup.com/CUPS/2014/wc14squads.html";
const FOOTBALL_INDEX="https://www.footballsquads.co.uk/national/worldcup/wc2014.htm";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchText(url){
 let lastError;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const response=await fetch(url,{headers:{"User-Agent":"FootballArcade2014RosterAudit/1.0"},signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error("HTTP "+response.status);
   return await response.text();
  }catch(error){lastError=error;if(attempt<3)await sleep(500*(2**attempt));}
 }
 throw new Error("Could not fetch "+url+": "+lastError);
}
function decode(s){
 return String(s||"")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&aacute;/gi,"á").replace(/&eacute;/gi,"é").replace(/&iacute;/gi,"í").replace(/&oacute;/gi,"ó").replace(/&uacute;/gi,"ú")
  .replace(/&Aacute;/g,"Á").replace(/&Eacute;/g,"É").replace(/&ntilde;/gi,"ñ").replace(/&uuml;/gi,"ü")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}
function textFromHtml(html){
 return decode(String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:tr|p|div|pre|h[1-6]|li)>/gi,"\n")
  .replace(/<[^>]+>/g," ").replace(/[ \t]+/g," ").replace(/\n\s+/g,"\n"))
  .replace(/\r/g,"").trim();
}
function linksFrom(html,pattern){
 const out=[];
 const tags=[...html.matchAll(/<(a|area)\b([^>]*)>(?:([\s\S]*?)<\/a>)?/gi)];
 for(const m of tags){
  const attrs=m[2],inner=m[3]||"",href=attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(!href||!pattern.test(href))continue;
  const label=textFromHtml(inner)||inner.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1]||attrs.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1]||attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1]||"";
  out.push({href,label:decode(label)});
 }
 return out;
}
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const tokens=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().match(/[a-z0-9]+/g)||[];
function teamKey(s){
 const n=normalize(s);
 const aliases={
  repofireland:"republicofireland",ireland:"republicofireland",cotedivoire:"ivorycoast",bosniaherzegovina:"bosniaandherzegovina",
  usa:"unitedstates",unitedstatesofamerica:"unitedstates",
  korearepublic:"southkorea",korea:"southkorea",
  chinapr:"china"
 };
 return aliases[n]||n;
}
function clubKey(s){
 let n=normalize(String(s||"").replace(/\([^)]*\)/g,"").replace(/\[[A-Z]{3}\]/g,""));
 n=n.replace(/^(rsc|sc|fc|afc|as|ac|vfb|sv|1fc)/,"").replace(/(fc|cf|afc)$/,"");
 const aliases={
  manchesteru:"manchesterunited",newcastleu:"newcastleunited",westhamu:"westhamunited",
  tottenhamh:"tottenhamhotspur",boltonw:"boltonwanderers",leedsu:"leedsunited",
  coventryc:"coventrycity",ipswicht:"ipswichtown",blackburnr:"blackburnrovers",
  charltona:"charltonathletic",wolverhamptonwanderers:"wolves",
  bayer04leverkusen:"bayerleverkusen",bayernmunich:"bayern",fcbayernmunchen:"bayern",
  hellasverona:"verona",girondinsbordeaux:"bordeaux",deportivoalajuelense:"alajuelense",
  glasgowceltic:"celtic",glasgowrangers:"rangers",alhelal:"alhilal",alhilal:"alhilal",
  monaco:"monaco",asmonaco:"monaco",betis:"realbetis",realbetis:"realbetis",
  inter:"internazionale",internazionale:"internazionale",milan:"milan",acmilan:"milan",
  parisstgermain:"parissaintgermain",parissaintgermain:"parissaintgermain",
  "1fckaiserslautern":"kaiserslautern",kaiserslautern:"kaiserslautern",
  realmallorca:"mallorca",mallorca:"mallorca",realvalladolid:"valladolid",valladolid:"valladolid",
  cologne:"koln",koln:"koln",nacionaluru:"nacional",santoslaguna:"santoslaguna",
  unattached:"unattached",noclub:"unattached"
 };
 return aliases[n]||n;
}
function namesMatch(a,b){
 const aa=normalize(a),bb=normalize(b);
 if(aa&&bb&&(aa.includes(bb)||bb.includes(aa)))return true;
 const at=tokens(a),bt=tokens(b);
 const shared=at.filter(token=>bt.includes(token));
 if(at.length===1||bt.length===1)return shared.length===1;
 return shared.length>=2;
}
function parsePlanet(html){
 const pre=html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i)?.[1]||html;
 const text=textFromHtml(pre),rows=[],unparsed=[];
 for(const line of text.split("\n")){
  const m=line.match(/^\s*(\d{1,2})\s+(GK|DF|MD|MF|FW)\s+(.+?)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s*$/);
  if(m){
   let club=m[5].replace(/\s+\d{4}(?:,\d{2})*$/,"").trim();
   rows.push({number:Number(m[1]),position:m[2]==="MD"?"MF":m[2],name:m[3].trim(),club});
  }else if(/^\s*\d{1,2}\s+(GK|DF|MD|MF|FW)\s+/.test(line))unparsed.push(line.trim());
 }
 return {rows,unparsed};
}
function parseFootballSquads(html){
 const rows=[],unparsed=[];
 for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>textFromHtml(m[1]));
  if(cells.length>=8&&/^\d{1,2}$/.test(cells[0])){
   const pos=({G:"GK",GK:"GK",GOALKEEPER:"GK",D:"DF",DF:"DF",DEFENDER:"DF",M:"MF",MF:"MF",MIDFIELDER:"MF",F:"FW",FW:"FW",FORWARD:"FW",STRIKER:"FW"})[cells[2].toUpperCase()]||null;
   rows.push({number:Number(cells[0]),name:cells[1],position:pos,club:cells[cells.length-1]});
  }
 }
 if(!rows.length){
  const text=textFromHtml(html);
  for(const line of text.split("\n")){
   const m=line.match(/^\s*(\d{1,2})\s+(.+?)\s+([GDMF])\s+.+?\s+(\d{2}-\d{2}-\d{2})\s+.+?\s+(.+?)\s*$/);
   if(m)rows.push({number:Number(m[1]),name:m[2],position:{G:"GK",D:"DF",M:"MF",F:"FW"}[m[3]],club:m[5]});
  }
 }
 return {rows,unparsed};
}
const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const candidateData=structuredClone(historical);
const rosterAudit=JSON.parse(await readFile("data/roster-audit.json","utf8"));
const teams=historical.tournaments["2014"];
const planetHtml=await fetchText(PLANET_INDEX);
const footballHtml=await fetchText(FOOTBALL_INDEX);
const planetLinks=linksFrom(planetHtml,/squad_[a-z0-9]+14\.html/i);
const report={sources:{planetIndex:PLANET_INDEX,footballSquadsIndex:FOOTBALL_INDEX},generatedAt:new Date().toISOString(),teams:[],summary:{}};
const lookup=(label)=>{
 const key=teamKey(label);
 return teams.find(t=>teamKey(t.name)===key)||
  (key==="republicofireland"?teams.find(t=>t.id==="republic-of-ireland-2014"):null)||
  (key==="unitedstates"?teams.find(t=>t.id==="united-states-2014"):null);
};
const footballLinks=linksFrom(footballHtml,/\.htm/i).filter(link=>lookup(link.label));
const fetchCache=new Map();
async function getPage(base,href){
 const url=new URL(href,base).href;
 if(!fetchCache.has(url))fetchCache.set(url,fetchText(url));
 return fetchCache.get(url);
}
for(const team of teams){
 const planetLink=planetLinks.find(x=>lookup(x.label)?.id===team.id);
 const footballLink=footballLinks.find(x=>lookup(x.label)?.id===team.id);
 const item={teamId:team.id,teamName:team.name,planetUrl:planetLink?new URL(planetLink.href,PLANET_INDEX).href:null,footballSquadsUrl:footballLink?new URL(footballLink.href,FOOTBALL_INDEX).href:null,planetRows:[],footballRows:[],mismatches:[],unparsedPlanetRows:[]};
 if(planetLink){
  try{const parsed=parsePlanet(await getPage(PLANET_INDEX,planetLink.href));item.planetRows=parsed.rows;item.unparsedPlanetRows=parsed.unparsed;}
  catch(error){item.mismatches.push({field:"planet_source_fetch",error:String(error)});}
 }else item.mismatches.push({field:"planet_source_link",labelMissing:true});
 if(footballLink){
  try{const parsed=parseFootballSquads(await getPage(FOOTBALL_INDEX,footballLink.href));item.footballRows=parsed.rows;}
  catch(error){item.mismatches.push({field:"football_squads_fetch",error:String(error)});}
 }else item.mismatches.push({field:"football_squads_link",labelMissing:true});
 const pByNumber=new Map(item.planetRows.map(row=>[row.number,row]));
 const fByNumber=new Map(item.footballRows.map(row=>[row.number,row]));
 for(const player of team.players){
  const p=pByNumber.get(Number(player.number)),f=fByNumber.get(Number(player.number));
  if(!p)item.mismatches.push({number:player.number,player:player.name,field:"missing_planet_row"});
  if(!f)item.mismatches.push({number:player.number,player:player.name,field:"missing_football_squads_row"});
  for(const [source,row] of [["Planet World Cup",p],["FootballSquads",f]]){
   if(!row)continue;
   if(!namesMatch(player.name,row.name))item.mismatches.push({number:player.number,player:player.name,field:"name",source,sourceName:row.name});
   if(player.position!==row.position)item.mismatches.push({number:player.number,player:player.name,field:"position",source,sourcePosition:row.position,datasetPosition:player.position});
  }
  if(p&&f){
   if(clubKey(p.club)!==clubKey(f.club))item.mismatches.push({number:player.number,player:player.name,field:"club_sources_disagree",planetClub:p.club,footballSquadsClub:f.club});
  }
 }
 for(const row of item.planetRows)if(!team.players.some(p=>Number(p.number)===row.number))item.mismatches.push({number:row.number,field:"extra_planet_row",sourceName:row.name});
 for(const row of item.footballRows)if(!team.players.some(p=>Number(p.number)===row.number))item.mismatches.push({number:row.number,field:"extra_football_squads_row",sourceName:row.name});
 item.clean=item.planetRows.length===23&&item.footballRows.length===23&&item.mismatches.length===0;
 item.candidateClubs=item.clean?item.planetRows.map(row=>({number:row.number,club:row.club})): [];
 if(item.clean){
  const candidateTeam=candidateData.tournaments["2014"].find(row=>row.id===team.id);
  const auditPlayers=[];
  for(const player of candidateTeam.players){
   const source=pByNumber.get(Number(player.number));
   const country=source.club.match(/\(([A-Z]{3})\)\s*$/)?.[1]||null;
   const club=source.club.replace(/\s*\([A-Z]{3}\)\s*$/,"").trim();
   player.club=club||null;
   player.clubCountry=country;
   auditPlayers.push({
    playerName:player.name,sourceName:source.name,sourceNameAliases:[player.name],
    number:Number(player.number),position:player.position,clubAtTournament:player.club,
    status:"matched",
    notes:"Player, shirt number, position and tournament-time club match between Planet World Cup and FootballSquads."
   });
  }
  rosterAudit.teams[team.id]={
   status:"verified",tournament:2014,teamNameInDataset:team.name,
   teamNameInPrimarySource:team.name,
   reviewedAt:new Date().toISOString().slice(0,10),
   primarySource:item.planetUrl,secondarySource:item.footballSquadsUrl,
   tertiarySource:"https://datahub.io/football/worldcup",
   notes:"All 23 player rows match across Planet World Cup and FootballSquads by shirt number, identity, position and tournament-time club. The DataHub-derived dataset independently matches the player names and positions.",
   players:auditPlayers
  };
 }
 report.teams.push(item);
}
report.summary={
 teams:report.teams.length,
 planetTeams:report.teams.filter(t=>t.planetRows.length===23).length,
 footballSquadsTeams:report.teams.filter(t=>t.footballRows.length===23).length,
 cleanTeams:report.teams.filter(t=>t.clean).length,
 totalMismatches:report.teams.reduce((n,t)=>n+t.mismatches.length,0),
 unresolvedTeams:report.teams.filter(t=>!t.clean).map(t=>t.teamName)
};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/historical-squads-updated.json",JSON.stringify(candidateData,null,2)+"\n");
await writeFile("artifacts/roster-audit-updated.json",JSON.stringify(rosterAudit,null,2)+"\n");
await writeFile("artifacts/2014-roster-club-audit.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report.summary,null,2));
if(report.teams.length!==32||report.summary.planetTeams!==32||report.summary.footballSquadsTeams!==32){
 throw new Error("The 2014 audit could not retrieve all 32 team pages from both independent sources.");
}
