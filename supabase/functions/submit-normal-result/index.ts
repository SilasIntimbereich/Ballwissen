import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return json({error:"Sign in required"},401);
 const {sessionId,giveUp=false}=await req.json();
 if(typeof sessionId!=="string"||typeof giveUp!=="boolean")return json({error:"Invalid result"},400);
 const db=createClient(url,service);
 const {data:completion,error:completionError}=await db.rpc("finish_normal_game_session",{p_session_id:sessionId,p_user_id:user.id,p_give_up:giveUp});
 if(completionError)return json({error:"Game result could not be submitted"},409);
 const result=Array.isArray(completion)?completion[0]:completion;
 if(!result)return json({error:"Game result unavailable"},503);
 const [{data:percentile,error:percentileError},{data:distribution,error:distributionError}]=await Promise.all([
  db.rpc("team_percentile",{p_team_id:result.team_id,p_score:result.score,p_total:result.total}),
  db.rpc("team_score_distribution",{p_team_id:result.team_id})
 ]);
 return json({
  score:result.score,total:result.total,missedPlayers:result.missed_players||[],
  outscoredPercent:percentileError?null:percentile,
  distribution:distributionError?[]:(distribution||[])
 });
});
