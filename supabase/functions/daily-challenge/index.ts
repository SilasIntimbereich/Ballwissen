import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
 const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json({error:"Sign in required"},401);
 const {mode}=await req.json();if(!["daily-common","daily-niche","daily-legendary"].includes(mode))return json({error:"Invalid daily mode"},400);
 const admin=createClient(url,service),today=new Date().toISOString().slice(0,10);
 const {data:excludedRows,error:exclusionError}=await admin.from("daily_excluded_squads").select("team_id");
 if(exclusionError||!excludedRows)return json({error:"Daily exclusion rules are unavailable"},503);
 const excludedIds=new Set(excludedRows.map(row=>row.team_id));
 const {data:existing}=await admin.from("daily_attempts").select("id,score,total,completed_teams,finished_at,current_team_started_at").eq("user_id",user.id).eq("challenge_date",today).eq("mode",mode).maybeSingle();
 if(existing?.finished_at)return json({error:"Already played today",attempt:existing},409);
 let resumeAttempt=existing;
 const {data:challenges,error}=await admin.from("daily_challenges").select("sequence,team_id,arcade_teams(team_name,tournament_year,verified)").eq("challenge_date",today).eq("mode",mode).order("sequence");
 if(error||!challenges||challenges.length!==3)return json({error:"Today's three-team challenge is not configured"},503);
 if(challenges.some(c=>excludedIds.has(c.team_id)))return json({error:"Daily schedule contains a prohibited squad"},503);
 if(challenges.some(c=>!(c.arcade_teams as any)?.verified))return json({error:"Daily schedule contains an unverified squad"},503);
 let attemptId=existing?.id;
 if(!attemptId){
  const {data:attempt,error:insertError}=await admin.from("daily_attempts").insert({user_id:user.id,challenge_date:today,mode,total:0}).select("id").single();
  if(insertError?.code==="23505"){
   const {data:concurrent}=await admin.from("daily_attempts").select("id,score,total,completed_teams,finished_at,current_team_started_at").eq("user_id",user.id).eq("challenge_date",today).eq("mode",mode).maybeSingle();
   if(!concurrent||concurrent.finished_at)return json({error:"Already played today",attempt:concurrent},409);
   resumeAttempt=concurrent;attemptId=concurrent.id;
  }else if(insertError)return json({error:"Daily attempt could not be started"},500);
  else attemptId=attempt.id;
 }
 const loadedTeams=await Promise.all(challenges.map(async c=>{
  const {data:answer,error:answerError}=await admin.from("arcade_team_answers").select("roster").eq("team_id",c.team_id).maybeSingle();
  const roster=(answer?.roster||[]) as Array<{id?:string,position?:string,club?:string}>;
  return {challenge:c,roster,valid:!answerError&&Array.isArray(roster)&&roster.length>0};
 }));
 if(loadedTeams.some(t=>!t.valid))return json({error:"One or more Daily answer rosters are unavailable"},503);
 const teams=loadedTeams.map(({challenge:c,roster})=>({
  sequence:c.sequence,teamId:c.team_id,teamName:(c.arcade_teams as any).team_name,
  year:(c.arcade_teams as any).tournament_year,total:roster.length,
  hints:roster.map(p=>mode==="daily-legendary"?({id:p.id||""}):({id:p.id||"",position:p.position||"",club:p.club||""}))
 }));
 const currentSequence=(resumeAttempt?.completed_teams||0)+1;
 let foundPlayers:Array<{id:string,name:string,position?:string,club?:string}>=[];
 let remainingSeconds=120;
 if(resumeAttempt){
  const current=teams.find(t=>t.sequence===currentSequence);
  if(current){
   const elapsed=(Date.now()-new Date(resumeAttempt.current_team_started_at).getTime())/1000;
   remainingSeconds=Math.max(0,Math.floor(120-elapsed));
   const {data:teamAttempt}=await admin.from("daily_attempt_teams").select("found_player_ids").eq("attempt_id",attemptId).eq("sequence",currentSequence).maybeSingle();
   const ids=(teamAttempt?.found_player_ids||[]) as string[];
   if(ids.length){
    const {data:answer}=await admin.from("arcade_team_answers").select("roster").eq("team_id",current.teamId).maybeSingle();
    foundPlayers=((answer?.roster||[]) as Array<{id?:string,name:string,position?:string,club?:string}>)
     .filter(p=>ids.includes(p.id||""))
     .map(p=>({id:p.id||"",name:p.name,position:mode==="daily-legendary"?"":(p.position||""),club:mode==="daily-legendary"?"":(p.club||"")}));
   }
  }
 }
 return json({attemptId,teams,mode,date:today,secondsPerTeam:120,resumed:!!resumeAttempt,currentSequence,remainingSeconds,foundPlayers,combinedScore:resumeAttempt?.score||0,combinedTotal:resumeAttempt?.total||0});
});