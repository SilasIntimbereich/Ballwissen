import worldCup2026 from "../../data/worldcup-2026.json" with { type: "json" };

const demo2018={id:"france-2018",name:"France",year:2018,verified:false,players:[
{name:"Hugo Lloris",position:"GK",club:"Tottenham Hotspur"},{name:"Steve Mandanda",position:"GK",club:"Marseille"},{name:"Alphonse Areola",position:"GK",club:"Paris Saint-Germain"},
{name:"Raphaël Varane",position:"DF",club:"Real Madrid"},{name:"Samuel Umtiti",position:"DF",club:"Barcelona"},{name:"Presnel Kimpembe",position:"DF",club:"Paris Saint-Germain"},{name:"Benjamin Pavard",position:"DF",club:"VfB Stuttgart"},{name:"Lucas Hernandez",position:"DF",club:"Atlético Madrid"},{name:"Djibril Sidibé",position:"DF",club:"Monaco"},{name:"Adil Rami",position:"DF",club:"Marseille"},{name:"Benjamin Mendy",position:"DF",club:"Manchester City"},
{name:"Paul Pogba",position:"MF",club:"Manchester United"},{name:"N'Golo Kanté",position:"MF",club:"Chelsea"},{name:"Blaise Matuidi",position:"MF",club:"Juventus"},{name:"Steven Nzonzi",position:"MF",club:"Sevilla"},{name:"Corentin Tolisso",position:"MF",club:"Bayern Munich"},
{name:"Antoine Griezmann",position:"FW",club:"Atlético Madrid"},{name:"Kylian Mbappé",position:"FW",club:"Paris Saint-Germain"},{name:"Olivier Giroud",position:"FW",club:"Chelsea"},{name:"Ousmane Dembélé",position:"FW",club:"Barcelona"},{name:"Florian Thauvin",position:"FW",club:"Marseille"},{name:"Nabil Fekir",position:"FW",club:"Lyon"},{name:"Thomas Lemar",position:"FW",club:"Monaco"}]};
const byTeam=new Map();
for(const p of worldCup2026.players){if(!byTeam.has(p.team))byTeam.set(p.team,[]);byTeam.get(p.team).push({name:p.name,position:p.position,club:p.club,number:p.number,teamCode:p.teamCode,rarity:null});}
const teams2026=[...byTeam.entries()].map(([name,players])=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-2026",name,year:2026,verified:true,players:players.sort((a,b)=>a.number-b.number)})).sort((a,b)=>a.name.localeCompare(b.name));
export const tournaments={2018:[demo2018],2026:teams2026};
export const datasetStatus={2026:{teams:teams2026.length,players:worldCup2026.players.length,verified:true},2018:{teams:1,players:23,verified:false}};
export const normalize=v=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function distance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
export function matches(guess,player){const a=normalize(guess);if(a.length<4)return false;return [player.name,...(player.aliases||[])].map(normalize).some(b=>a===b||(Math.min(a.length,b.length)>=6&&distance(a,b)<=1)||(Math.min(a.length,b.length)>=10&&distance(a,b)<=2));}
