import {createRound,submitGuess,revealRound} from "./gameplay.js";
import {tournaments,matches,dailyExclusions} from "./data.js";
const $=selector=>document.querySelector(selector);
let mode="easy",team=null,found=new Set(),roundState=null,submitting=false,seconds=120,tick=null,ended=false,dailyState=null,practiceOnly=false;
function show(id){["home","select","game","online","stats","settings"].forEach(screen=>$("#"+screen)?.classList.toggle("active",screen===id));window.scrollTo(0,0);}
function renderTeams(){
 const year=Number($("#year").value),allTeams=tournaments[year]||[],teams=allTeams.filter(item=>item.players.length);
 $("#team-grid").innerHTML="";
 $("#select-note").textContent=teams.length
  ?"All squads are playable locally and unranked. Historical club details are unavailable in the source data; some squads are still awaiting independent review."
   :"No local squads are available for this tournament yet.";
 teams.forEach(selected=>{
  const button=document.createElement("button");button.className="team-button";
  const name=document.createElement("span");name.textContent=selected.name;
  const meta=document.createElement("small");
  meta.textContent=selected.total+" players · "+selected.teamDifficulty+" · "+(selected.verified?"source checked":"practice data")+" · unranked";
  button.append(name,meta);
  button.onclick=()=>startGame(selected);
  $("#team-grid").append(button);
 });
}
function formatHint(position,club){return [position,club].filter(value=>typeof value==="string"&&value.trim()&&value.trim().toLowerCase()!=="null").join(" · ")||"HIDDEN PLAYER";}
function updateTimer(){$("#timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");}
function enableGuessControls(){const input=$("#guess"),button=$("#guess-btn");input.disabled=false;input.readOnly=false;input.removeAttribute("disabled");button.disabled=false;button.removeAttribute("disabled");}
function resetGameView(){found=new Set();roundState=null;submitting=false;seconds=120;ended=false;$("#result").classList.add("hidden");$("#result-stats").innerHTML="";$("#score").textContent="0";$("#guess").value="";enableGuessControls();$("#give-up").disabled=false;$("#give-up").textContent="GIVE UP";$("#roster").innerHTML="";$("#rarity-alert")?.classList.add("hidden");document.body.classList.remove("ball-knowledge-hit");$("#feedback").textContent="Type a player name and press enter.";}
function cardForPlayer(id){return [...document.querySelectorAll(".player-card[data-player-id]")].find(card=>card.dataset.playerId===id)||null;}
function setPlayerRarity(card,rarity,revealIndex=0){
 if(!card||!rarity)return;
 const className="rarity-"+rarity.toLowerCase().replaceAll(" ","-");
 card.classList.remove("rarity-common","rarity-rare","rarity-niche","rarity-legendary","rarity-ball-knowledge","rarity-reveal");
 card.classList.add(className,"rarity-reveal");
 card.style.setProperty("--reveal-delay",Math.min(900,Math.max(0,revealIndex)*48)+"ms");
 let label=card.querySelector(".player-rarity");
 if(!label){label=document.createElement("span");label.className="player-rarity";card.querySelector(".player-info").append(label);}
 label.textContent=rarity.toUpperCase();
 label.className="player-rarity "+className;
}
function announcePlayer(player,rarity){
 const alert=$("#rarity-alert");
 if(!alert||!player||!rarity)return;
 const className="rarity-"+rarity.toLowerCase().replaceAll(" ","-");
 alert.className="rarity-alert "+className;
 alert.replaceChildren();
 const icon=document.createElement("span");icon.className="rarity-alert-icon";
 icon.textContent=rarity==="Ball Knowledge"?"✦ ✦ ✦":"★";
 const copy=document.createElement("span");copy.className="rarity-alert-copy";
 const heading=document.createElement("strong");heading.textContent=rarity==="Ball Knowledge"?"EXCEPTIONAL PULL":"PLAYER FOUND";
 const name=document.createElement("b");name.textContent=player.name;
 const tier=document.createElement("small");tier.textContent=rarity.toUpperCase();
 copy.append(heading,name);alert.append(icon,copy,tier);
 void alert.offsetWidth;alert.classList.add("is-active");
 document.body.classList.remove("ball-knowledge-hit");
 if(rarity==="Ball Knowledge"){
  document.body.classList.add("ball-knowledge-hit");
  window.setTimeout(()=>document.body.classList.remove("ball-knowledge-hit"),1600);
 }
}
function addPlayerCard(index,hint,id,shirtNumber){const card=document.createElement("div");card.className="player-card";card.dataset.index=index;if(id)card.dataset.playerId=id;const number=document.createElement("span");number.className="player-number";number.textContent=String(Number.isInteger(Number(shirtNumber))&&Number(shirtNumber)>0?Number(shirtNumber):index+1).padStart(2,"0");const info=document.createElement("div");info.className="player-info";const name=document.createElement("div");name.className="player-name";name.textContent="???";const detail=document.createElement("div");detail.className="player-hint";detail.textContent=hint||"HIDDEN PLAYER";info.append(name,detail);card.append(number,info);$("#roster").append(card);return card;}
function renderNormalRoster(){team.players.forEach((player,index)=>addPlayerCard(index,mode==="easy"?formatHint(player.position,player.club):"HIDDEN PLAYER",null,player.number));$("#total").textContent=String(team.players.length);}
function renderDailyRoster(dailyTeam){dailyTeam.hints.forEach((hint,index)=>addPlayerCard(index,mode==="daily-legendary"?"HIDDEN PLAYER":formatHint(hint.position,hint.club),hint.id,hint.number));$("#total").textContent=String(dailyTeam.total);}
async function startGame(selected){
 dailyState=null;mode=mode==="hard"?"hard":"easy";team=selected;
 resetGameView();
 $("#game-team").textContent=team.name.toUpperCase();$("#game-tournament").textContent="WORLD CUP "+team.year;
 $("#game-mode").textContent=practiceOnly?"PRACTICE · NO TIMER":mode==="easy"?"NORMAL EASY":"NORMAL HARD";
 $("#game-heading").textContent="NAME THE SQUAD";show("game");clearInterval(tick);updateTimer();
 if(!Array.isArray(team.players)||!team.players.length){
  $("#online-message").textContent="This squad's local roster could not be loaded. Return to the menu and refresh the app.";
  show("online");return;
 }
 roundState=createRound(team.players);found=roundState.found;renderNormalRoster();
 $("#feedback").textContent="Local practice round · unranked.";
 enableGuessControls();$("#guess").focus();startClock();
}
function startClock(){clearInterval(tick);if(practiceOnly){$("#timer").textContent="∞";return;}tick=setInterval(()=>{seconds=Math.max(0,seconds-1);updateTimer();if(seconds<=0)finish(false);},1000);}
function dailyRandom(tier){
 const now=new Date();
 const key=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0"),tier].join("-");
 let seed=2166136261;
 for(const character of key)seed=Math.imul(seed^character.charCodeAt(0),16777619);
 return ()=>{
  seed+=0x6D2B79F5;
  let value=seed;
  value=Math.imul(value^value>>>15,value|1);
  value^=value+Math.imul(value^value>>>7,value|61);
  return ((value^value>>>14)>>>0)/4294967296;
 };
}
function startDaily(modeName){
 practiceOnly=false;
 const tier=modeName.replace("daily-","");
 const pool=Object.values(tournaments).flat().filter(item=>
  item.teamDifficulty===tier&&!dailyExclusions.has(item.id)&&Array.isArray(item.players)&&item.players.length
 );
 if(pool.length<3){
  $("#online-message").textContent="This Daily tier needs three eligible local squads. Check the roster data and refresh the app.";
  show("online");return;
 }
 const random=dailyRandom(tier);
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const teams=pool.slice(0,3).map((selected,index)=>({
  sequence:index+1,teamId:selected.id,teamName:selected.name,year:selected.year,total:selected.players.length,
  players:selected.players,
  hints:selected.players.map((player,playerIndex)=>({id:selected.id+":"+playerIndex,position:player.position,club:player.club,number:player.number}))
 }));
 dailyState={mode:modeName,teams,current:1,score:0,total:0,finalShown:false};
 mode=modeName;startDailyTeam(1);
}
function startDailyTeam(sequence){
 const dailyTeam=dailyState.teams.find(item=>item.sequence===sequence);
 if(!dailyTeam){finishDailyOverall();return;}
 dailyState.current=sequence;
 team={id:dailyTeam.teamId,name:dailyTeam.teamName,year:dailyTeam.year,total:dailyTeam.total,players:dailyTeam.players,hints:dailyTeam.hints};
 resetGameView();roundState=createRound(team.players);found=roundState.found;
 $("#game-team").textContent=dailyTeam.teamName.toUpperCase();
 const dailyLabel=dailyState.mode.replace("daily-","").toUpperCase();
 $("#game-tournament").textContent="WORLD CUP "+dailyTeam.year+" · DAILY "+dailyLabel+" · "+sequence+"/3";
 $("#game-mode").textContent="DAILY · "+dailyState.mode.replace("daily-","").toUpperCase();
 $("#game-heading").textContent="NAME THE SQUAD";renderDailyRoster(dailyTeam);
 $("#feedback").textContent="Local daily challenge · unranked.";
 show("game");enableGuessControls();updateTimer();startClock();$("#guess").focus();
}
async function acceptDailyGuess(value){
 const outcome=submitGuess(roundState,value,matches);
 if(outcome.status!=="correct"){
  $("#feedback").textContent=outcome.status==="duplicate"?"Already found.":"Not in this squad. Try another name.";
  $("#guess").select();return;
 }
 const index=outcome.index,player=outcome.player,card=cardForPlayer(team.id+":"+index);
 if(card){
  card.classList.add("found");setPlayerRarity(card,player.rarity,index);announcePlayer(player,player.rarity);
  card.querySelector(".player-name").textContent=player.name;
  card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"FOUND":formatHint(player.position,player.club);
 }
 $("#score").textContent=String(found.size);$("#feedback").textContent="Correct! "+player.name+" found.";
 if(outcome.complete)await finishDailyTeam(true);
}
async function finishDailyTeam(giveUp){
 if(ended)return;
 ended=true;clearInterval(tick);$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 const revealed=revealRound(roundState);
 revealed.missed.forEach(({player,index})=>{
  const card=cardForPlayer(team.id+":"+index);if(!card)return;
  card.classList.add("missed");setPlayerRarity(card,player.rarity,index);
  card.querySelector(".player-name").textContent=player.name;
  card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"NOT FOUND":formatHint(player.position,player.club);
 });
 dailyState.score+=revealed.score;dailyState.total+=revealed.total;
 $("#feedback").textContent="Daily team score: "+revealed.score+" / "+revealed.total+" · unranked";
 $("#result-score").textContent=revealed.score+" / "+revealed.total;
 $("#result-message").textContent="Daily team "+dailyState.current+" of 3 complete. Your missed players are shown above. This round is unranked.";
 $("#result-stats").innerHTML="<div class=\"stat-percentile\">TEAM ACCURACY · "+Math.round(revealed.score/revealed.total*100)+"%</div>";
 $("#result-home").textContent=dailyState.current>=3?"VIEW FINAL RESULTS":"NEXT TEAM";
 $("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"center"});
}
function recordLocalResult(score,total){
 if(!Number.isFinite(score)||!Number.isFinite(total)||total<=0)return;
 window.dispatchEvent(new CustomEvent("football-arcade:result",{detail:{score,total}}));
}
function finishDailyOverall(){
 if(!dailyState||dailyState.finalShown)return;
 dailyState.finalShown=true;
 $("#result-home").textContent="BACK TO MENU";
 $("#result-score").textContent=dailyState.score+" / "+dailyState.total;
 $("#result-message").textContent="Daily challenge complete. Three local squads played. Unranked.";
 $("#result-stats").innerHTML=dailyState.total?"<div class=\"stat-percentile\">OVERALL ACCURACY · "+Math.round(dailyState.score/dailyState.total*100)+"%</div>":"";
 $("#result").classList.remove("hidden");
 $("#result").scrollIntoView({behavior:"smooth",block:"center"});
 $("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 recordLocalResult(dailyState.score,dailyState.total);
}
async function finish(giveUp,completed=false){
 if(dailyState){await finishDailyTeam(giveUp);return;}
 if(ended)return;
 ended=true;clearInterval(tick);$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 const revealed=revealRound(roundState);
 revealed.missed.forEach(({player,index})=>{
  const card=document.querySelector('.player-card[data-index="'+index+'"]');if(!card)return;
  card.classList.add("missed");setPlayerRarity(card,player.rarity,index);
  card.querySelector(".player-name").textContent=player.name;
  card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"NOT FOUND";
 });
 $("#result-score").textContent=revealed.score+" / "+revealed.total;
 $("#result-stats").innerHTML="<div class=\"stat-percentile\">ACCURACY · "+Math.round(revealed.score/revealed.total*100)+"%</div>";
 $("#result-message").textContent=completed?"Perfect run! You found every player.":giveUp?"You gave up. Every squad member is now revealed.":"Time is up. The full squad has been revealed.";
 $("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"center"});
 recordLocalResult(revealed.score,revealed.total);
}
$("#guess-form").addEventListener("submit",async event=>{
 event.preventDefault();if(ended||submitting)return;
 const value=$("#guess").value.trim();if(!value)return;
 submitting=true;$("#guess-btn").disabled=true;
 try{
  if(dailyState)await acceptDailyGuess(value);
  else{
   const outcome=submitGuess(roundState,value,matches);
   if(outcome.status!=="correct"){
    $("#feedback").textContent=outcome.status==="duplicate"?"Already found.":"Not in this squad. Try another name.";
    $("#guess").select();return;
   }
   const index=outcome.index,player=outcome.player;
   const card=document.querySelector('.player-card[data-index="'+index+'"]');
   if(card){
    card.classList.add("found");setPlayerRarity(card,player.rarity,index);announcePlayer(player,player.rarity);
    card.querySelector(".player-name").textContent=player.name;
    card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"FOUND";
   }
   $("#score").textContent=outcome.score;$("#feedback").textContent="Correct! "+player.name+" found.";
   if(outcome.complete)await finish(false,true);
  }
  $("#guess").value="";
 }catch(error){$("#feedback").textContent=error.message||"Could not check this guess.";}
 finally{submitting=false;if(!ended){$("#guess-btn").disabled=false;$("#guess").focus();}}
});
$("#give-up").onclick=()=>finish(true).catch(error=>{$("#feedback").textContent=error.message||"Could not finish this round.";$("#give-up").disabled=false;});
$("#result-home").onclick=()=>{if(dailyState){if(dailyState.current<3){startDailyTeam(dailyState.current+1);return;}if(!dailyState.finalShown){finishDailyOverall();return;}}dailyState=null;clearInterval(tick);show("home");};
document.querySelectorAll("[data-back]").forEach(button=>button.onclick=()=>{clearInterval(tick);dailyState=null;show("home");});
$("#year").onchange=renderTeams;
document.querySelectorAll("[data-mode]").forEach(button=>button.onclick=()=>{const selected=button.dataset.mode;if(selected.startsWith("daily")){startDaily(selected);return;}practiceOnly=selected==="practice";mode=selected==="hard"?"hard":"easy";show("select");renderTeams();});
const allTeams=Object.values(tournaments).flat();
const dailyCounts={common:0,niche:0,legendary:0};
allTeams.filter(item=>!dailyExclusions.has(item.id)&&item.players.length).forEach(item=>{
 if(Object.hasOwn(dailyCounts,item.teamDifficulty))dailyCounts[item.teamDifficulty]++;
});
for(const tier of ["common","niche","legendary"]){
 const button=document.querySelector('[data-mode="daily-'+tier+'"]');
 const ready=dailyCounts[tier]>=3;
 button.disabled=!ready;
 button.title=ready?"Local unranked challenge with three squads from this tier.":"Daily mode needs at least three eligible local squads.";
 button.querySelector("small").textContent=ready?"3 teams · unranked":"Not enough eligible teams";
}
$("#data-status").textContent="LOCAL SQUADS: "+allTeams.filter(item=>item.players.length).length+" · LOCAL UNRANKED PLAY";
renderTeams();
