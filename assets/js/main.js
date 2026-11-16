import {loadWeeklyLeaderboard} from "./leaderboard.js";
import {createRound,submitGuess,revealRound} from "./gameplay.js";
import {tournaments,matches,datasetStatus,dailyExclusions} from "./data.js";
const $=selector=>document.querySelector(selector);
const config=window.FOOTBALL_ARCADE_CONFIG||{};
let supabase=null;
if(config.supabaseUrl&&config.supabaseAnonKey){try{const mod=await import("https://esm.sh/@supabase/supabase-js@2");supabase=mod.createClient(config.supabaseUrl,config.supabaseAnonKey);}catch(error){console.warn("Supabase client unavailable",error);}}
let mode="easy",team=null,found=new Set(),roundState=null,submitting=false,seconds=120,tick=null,ended=false,normalSessionId=null,normalHints=null,dailyState=null,practiceOnly=false;
async function ensureAuth(){if(!supabase)throw new Error("Supabase is not configured.");const current=await supabase.auth.getSession();if(!current.data.session){const auth=await supabase.auth.signInAnonymously();if(auth.error)throw auth.error;}}
function show(id){["home","select","game","online","stats","settings"].forEach(screen=>$("#"+screen)?.classList.toggle("active",screen===id));window.scrollTo(0,0);}
function renderTeams(){
 const year=Number($("#year").value),allTeams=tournaments[year]||[],teams=practiceOnly?allTeams.filter(item=>!item.verified&&item.players.length):allTeams,status=datasetStatus[year];
 $("#team-grid").innerHTML="";
 $("#select-note").textContent=practiceOnly?(teams.length?"Practice mode shows locally playable, unverified squads. These rounds are unranked.":"No local practice squads are available for this tournament yet."):(teams.length?(status.verified?"All squads independently audited.":status.auditPending?(year===2026?status.verifiedTeams+" of 48 teams independently audited; "+(48-status.verifiedTeams)+" remain pending.":status.verifiedTeams+" of "+teams.length+" historical teams independently audited; the rest are practice-only."):"Practice squads."):"Historical squads for this tournament are not yet imported. No invented teams are shown.");
 teams.forEach(selected=>{
  const button=document.createElement("button");button.className="team-button";
  const name=document.createElement("span");name.textContent=selected.name;
  const meta=document.createElement("small");
  const onlineLocked=selected.verified&&!supabase;
  meta.textContent=onlineLocked
   ?"Verified roster · online backend not connected"
   :selected.total+" players · "+selected.teamDifficulty+" difficulty · "+(selected.verified?"online verified":"practice only");
  button.append(name,meta);
  if(onlineLocked){button.disabled=true;button.title="This verified squad needs the secure online backend. Choose Practice Mode for playable local squads.";}
  else button.onclick=()=>startGame(selected);
  $("#team-grid").append(button);
 });
}
function formatHint(position,club){return [position,club].filter(value=>typeof value==="string"&&value.trim()&&value.trim().toLowerCase()!=="null").join(" · ")||"HIDDEN PLAYER";}
function updateTimer(){$("#timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");}
function enableGuessControls(){const input=$("#guess"),button=$("#guess-btn");input.disabled=false;input.readOnly=false;input.removeAttribute("disabled");button.disabled=false;button.removeAttribute("disabled");}
function resetGameView(){found=new Set();roundState=null;submitting=false;seconds=120;ended=false;$("#result").classList.add("hidden");$("#result-stats").innerHTML="";$("#score").textContent="0";$("#guess").value="";enableGuessControls();$("#give-up").disabled=false;$("#give-up").textContent="GIVE UP";$("#roster").innerHTML="";$("#feedback").textContent="Type a player name and press enter.";}
function cardForPlayer(id){return [...document.querySelectorAll(".player-card[data-player-id]")].find(card=>card.dataset.playerId===id)||null;}
function setPlayerRarity(card,rarity){
 if(!card||!rarity)return;
 const className="rarity-"+rarity.toLowerCase().replaceAll(" ","-");
 card.classList.add(className);
 let label=card.querySelector(".player-rarity");
 if(!label){label=document.createElement("span");label.className="player-rarity";card.querySelector(".player-info").append(label);}
 label.textContent=rarity.toUpperCase();
 label.className="player-rarity "+className;
}
function addPlayerCard(index,hint,id){const card=document.createElement("div");card.className="player-card";card.dataset.index=index;if(id)card.dataset.playerId=id;const number=document.createElement("span");number.className="player-number";number.textContent=String(index+1).padStart(2,"0");const info=document.createElement("div");info.className="player-info";const name=document.createElement("div");name.className="player-name";name.textContent="???";const detail=document.createElement("div");detail.className="player-hint";detail.textContent=hint||"HIDDEN PLAYER";info.append(name,detail);card.append(number,info);$("#roster").append(card);return card;}
function renderNormalRoster(){if(normalSessionId&&Array.isArray(normalHints)){normalHints.forEach((hint,index)=>addPlayerCard(index,mode==="easy"?formatHint(hint.position,hint.club):"HIDDEN PLAYER",hint.id));$("#total").textContent=String(team.total);return;}team.players.forEach((player,index)=>addPlayerCard(index,mode==="easy"?formatHint(player.position,player.club):"HIDDEN PLAYER"));$("#total").textContent=String(team.players.length);}
function renderDailyRoster(dailyTeam){dailyTeam.hints.forEach((hint,index)=>addPlayerCard(index,mode==="daily-legendary"?"HIDDEN PLAYER":formatHint(hint.position,hint.club),hint.id));$("#total").textContent=String(dailyTeam.total);}
async function startGame(selected){
 dailyState=null;normalSessionId=null;normalHints=null;mode=mode==="hard"?"hard":"easy";team=selected;$("#result").dataset.resultKind=team.verified?"online":"practice";resetGameView();
 $("#game-team").textContent=team.name.toUpperCase();$("#game-tournament").textContent="WORLD CUP "+team.year;$("#game-mode").textContent=mode==="easy"?"NORMAL EASY":"NORMAL HARD";$("#game-heading").textContent="NAME THE SQUAD";show("game");clearInterval(tick);updateTimer();
 if(team.verified){
  if(!supabase){$("#online-message").textContent="This verified squad is protected for online play. Connect Supabase to start it; its answer list is not shipped to the browser.";show("online");return;}
  $("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;$("#feedback").textContent="Starting secure online session...";
  try{await ensureAuth();const response=await supabase.functions.invoke("start-normal-game",{body:{teamId:team.id}});if(response.error)throw response.error;normalSessionId=response.data.sessionId;normalHints=response.data.hints||[];team.total=response.data.total;if(!normalSessionId||normalHints.length!==team.total)throw new Error("Secure roster hints are incomplete.");resetGameView();renderNormalRoster();$("#feedback").textContent="Online session active. Correct guesses are checked by the server.";}
  catch(error){$("#online-message").textContent=error.message||"Secure online session unavailable. Try again after the backend is deployed.";show("online");return;}
 }else{if(!team.players.length){$("#online-message").textContent="This practice roster is unavailable in the public build.";show("online");return;}roundState=createRound(team.players);found=roundState.found;renderNormalRoster();$("#feedback").textContent="Practice round. This unverified squad is not ranked."; }
 enableGuessControls();$("#guess").focus();startClock();
}
function startClock(){clearInterval(tick);tick=setInterval(()=>{seconds=Math.max(0,seconds-1);updateTimer();if(seconds<=0)finish(false);},1000);}
async function startDaily(modeName){
 if(!supabase){
  const tier=modeName.replace("daily-","");
  const allDemoTeams=Object.values(tournaments).flat().filter(item=>!item.verified&&!dailyExclusions.has(item.id)&&item.players.length);
  let pool=allDemoTeams.filter(item=>item.teamDifficulty===tier),demoFallback=pool.length<3;
  if(demoFallback)pool=allDemoTeams;
  if(pool.length<3){$("#online-message").textContent="Not enough eligible local practice squads are available for this Daily demo.";show("online");return;}
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const teams=pool.slice(0,3).map((selected,index)=>({
   sequence:index+1,teamId:selected.id,teamName:selected.name,year:selected.year,total:selected.players.length,
   players:selected.players,
   hints:selected.players.map((player,playerIndex)=>({id:selected.id+":"+playerIndex,position:player.position,club:player.club}))
  }));
  dailyState={demo:true,demoFallback,attemptId:null,mode:modeName,teams,current:1,score:0,total:0};
  mode=modeName;startDailyTeam(1);return;
 }
 try{await ensureAuth();const response=await supabase.functions.invoke("daily-challenge",{body:{mode:modeName}});if(response.error)throw response.error;const data=response.data;dailyState={attemptId:data.attemptId,mode:modeName,teams:data.teams,current:data.currentSequence||1,score:data.combinedScore||0,total:data.combinedTotal||0};mode=modeName;startDailyTeam(data.currentSequence||1,data.resumed?data:null);}
 catch(error){$("#online-message").textContent=error.message||"Today's challenge is unavailable. It may already have been played or not yet published.";show("online");}
}
function startDailyTeam(sequence,resume=null){
 $("#result").dataset.resultKind="daily";
 const dailyTeam=dailyState.teams.find(item=>item.sequence===sequence);if(!dailyTeam){finishDailyOverall();return;}
 dailyState.current=sequence;team={id:dailyTeam.teamId,name:dailyTeam.teamName,year:dailyTeam.year,total:dailyTeam.total,players:dailyTeam.players||[],hints:dailyTeam.hints};normalSessionId=null;normalHints=null;resetGameView();if(dailyState.demo){roundState=createRound(team.players);found=roundState.found;}
 $("#game-team").textContent=dailyTeam.teamName.toUpperCase();$("#game-tournament").textContent="DAILY TEAM "+sequence+" / 3";$("#game-mode").textContent=(dailyState.demo?"DAILY DEMO · ":"DAILY ")+dailyState.mode.replace("daily-","").toUpperCase()+(dailyState.demoFallback?" · MIXED TEST POOL":"");$("#game-heading").textContent="NAME THE SQUAD";renderDailyRoster(dailyTeam);
 if(resume){seconds=resume.remainingSeconds??120;(resume.foundPlayers||[]).forEach(player=>{found.add(player.id);const card=cardForPlayer(player.id);if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"FOUND":formatHint(player.position,player.club);}});$("#score").textContent=String(found.size);$("#feedback").textContent="Daily challenge resumed. Your remaining time is restored.";}
 show("game");enableGuessControls();updateTimer();if(resume&&seconds<=0){finishDailyTeam(false);return;}startClock();$("#guess").focus();
}
async function acceptDailyGuess(value){
 if(dailyState.demo){
  const outcome=submitGuess(roundState,value,matches);
  if(outcome.status!=="correct"){$("#feedback").textContent=outcome.status==="duplicate"?"Already found.":"Not in this squad. Try another name.";$("#guess").select();return;}
  const index=outcome.index,player=outcome.player,card=cardForPlayer(team.id+":"+index);
  if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"FOUND":formatHint(player.position,player.club);}
  $("#score").textContent=String(found.size);$("#feedback").textContent="Correct! "+player.name+" found.";
  if(outcome.complete)await finishDailyTeam(true);
  return;
 }
 const response=await supabase.functions.invoke("daily-guess",{body:{attemptId:dailyState.attemptId,sequence:dailyState.current,guess:value}});if(response.error)throw response.error;const data=response.data;
 if(!data.correct){$("#feedback").textContent=data.duplicate?"Already found.":"Not in this squad. Try another name.";return;}
 const player=data.player;found.add(player.id);const card=cardForPlayer(player.id);
 if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"FOUND":formatHint(player.position,player.club);}
 $("#score").textContent=data.score;$("#feedback").textContent="Correct! "+player.name+" found.";if(data.score===data.total)await finishDailyTeam(true);
}
async function finishDailyTeam(giveUp){
 if(ended)return;ended=true;clearInterval(tick);$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 if(dailyState.demo){
  const revealed=revealRound(roundState);
  revealed.missed.forEach(({player,index})=>{
   const card=cardForPlayer(team.id+":"+index);if(!card)return;
   card.classList.add("missed");setPlayerRarity(card,player.rarity);
   card.querySelector(".player-name").textContent=player.name;
   card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"NOT FOUND":formatHint(player.position,player.club);
  });
  dailyState.score+=found.size;dailyState.total+=team.players.length;
  $("#feedback").textContent="Demo team score: "+found.size+" / "+team.players.length+" · unranked";
  $("#result-score").textContent=found.size+" / "+team.players.length;
  $("#result-message").textContent="Daily demo team "+dailyState.current+" of 3 complete. Your missed players are shown above. This round is unranked.";
  $("#result-stats").innerHTML="";
  $("#result-home").textContent=dailyState.current>=3?"VIEW FINAL RESULTS":"NEXT TEAM";
  $("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"center"});
  return;
 }
 let response;
 try{response=await supabase.functions.invoke("submit-daily",{body:{attemptId:dailyState.attemptId,sequence:dailyState.current,giveUp}});}
 catch(error){ended=false;$("#give-up").disabled=false;$("#give-up").textContent="RETRY SUBMIT";$("#feedback").textContent=error.message||"Connection lost while submitting. Tap RETRY SUBMIT.";return;}
 if(response.error){ended=false;$("#give-up").disabled=false;$("#give-up").textContent="RETRY SUBMIT";$("#feedback").textContent=response.error.message||"Could not submit this team. Tap RETRY SUBMIT to send the result again.";return;}
 const data=response.data;dailyState.score=data.combinedScore;dailyState.total=data.combinedTotal;
 (data.missedPlayers||[]).forEach(player=>{
  const card=cardForPlayer(player.id)||[...document.querySelectorAll(".player-card")].find(item=>!item.classList.contains("found")&&!item.classList.contains("missed"));
  if(!card)return;
  card.classList.add("missed");setPlayerRarity(card,player.rarity);
  card.querySelector(".player-name").textContent=player.name;
  card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"NOT FOUND":formatHint(player.position,player.club);
 });
 $("#feedback").textContent="Team score: "+data.score+" / "+data.total;if(data.finished){finishDailyOverall();return;}$("#feedback").textContent+=" · Next team loading...";setTimeout(()=>startDailyTeam(data.nextSequence),900);
}
function finishDailyOverall(){if(dailyState?.demo)dailyState.finalShown=true;$("#result").dataset.resultKind=dailyState.demo?"practice":"daily";clearInterval(tick);$("#result-home").textContent="BACK TO MENU";$("#result-score").textContent=dailyState.score+" / "+dailyState.total;$("#result-message").textContent=dailyState.demo?"Daily demo complete. Three local practice squads played. Unranked test mode.":"Daily challenge complete. Combined score across all three teams." ;$("#result-stats").innerHTML="";$("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"center"});$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;}
function renderStats(payload){
 const box=$("#result-stats");box.innerHTML="";
 if(payload&&typeof payload.outscoredPercent==="number"&&Number.isFinite(payload.outscoredPercent)){const percentile=document.createElement("div");percentile.className="stat-percentile";percentile.textContent="YOU OUTSCORED "+payload.outscoredPercent+"% OF PLAYERS";box.append(percentile);}
 for(const row of (payload&&payload.distribution)||[]){const wrap=document.createElement("div");wrap.className="stat-row";const label=document.createElement("span");label.textContent=row.score_bucket;const count=document.createElement("span");count.textContent=row.player_count+" players · "+row.percentage+"%";const track=document.createElement("div");track.className="stat-track";const fill=document.createElement("div");fill.className="stat-fill";fill.style.width=Math.max(0,Math.min(100,Number(row.percentage)||0))+"%";track.append(fill);wrap.append(label,count,track);box.append(wrap);}
}
async function finish(giveUp,completed=false){
 if(dailyState){await finishDailyTeam(giveUp);return;}if(ended)return;ended=true;clearInterval(tick);$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 if(normalSessionId){
  let response;
  try{response=await supabase.functions.invoke("submit-normal-result",{body:{sessionId:normalSessionId,giveUp:giveUp||completed}});}
  catch(error){ended=false;$("#give-up").disabled=false;$("#give-up").textContent="RETRY SUBMIT";$("#feedback").textContent=error.message||"Connection lost while submitting. Tap RETRY SUBMIT.";return;}
  if(response.error){ended=false;$("#give-up").disabled=false;$("#give-up").textContent="RETRY SUBMIT";$("#feedback").textContent=response.error.message||"Could not submit the online result. Tap RETRY SUBMIT.";return;}
  const data=response.data;
  (data.missedPlayers||[]).forEach(player=>{const card=cardForPlayer(player.id);if(!card||card.classList.contains("found"))return;card.classList.add("missed");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"NOT FOUND";});
  $("#result-score").textContent=data.score+" / "+data.total;$("#result-message").textContent=completed?"Perfect run! You found every player.":giveUp?"You gave up. Every squad member is now revealed.":"Time is up. The full squad has been revealed.";renderStats(data);$("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"center"});return;
 }
 const revealed=revealRound(roundState);
 revealed.missed.forEach(({player,index})=>{const card=document.querySelector('.player-card[data-index="'+index+'"]');if(!card)return;card.classList.add("missed");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"NOT FOUND";});
 $("#result-score").textContent=found.size+" / "+team.players.length;$("#result-message").textContent=completed?"Perfect run! You found every player.":giveUp?"You gave up. Every squad member is now revealed.":"Time is up. The full squad has been revealed.";$("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"center"});
}
$("#guess-form").addEventListener("submit",async event=>{
 event.preventDefault();if(ended||submitting)return;const value=$("#guess").value.trim();if(!value)return;submitting=true;$("#guess-btn").disabled=true;
 try{
  if(dailyState){await acceptDailyGuess(value);}
  else if(normalSessionId){
   const response=await supabase.functions.invoke("normal-guess",{body:{sessionId:normalSessionId,guess:value}});if(response.error)throw response.error;const data=response.data;
   if(!data.correct){$("#feedback").textContent=data.duplicate?"Already found.":"Not in this squad. Try another name.";return;}
   const player=data.player;found.add(player.id);const card=cardForPlayer(player.id);
   if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"FOUND";}
   $("#score").textContent=data.score;$("#feedback").textContent="Correct! "+player.name+" found.";if(data.score===data.total)await finish(false,true);
  }else{
   const outcome=submitGuess(roundState,value,matches);
   if(outcome.status!=="correct"){$("#feedback").textContent=outcome.status==="duplicate"?"Already found.":"Not in this squad. Try another name.";$("#guess").select();return;}
   const index=outcome.index,player=outcome.player,card=document.querySelector('.player-card[data-index="'+index+'"]');card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"FOUND";$("#score").textContent=outcome.score;$("#feedback").textContent="Correct! "+player.name+" found.";if(outcome.complete)await finish(false,true);
  }
  $("#guess").value="";
 }catch(error){$("#feedback").textContent=error.message||"Could not check this guess.";}finally{submitting=false;if(!ended){$("#guess-btn").disabled=false;$("#guess").focus();}}
});
$("#give-up").onclick=()=>finish(true).catch(error=>{$("#feedback").textContent=error.message||"Could not finish this round.";$("#give-up").disabled=false;});
$("#result-home").onclick=()=>{if(dailyState?.demo){if(dailyState.current<3){startDailyTeam(dailyState.current+1);return;}if(!dailyState.finalShown){finishDailyOverall();return;}}dailyState=null;normalSessionId=null;normalHints=null;clearInterval(tick);show("home");};
document.querySelectorAll("[data-back]").forEach(button=>button.onclick=()=>{clearInterval(tick);dailyState=null;normalSessionId=null;normalHints=null;show("home");});
$("#year").onchange=renderTeams;
document.querySelectorAll("[data-mode]").forEach(button=>button.onclick=()=>{const selected=button.dataset.mode;if(selected.startsWith("daily")){startDaily(selected);return;}practiceOnly=selected==="practice";mode=selected==="hard"?"hard":"easy";show("select");renderTeams();});
const allTeams=Object.values(tournaments).flat(),verifiedTeams=allTeams.filter(item=>item.verified).length;
const dailyCounts={common:0,niche:0,legendary:0},demoCounts={common:0,niche:0,legendary:0};
allTeams.filter(item=>item.verified&&!dailyExclusions.has(item.id)).forEach(item=>{if(Object.hasOwn(dailyCounts,item.teamDifficulty))dailyCounts[item.teamDifficulty]++;});
allTeams.filter(item=>!item.verified&&!dailyExclusions.has(item.id)&&item.players.length).forEach(item=>{if(Object.hasOwn(demoCounts,item.teamDifficulty))demoCounts[item.teamDifficulty]++;});
for(const tier of ["common","niche","legendary"]){
 const button=document.querySelector('[data-mode="daily-'+tier+'"]');
 const ready=supabase?dailyCounts[tier]>=3:(demoCounts[tier]>=3||Object.values(demoCounts).reduce((sum,count)=>sum+count,0)>=3);
 button.disabled=!ready;
 button.title=supabase?(ready?"At least three verified, non-excluded squads are available.":"Daily mode locked until three eligible squads in this tier are independently verified."):(ready?(demoCounts[tier]>=3?"Local unranked demo with three squads from this tier.":"Local unranked demo using a mixed test pool because this tier has too few practice squads."):"Daily demo needs at least three eligible practice squads.");
 if(!supabase&&ready)button.querySelector("small").textContent=demoCounts[tier]>=3?"3-team local demo · unranked":"3-team mixed test pool · unranked";
}
const readyTiers=["common","niche","legendary"].filter(tier=>dailyCounts[tier]>=3);
$("#data-status").textContent="ROSTER AUDIT: "+verifiedTeams+"/"+allTeams.length+" VERIFIED · "+(supabase?"ONLINE DAILY: "+(readyTiers.length?readyTiers.join(" + ").toUpperCase():"NONE"):"LOCAL DAILY DEMO: "+Object.keys(demoCounts).filter(tier=>demoCounts[tier]>=3).join(" + ").toUpperCase());
renderTeams();loadWeeklyLeaderboard();
