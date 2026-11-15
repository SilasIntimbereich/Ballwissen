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
 const {data:existing}=await admin.from("daily_attempts").select("id,score,total,completed_teams,finished_at").eq("user_id",user.id).eq("challenge_date",today).eq("mode",mode).maybeSingle();
 if(existing)return json({error:"Already played today",attempt:existing},409);
 const {data:challenges,error}=await admin.from("daily_challenges").select("sequence,team_id,arcade_teams(team_name,tournament_year)").eq("challenge_date",today).eq("mode",mode).order("sequence");
 if(error||!challenges||challenges.length!==3)return json({error:"Today's three-team challenge is not configured"},503);
 const {data:attempt,error:insertError}=await admin.from("daily_attempts").insert({user_id:user.id,challenge_date:today,mode,total:0}).select("id").single();
 if(insertError)return json({error:"Daily attempt could not be started"},insertError.code==="23505"?409:500);
 const teams=await Promise.all(challenges.map(async c=>{
  const {data:answer}=await admin.from("arcade_team_answers").select("roster").eq("team_id",c.team_id).maybeSingle();
  const roster=(answer?.roster||[]) as Array<{position?:string,club?:string}>;
  return {sequence:c.sequence,teamId:c.team_id,teamName:(c.arcade_teams as any).team_name,year:(c.arcade_teams as any).tournament_year,total:roster.length,hints:mode==="daily-legendary"?[]:roster.map(p=>({id:p.id||"",position:p.position||"",club:p.club||""}))};
 }));
 return json({attemptId:attempt.id,teams,mode,date:today,secondsPerTeam:120});
});