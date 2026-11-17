import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";

const SOURCE_INDEX="https://www.footballsquads.co.uk/national/worldcup/wc2022.htm";
const normalize=value=>String(value||"").replace(/\u0000/g,"fi").replace(/[æÆ]/g,"ae").replace(/[øØ]/g,"o").replace(/[åÅ]/g,"a").replace(/[łŁ]/g,"l").replace(/[ß]/g,"ss").replace(/[œŒ]/g,"oe").replace(/[đĐ]/g,"dj").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const teamAliases={iriran:"iran",korearepublic:"southkorea",usa:"unitedstates",koreadpr:"northkorea",chinapr:"china",repofireland:"republicofireland"};
const clubPrefixes=new Set(["fc","cf","ca","cr","se","sl","rsc","bsc","rc","rcd","vfl","sfc","ac","cd","afc","sc","club","as","ss","ssc","gd","kmsr","es","sd","ad","us","gnk","tsg","ogc","fsv","sv","fk","aj","acf","vfb","stade","al"]);
const clubSuffixes=new Set(["fc","cf","sc","sfc","afc","calcio","bsc","jk","as"]);
const clubAliases={
 atlantau:"atlantaunited",brightonha:"brightonhovealbion",hearts:"heartofmidlothian",melbournec:"melbournecity",
 staderennais:"rennes",rennais:"rennes",galatasaraysk:"galatasaray",fenerbahcesk:"fenerbahce",pumasunam:"unam",
 aristhessaloniki:"aris",besiktasjk:"besiktas",minnesotau:"minnesotaunited",gdchaves:"chaves",
 kmsrdeinze:"deinze",estroyes:"troyes",adsancarlos:"sancarlos",adguanacasteca:"guanacasteca",
 cincinnatti:"cincinnati",gnkdinamozagreb:"dinamozagreb",ussassuolo:"sassuolo",tsg1899hoffenheim:"1899hoffenheim",
 ogcnice:"nice",atalantabergamo:"atalanta",herthabsc:"herthaberlin",hertha:"herthaberlin",sdaucas:"aucas",
 perspolistehran:"persepolis",aekathens:"aek",mainz05:"mainz",olympiakos:"olympiacos",esperancetunis:"esperance",stadereims:"reims",urawareds:"urawareddiamonds",
 uscremonese:"cremonese",wolverhamptonw:"wolverhamptonwanderers",feyenoordrotterdam:"feyenoord",
 legiawarsaw:"legiawarszawa",clermontfoot:"clermont",birminghamc:"birminghamcity",sportingbraga:"braga",
 queensparkrangers:"qpr",olympiacospiraeus:"olympiacos",nottinghamf:"nottinghamforest",
 ussalernitana:"salernitana",fkcrvenazvezda:"crvenazvezda",acffiorentina:"fiorentina",
 jeonbukhyundaimotors:"jeonbukhyundai",fsvmainz05:"mainz",nashvillesoccerclub:"nashvillesc",
 lutont:"lutontown",antalyasporas:"antalyaspor",swanseac:"swanseacity",brightonhovealbion:"brightonhovealbion",
 bayer04leverkusen:"bayerleverkusen",bayernmunchen:"bayernmunich",bmonchengladbach:"borussiamonchengladbach",
 borussiadortmund:"dortmund",eintrachtfrankfurt:"frankfurt",fckobenhavn:"copenhagen",kobenhavn:"copenhagen",
 fckoln:"cologne",koln:"cologne",fcbayernmunchen:"bayernmunich",hellasverona:"verona",
 girondinsbordeaux:"bordeaux",deportivoalajuelense:"alajuelense",glasgowceltic:"celtic",glasgowrangers:"rangers",
 betis:"realbetis",inter:"internazionale",acmilan:"milan",parisstgermain:"parissaintgermain",
 parissaintgermain:"parissaintgermain",realmallorca:"mallorca",mallorca:"mallorca",realvalladolid:"valladolid",
 valladolid:"valladolid",nacionaluru:"nacional",ajaxamsterdam:"ajax",sportingcp:"sportinglisbon",
 sportinglisbon:"sportinglisbon",olympiquelyon:"lyon",olympiquemarseille:"marseille",benca:"benfica",
 manchesterc:"manchestercity",manchesteru:"manchesterunited",newcastleu:"newcastleunited",westhamu:"westhamunited",
 tottenhamh:"tottenhamhotspur",leicesterc:"leicestercity",boltonw:"boltonwanderers",leedsu:"leedsunited",
 coventryc:"coventrycity",ipswicht:"ipswichtown",blackburnr:"blackburnrovers",charltona:"charltonathletic",
 alahlisaudi:"ahli",alkuwait:"kuwait",qpr:"qpr",unam:"unam",velezsarsfield:"velezsarsfield"
};

function decode(value){
 const named={"&amp;":"&","&nbsp;":" ","&quot;":"\"","&#39;":"'","&apos;":"'","&lt;":"<","&gt;":">",
 "&aacute;":"á","&Aacute;":"Á","&eacute;":"é","&Eacute;":"É","&iacute;":"í","&Iacute;":"Í",
 "&oacute;":"ó","&Oacute;":"Ó","&uacute;":"ú","&Uacute;":"Ú","&ouml;":"ö","&Ouml;":"Ö",
 "&uuml;":"ü","&Uuml;":"Ü","&ntilde;":"ñ","&Ntilde;":"Ñ","&ccedil;":"ç","&Ccedil;":"Ç",
 "&atilde;":"ã","&Atilde;":"Ã","&oslash;":"ø","&Oslash;":"Ø"};
 return value.replace(/&(?:amp|nbsp|quot|apos|lt|gt|aacute|Aacute|eacute|Eacute|iacute|Iacute|oacute|Oacute|uacute|Uacute|ouml|Ouml|uuml|Uuml|ntilde|Ntilde|ccedil|Ccedil|atilde|Atilde|oslash|Oslash);|&#\d+;|&#x[\da-f]+;/gi,entity=>{
  if(named[entity])return named[entity];
  const numeric=entity.match(/^&#(x[\da-f]+|\d+);$/i);
  return numeric?String.fromCodePoint(numeric[1][0].toLowerCase()==="x"?parseInt(numeric[1].slice(1),16):Number(numeric[1])):entity;
 });
}
function textFromHtml(html){
 return decode(String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/(?:tr|p|div|pre|h[1-6]|li)>/gi,"\n")
  .replace(/<[^>]+>/g," ").replace(/[ \t]+/g," ").replace(/\n\s+/g,"\n")).replace(/\r/g,"").trim();
}
function linksFrom(html,pattern){
 const out=[];
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  if(!href||!pattern.test(href))continue;
  const label=textFromHtml(m[2])||m[2].match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1]||m[1].match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1]||"";
  out.push({href,label:decode(label)});
 }
 return out;
}
function teamKey(value){const key=normalize(value);return teamAliases[key]||key;}
export function clubKey(value){
 const raw=String(value||"").replace(/\u0000/g,"fi").replace(/\[[^\]]*\]/g,"").replace(/\([^)]*\)/g,"");
 let parts=raw.split(/\s+/).map(normalize).filter(Boolean);
 while(parts.length&&clubPrefixes.has(parts[0]))parts.shift();
 while(parts.length&&clubSuffixes.has(parts[parts.length-1]))parts.pop();
 const key=parts.join("");
 return clubAliases[key]||key;
}
function normalizePosition(value){
 const p=String(value||"").trim().toUpperCase().replace(/[^A-Z]/g,"");
 if(["G","GK","GKP","GOALKEEPER"].includes(p))return "GK";
 if(["D","DF","DEF","DEFENDER","CB","LCB","RCB","LB","RB","RWB","LWB"].includes(p))return "DF";
 if(["M","MF","MID","MIDFIELDER","DM","CDM","CM","LCM","RCM","AM","CAM","LAM","RAM","LM","RM"].includes(p))return "MF";
 if(["F","FW","FORWARD","ST","CF","STRIKER","LW","RW","LF","RF","WINGER"].includes(p))return "FW";
 return null;
}
function parseFootballSquads(html){
 const rows=[];
 for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>textFromHtml(m[1]));
  if(cells.length>=8&&/^\d{1,2}$/.test(cells[0])){
   const position=cells.slice(2,-1).map(normalizePosition).find(Boolean)||null;
   rows.push({number:Number(cells[0]),name:cells[1],position,club:cells[cells.length-1]});
  }
 }
 return rows;
}
async function fetchText(url){
 const response=await fetch(url,{headers:{"User-Agent":"FootballArcade2022ClubAudit/1.0"},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error("HTTP "+response.status+" for "+url);
 return response.text();
}

const historical=JSON.parse(await readFile("data/historical-squads.json","utf8"));
const fifaAudit=JSON.parse(await readFile("artifacts/historical-fifa-audit.json","utf8"));
const teams=historical.tournaments["2022"]||[];
const report={year:2022,primarySource:"https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf",secondarySource:SOURCE_INDEX,generatedAt:new Date().toISOString(),sourceStatus:"available",teams:[],summary:{}};
let indexHtml;
try{indexHtml=await fetchText(SOURCE_INDEX);}catch(error){
 report.sourceStatus="unavailable";report.sourceError=String(error);
 report.summary={sourceRows:0,teamsFound:0,teams:32,fullyCrossCheckedTeams:0,clubMismatches:0,nameMismatches:0,missingRows:0};
 await mkdir("artifacts",{recursive:true});await writeFile("artifacts/2022-independent-club-audit.json",JSON.stringify(report,null,2)+String.fromCharCode(10));
 console.log(JSON.stringify(report.summary,null,2));process.exit(0);
}
const links=linksFrom(indexHtml,/\.htm/i);
const linkByTeam=new Map();
for(const link of links){const team=teams.find(t=>teamKey(t.name)===teamKey(link.label));if(team)linkByTeam.set(team.id,link);}
const manualNameAliases={
 "argentina-2022":{17:["Alejandro Gomez"]},
 "australia-2022":{1:["Mat Ryan"],7:["Matthew Leckie"]},
 "cameroon-2022":{21:["Jean-Charles Castelleto"]},
 "ghana-2022":{7:["Abdul Fatawu"]},
 "mexico-2022":{10:["Ernesto Vega"]},
 "morocco-2022":{12:["Munir"],19:["Yousseff En-Nesyri"]},
 "portugal-2022":{22:["Diego Costa"]},
 "qatar-2022":{26:["Mostafa Tarek"]},
 "saudi-arabia-2022":{5:["Ali Al-Bulayhi"],6:["Mohammed Al-Burayk"],8:["Abdulelah Al-Malki"],9:["Feras Al-Brikan"],13:["Yasir Al-Shahrani"],17:["Hassan Tambakti"],18:["Nawaf Al-Abid"],19:["Hatan Bahbri"],20:["Abdulrahman Al-Obud"]},
 "serbia-2022":{15:["Srdjan Babic"],21:["Filip Djuričić"]},
 "south-korea-2022":{10:["Lee Jae-Song"]},
 "spain-2022":{17:["Yéremi Pino"],20:["Daniel Carvajal"]},
 "switzerland-2022":{18:["Eray Cümart"]},
 "tunisia-2022":{25:["Anis Slimane"]},
 "uruguay-2022":{18:["Maximiliano Gomez"]},
 "wales-2022":{18:["Jonathan Williams"],26:["Matt Smith"]}
};
const fifaTournament=fifaAudit.tournaments.find(t=>t.year===2022);
let totalRows=0;
for(const team of teams){
 const link=linkByTeam.get(team.id);
 const item={teamId:team.id,teamName:team.name,sourceUrl:link?new URL(link.href,SOURCE_INDEX).href:null,sourcePlayerCount:0,fullyCrossChecked:false,clubMatches:0,clubMismatches:0,nameMismatches:0,mismatches:[],comparisons:[]};
 if(!link){item.mismatches.push({field:"missing_source_link"});report.teams.push(item);continue;}
 let rows=[];
 try{rows=parseFootballSquads(await fetchText(item.sourceUrl));}catch(error){item.sourceError=String(error);item.mismatches.push({field:"source_fetch",error:String(error)});report.teams.push(item);continue;}
 item.sourcePlayerCount=rows.length;totalRows+=rows.length;
 const fifaTeam=fifaTournament?.teams.find(t=>t.teamId===team.id);
 const fifaCandidates=new Map((fifaTeam?.candidates||[]).map(row=>[row.number,row]));
 const playerByNumber=new Map(team.players.map(p=>[Number(p.number),p]));
 const matchedNumbers=new Set();
 for(const row of rows){
  const player=playerByNumber.get(row.number),fifa=fifaCandidates.get(row.number);
  if(!player||!fifa){item.mismatches.push({number:row.number,field:"missing_player_or_fifa_candidate",sourceName:row.name});continue;}
  matchedNumbers.add(row.number);
  const aliasVariants=manualNameAliases[team.id]?.[row.number]||[];\n  const identityMatches=namesMatch(player.name,row.name)||namesMatch(fifa.sourceName,row.name)||aliasVariants.some(alias=>namesMatch(alias,row.name));
  const fifaClub=String(fifa.clubAtTournament||"");
  const clubMatches=clubKey(fifaClub)===clubKey(row.club);
  const positionMatches=fifa.position===row.position;
  if(!identityMatches)item.mismatches.push({number:row.number,field:"name",datasetName:player.name,sourceName:row.name});
  if(!clubMatches)item.mismatches.push({number:row.number,field:"club",fifaClub,secondaryClub:row.club,canonicalFifaClub:clubKey(fifaClub),canonicalSecondaryClub:clubKey(row.club)});
  item.comparisons.push({number:row.number,playerName:player.name,secondaryName:row.name,identityMatches,fifaPosition:fifa.position,secondaryPosition:row.position,positionMatches,fifaClub,secondaryClub:row.club,clubMatches});
  if(clubMatches)item.clubMatches++;else item.clubMismatches++;
  if(!identityMatches)item.nameMismatches++;
 }
 for(const player of team.players)if(!matchedNumbers.has(Number(player.number)))item.mismatches.push({number:Number(player.number),field:"missing_secondary_row",player:player.name});
 item.fullyCrossChecked=rows.length===team.players.length&&item.comparisons.length===team.players.length&&item.mismatches.length===0;
 report.teams.push(item);
}
report.summary={sourceRows:totalRows,teamsFound:linkByTeam.size,teams:report.teams.length,fullyCrossCheckedTeams:report.teams.filter(t=>t.fullyCrossChecked).length,clubMismatches:report.teams.reduce((n,t)=>n+t.clubMismatches,0),nameMismatches:report.teams.reduce((n,t)=>n+t.nameMismatches,0),positionDifferences:report.teams.reduce((n,t)=>n+t.comparisons.filter(x=>!x.positionMatches).length,0),missingRows:report.teams.reduce((n,t)=>n+t.mismatches.filter(m=>m.field.startsWith("missing")).length,0)};
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/2022-independent-club-audit.json",JSON.stringify(report,null,2)+String.fromCharCode(10));
console.log(JSON.stringify(report.summary,null,2));
if(report.teams.length!==32||linkByTeam.size!==32)throw new Error("2022 independent audit did not locate all 32 team pages");
