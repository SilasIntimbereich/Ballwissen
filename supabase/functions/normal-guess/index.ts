import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function distance(a:string,b:string){const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return d[b.length];}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)return json({error:"Sign in required"},401);
 const {sessionId,guess}=await req.json();
 if(typeof sessionId!=="string"||typeof guess!=="string"||guess.trim().length<2||guess.length>80)return json({error:"Invalid guess"},400);
 const db=createClient(url,service);
 const {data:session}=await db.from("normal_game_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).is("finished_at",null).maybeSingle();
 if(!session)return json({error:"Game session not found or finished"},404);
 const {data:verifiedTeam}=await db.from("arcade_teams").select("id").eq("id",session.team_id).eq("verified",true).maybeSingle();
 if(!verifiedTeam)return json({error:"This squad is no longer verified"},409);
 const elapsed=(Date.now()-new Date(session.started_at).getTime())/1000;
 if(elapsed<0||elapsed>120)return json({error:"Time is up"},410);
 const {data:answer}=await db.from("arcade_team_answers").select("roster").eq("team_id",session.team_id).maybeSingle();
 const roster=(answer?.roster||[]) as Array<{id:string,name:string,position?:string,club?:string}>;
 const {data:alreadyGuessed}=await db.from("normal_game_session_guesses").select("player_id").eq("session_id",sessionId);
 const guessedIds=new Set((alreadyGuessed||[]).map(x=>x.player_id));
 const needle=norm(guess);
 const isNameMatch=(value:string)=>{const n=norm(value);return needle===n||(Math.min(needle.length,n.length)>=6&&distance(needle,n)<=1)||(Math.min(needle.length,n.length)>=10&&distance(needle,n)<=2);};
 const isMatch=(p:{name:string,aliases?:string[]})=>[p.name,...(p.aliases||[])].some(isNameMatch);
 const player=roster.find(p=>isMatch(p)&&!guessedIds.has(p.id));
 if(!player)return json({correct:false,duplicate:roster.some(isMatch)});
 const {data:record,error:recordError}=await db.rpc("record_normal_player_guess",{
  p_session_id:sessionId,p_user_id:user.id,p_player_id:player.id
 });
 if(recordError)return json({error:"Guess could not be recorded"},/timer expired/i.test(recordError.message)?410:409);
 const result=Array.isArray(record)?record[0]:record;
 if(!result?.is_correct)return json({correct:false,duplicate:!!result?.is_duplicate});
 return json({correct:true,player,score:result.score,total:result.total});
});
