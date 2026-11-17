import {mkdir,writeFile,readFile} from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_URL="https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf";
const GOAL_URL="https://www.goal.com/en/lists/world-cup-2022-squads/blt5286b592f720ce72";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
const pdfBytes=new Uint8Array(await (await fetchText(PDF_URL)).arrayBuffer?.()||[]);
