import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return json({error:"Sign in required"},401);
 const {attemptId,sequence,giveUp=false}=await req.json();
 if(typeof attemptId!=="string"||![1,2,3].includes(sequence)||typeof giveUp!=="boolean")return json({error:"Invalid request"},400);
 const db=createClient(url,service);
 const {data:completion,error:completionError}=await db.rpc("complete_daily_team",{
  p_attempt_id:attemptId,p_user_id:user.id,p_sequence:sequence,p_give_up:giveUp
 });
 if(completionError)return json({error:"Daily team could not be completed"},409);
 const result=Array.isArray(completion)?completion[0]:completion;
 if(!result)return json({error:"Daily completion result unavailable"},503);
 return json({
  sequence,score:result.score,total:result.total,
  missedPlayers:result.missed_players||[],
  combinedScore:result.combined_score,combinedTotal:result.combined_total,
  finished:result.finished,nextSequence:result.next_sequence
 });
});
