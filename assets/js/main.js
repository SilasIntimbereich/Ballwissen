import {loadWeeklyLeaderboard} from "./leaderboard.js";
import {tournaments,matches,datasetStatus} from "./data.js";
const $=selector=>document.querySelector(selector);
const config=window.FOOTBALL_ARCADE_CONFIG||{};
let supabase=null;
if(config.supabaseUrl&&config.supabaseAnonKey){try{const mod=await import("https://esm.sh/@supabase/supabase-js@2");supabase=mod.createClient(config.supabaseUrl,config.supabaseAnonKey);}catch(error){console.warn("Supabase client unavailable",error);}}
let mode="easy",team=null,found=new Set(),seconds=120,tick=null,ended=false,normalSessionId=null,normalHints=null,dailyState=null,practiceOnly=false;
async function ensureAuth(){if(!supabase)throw new Error("Supabase is not configured.");const current=await supabase.auth.getSession();if(!current.data.session){const auth=await supabase.auth.signInAnonymously();if(auth.error)throw auth.error;}}
function show(id){["home","select","game","online","stats","settings"].forEach(screen=>$("#"+screen)?.classList.toggle("active",screen===id));window.scrollTo(0,0);}
function renderTeams(){
 const year=Number($("#year").value),allTeams=tournaments[year]||[],teams=practiceOnly?allTeams.filter(item=>!item.verified&&item.players.length):allTeams,status=datasetStatus[year];
 $("#team-grid").innerHTML="";
 $("#select-note").textContent=practiceOnly?(teams.length?"Practice mode shows locally playable, unverified squads. These rounds are unranked.":"No local practice squads are available for this tournament yet."):(teams.length?(status.verified?"All squads independently audited.":status.auditPending?(year===2026?status.verifiedTeams+" of 48 teams independently audited; "+(48-status.verifiedTeams)+" remain pending.":status.verifiedTeams+" of "+teams.length+" historical teams independently audited; the rest are practice-only."):"Practice squads."):"Historical squads for this tournament are not yet imported. No invented teams are shown.");
 teams.forEach(selected=>{const button=document.createElement("button");button.className="team-button";const name=document.createElement("span");name.textContent=selected.name;const meta=document.createElement("small");meta.textContent=selected.total+" players · "+selected.teamDifficulty+" difficulty · "+(selected.verified?"online verified":"practice only");button.append(name,meta);button.onclick=()=>startGame(selected);$("#team-grid").append(button);});
}
function formatHint(position,club){return [position,club].filter(value=>typeof value==="string"&&value.trim()&&value.trim().toLowerCase()!=="null").join(" · ")||"HIDDEN PLAYER";}
function updateTimer(){$("#timer").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");}
function resetGameView(){found=new Set();seconds=120;ended=false;$("#result").classList.add("hidden");$("#result-stats").innerHTML="";$("#score").textContent="0";$("#guess").value="";$("#guess").disabled=false;$("#guess-btn").disabled=false;$("#give-up").disabled=false;$("#give-up").textContent="GIVE UP";$("#roster").innerHTML="";$("#feedback").textContent="Type a player name and press enter.";}
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
 }else{if(!team.players.length){$("#online-message").textContent="This practice roster is unavailable in the public build.";show("online");return;}renderNormalRoster();$("#feedback").textContent="Practice round. This unverified squad is not ranked.";}
 $("#guess").focus();startClock();
}
function startClock(){clearInterval(tick);tick=setInterval(()=>{seconds=Math.max(0,seconds-1);updateTimer();if(seconds<=0)finish(false);},1000);}
async function startDaily(modeName){
 if(!supabase){$("#online-message").textContent="Daily challenges need a connected Supabase project. Add the project URL and anon key in assets/js/config.js, then deploy the backend.";show("online");return;}
 try{await ensureAuth();const response=await supabase.functions.invoke("daily-challenge",{body:{mode:modeName}});if(response.error)throw response.error;const data=response.data;dailyState={attemptId:data.attemptId,mode:modeName,teams:data.teams,current:data.currentSequence||1,score:data.combinedScore||0,total:data.combinedTotal||0};mode=modeName;startDailyTeam(data.currentSequence||1,data.resumed?data:null);}
 catch(error){$("#online-message").textContent=error.message||"Today's challenge is unavailable. It may already have been played or not yet published.";show("online");}
}
function startDailyTeam(sequence,resume=null){
 $("#result").dataset.resultKind="daily";
 const dailyTeam=dailyState.teams.find(item=>item.sequence===sequence);if(!dailyTeam){finishDailyOverall();return;}
 dailyState.current=sequence;team={id:dailyTeam.teamId,name:dailyTeam.teamName,year:dailyTeam.year,total:dailyTeam.total,players:[],hints:dailyTeam.hints};normalSessionId=null;normalHints=null;resetGameView();
 $("#game-team").textContent=dailyTeam.teamName.toUpperCase();$("#game-tournament").textContent="DAILY TEAM "+sequence+" / 3";$("#game-mode").textContent=dailyState.mode.replace("daily-","DAILY ").toUpperCase();$("#game-heading").textContent="NAME THE SQUAD";renderDailyRoster(dailyTeam);
 if(resume){seconds=resume.remainingSeconds??120;(resume.foundPlayers||[]).forEach(player=>{found.add(player.id);const card=cardForPlayer(player.id);if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"FOUND":formatHint(player.position,player.club);}});$("#score").textContent=String(found.size);$("#feedback").textContent="Daily challenge resumed. Your remaining time is restored.";}
 show("game");updateTimer();if(resume&&seconds<=0){finishDailyTeam(false);return;}startClock();$("#guess").focus();
}
async function acceptDailyGuess(value){
 const response=await supabase.functions.invoke("daily-guess",{body:{attemptId:dailyState.attemptId,sequence:dailyState.current,guess:value}});if(response.error)throw response.error;const data=response.data;
 if(!data.correct){$("#feedback").textContent=data.duplicate?"Already found.":"Not in this squad. Try another name.";return;}
 const player=data.player;found.add(player.id);const card=cardForPlayer(player.id);
 if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"FOUND":formatHint(player.position,player.club);}
 $("#score").textContent=data.score;$("#feedback").textContent="Correct! "+player.name+" found.";if(data.score===data.total)await finishDailyTeam(true);
}
async function finishDailyTeam(giveUp){
 if(ended)return;ended=true;clearInterval(tick);$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 const response=await supabase.functions.invoke("submit-daily",{body:{attemptId:dailyState.attemptId,sequence:dailyState.current,giveUp}});
 if(response.error){ended=false;$("#give-up").disabled=false;$("#give-up").textContent="RETRY SUBMIT";$("#feedback").textContent="Could not submit this team. Tap RETRY SUBMIT to send the result again.";return;}
 const data=response.data;dailyState.score=data.combinedScore;dailyState.total=data.combinedTotal;
 (data.missedPlayers||[]).forEach(player=>{const card=[...document.querySelectorAll(".player-card")].find(item=>!item.classList.contains("found")&&!item.classList.contains("missed"));if(!card)return;card.classList.add("missed");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=dailyState.mode==="daily-legendary"?"NOT FOUND":formatHint(player.position,player.club);});
 $("#feedback").textContent="Team score: "+data.score+" / "+data.total;if(data.finished){finishDailyOverall();return;}$("#feedback").textContent+=" · Next team loading...";setTimeout(()=>startDailyTeam(data.nextSequence),900);
}
function finishDailyOverall(){$("#result").dataset.resultKind="daily";clearInterval(tick);$("#result-score").textContent=dailyState.score+" / "+dailyState.total;$("#result-message").textContent="Daily challenge complete. Combined score across all three teams.";$("#result-stats").innerHTML="";$("#result").classList.remove("hidden");$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;}
function renderStats(payload){
 const box=$("#result-stats");box.innerHTML="";
 if(payload&&typeof payload.outscoredPercent==="number"&&Number.isFinite(payload.outscoredPercent)){const percentile=document.createElement("div");percentile.className="stat-percentile";percentile.textContent="YOU OUTSCORED "+payload.outscoredPercent+"% OF PLAYERS";box.append(percentile);}
 for(const row of (payload&&payload.distribution)||[]){const wrap=document.createElement("div");wrap.className="stat-row";const label=document.createElement("span");label.textContent=row.score_bucket;const count=document.createElement("span");count.textContent=row.player_count+" players · "+row.percentage+"%";const track=document.createElement("div");track.className="stat-track";const fill=document.createElement("div");fill.className="stat-fill";fill.style.width=Math.max(0,Math.min(100,Number(row.percentage)||0))+"%";track.append(fill);wrap.append(label,count,track);box.append(wrap);}
}
async function finish(giveUp){
 if(dailyState){await finishDailyTeam(giveUp);return;}if(ended)return;ended=true;clearInterval(tick);$("#guess").disabled=true;$("#guess-btn").disabled=true;$("#give-up").disabled=true;
 if(normalSessionId){
  const response=await supabase.functions.invoke("submit-normal-result",{body:{sessionId:normalSessionId,giveUp}});
  if(response.error){ended=false;$("#give-up").disabled=false;$("#give-up").textContent="RETRY SUBMIT";$("#feedback").textContent="Could not submit the online result. Tap RETRY SUBMIT.";return;}
  const data=response.data;
  (data.missedPlayers||[]).forEach(player=>{const card=cardForPlayer(player.id);if(!card||card.classList.contains("found"))return;card.classList.add("missed");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"NOT FOUND";});
  $("#result-score").textContent=data.score+" / "+data.total;$("#result-message").textContent=giveUp?"You gave up. Every squad member is now revealed.":"Time is up. The full squad has been revealed.";renderStats(data);$("#result").classList.remove("hidden");return;
 }
 team.players.forEach((player,index)=>{if(found.has(index))return;const card=document.querySelector('.player-card[data-index="'+index+'"]');if(!card)return;card.classList.add("missed");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"NOT FOUND";});
 $("#result-score").textContent=found.size+" / "+team.players.length;$("#result-message").textContent=giveUp?"You gave up. Every squad member is now revealed.":"Time is up. The full squad has been revealed.";$("#result").classList.remove("hidden");
}
$("#guess-form").addEventListener("submit",async event=>{
 event.preventDefault();if(ended)return;const value=$("#guess").value.trim();if(!value)return;
 try{
  if(dailyState){await acceptDailyGuess(value);}
  else if(normalSessionId){
   const response=await supabase.functions.invoke("normal-guess",{body:{sessionId:normalSessionId,guess:value}});if(response.error)throw response.error;const data=response.data;
   if(!data.correct){$("#feedback").textContent=data.duplicate?"Already found.":"Not in this squad. Try another name.";return;}
   const player=data.player;found.add(player.id);const card=cardForPlayer(player.id);
   if(card){card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=mode==="easy"?formatHint(player.position,player.club):"FOUND";}
   $("#score").textContent=data.score;$("#feedback").textContent="Correct! "+player.name+" found.";if(data.score===data.total)await finish(true);
  }else{
   const index=team.players.findIndex((player,i)=>!found.has(i)&&matches(value,player));
   if(index<0){$("#feedback").textContent="Not in this squad. Try another name.";$("#guess").select();return;}
   found.add(index);const player=team.players[index],card=document.querySelector('.player-card[data-index="'+index+'"]');card.classList.add("found");setPlayerRarity(card,player.rarity);card.querySelector(".player-name").textContent=player.name;card.querySelector(".player-hint").textContent=formatHint(player.position,player.club);$("#score").textContent=found.size;$("#feedback").textContent="Correct! "+player.name+" found.";if(found.size===team.players.length)await finish(true);
  }
  $("#guess").value="";
 }catch(error){$("#feedback").textContent=error.message||"Could not check this guess.";}
});
$("#give-up").onclick=()=>finish(true);
$("#result-home").onclick=()=>{dailyState=null;normalSessionId=null;normalHints=null;show("home");};
document.querySelectorAll("[data-back]").forEach(button=>button.onclick=()=>{clearInterval(tick);dailyState=null;normalSessionId=null;normalHints=null;show("home");});
$("#year").onchange=renderTeams;
document.querySelectorAll("[data-mode]").forEach(button=>button.onclick=()=>{const selected=button.dataset.mode;if(selected.startsWith("daily")){startDaily(selected);return;}practiceOnly=selected==="practice";mode=selected==="hard"?"hard":"easy";show("select");renderTeams();});
const allTeams=Object.values(tournaments).flat(),verifiedTeams=allTeams.filter(item=>item.verified).length;
const dailyCounts={common:0,niche:0,legendary:0};
allTeams.filter(item=>item.verified).forEach(item=>{if(Object.hasOwn(dailyCounts,item.teamDifficulty))dailyCounts[item.teamDifficulty]++;});
for(const tier of ["common","niche","legendary"]){
 const button=document.querySelector('[data-mode="daily-'+tier+'"]');
 const ready=dailyCounts[tier]>=3;
 button.disabled=!ready;
 button.title=ready?"At least three verified squads are available.":"Daily mode locked until three squads in this tier are independently verified.";
}
const readyTiers=["common","niche","legendary"].filter(tier=>dailyCounts[tier]>=3);
$("#data-status").textContent="ROSTER AUDIT: "+verifiedTeams+"/"+allTeams.length+" VERIFIED · DAILY READY: "+(readyTiers.length?readyTiers.join(" + ").toUpperCase():"NONE")+" · LEGENDARY "+(dailyCounts.legendary>=3?"READY":"LOCKED");
renderTeams();loadWeeklyLeaderboard();
