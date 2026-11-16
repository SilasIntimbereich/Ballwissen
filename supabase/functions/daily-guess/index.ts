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
 const {attemptId,sequence,guess}=await req.json();
 if(typeof attemptId!=="string"||![1,2,3].includes(sequence)||typeof guess!=="string"||guess.trim().length<2||guess.length>80)return json({error:"Invalid guess"},400);
 const db=createClient(url,service);
 const {data:attempt}=await db.from("daily_attempts").select("*").eq("id",attemptId).eq("user_id",user.id).is("finished_at",null).maybeSingle();
 if(!attempt)return json({error:"Attempt not found or finished"},404);
 if(sequence!==attempt.completed_teams+1)return json({error:"Teams must be played in order"},409);
 const elapsed=(Date.now()-new Date(attempt.current_team_started_at).getTime())/1000;
 if(elapsed<0||elapsed>120)return json({error:"Time is up for this team"},410);
 const {data:challenge}=await db.from("daily_challenges").select("team_id").eq("challenge_date",attempt.challenge_date).eq("mode",attempt.mode).eq("sequence",sequence).maybeSingle();
 if(!challenge)return json({error:"Challenge team unavailable"},404);
 const {data:excluded}=await db.from("daily_excluded_squads").select("team_id").eq("team_id",challenge.team_id).maybeSingle();
 if(excluded)return json({error:"This squad is excluded from Daily challenges"},409);
 const {data:answer}=await db.from("arcade_team_answers").select("roster").eq("team_id",challenge.team_id).maybeSingle();
 const roster=(answer?.roster||[]) as Array<{id:string,name:string,position?:string,club?:string,rarity?:string,aliases?:string[]}>;
 const {data:previous}=await db.from("daily_attempt_teams").select("found_player_ids").eq("attempt_id",attemptId).eq("sequence",sequence).maybeSingle();
 const foundBefore=(previous?.found_player_ids||[]) as string[];
 const needle=norm(guess);
 const isNameMatch=(value:string)=>{const target=norm(value);return needle===target||(Math.min(needle.length,target.length)>=6&&distance(needle,target)<=1)||(Math.min(needle.length,target.length)>=10&&distance(needle,target)<=2);};
 const isMatch=(p:{id?:string,name:string,aliases?:string[]})=>[p.name,...(p.aliases||[])].some(isNameMatch);
 const player=roster.find(p=>isMatch(p)&&!foundBefore.includes(p.id||norm(p.name)));
 if(!player)return json({correct:false,duplicate:roster.some(isMatch)});
 const playerId=player.id||norm(player.name);
 const {data:record,error:recordError}=await db.rpc("record_daily_player_guess",{
  p_attempt_id:attemptId,p_user_id:user.id,p_sequence:sequence,p_team_id:challenge.team_id,p_player_id:playerId
 });
 if(recordError)return json({error:"Guess could not be recorded"},/timer expired/i.test(recordError.message)?410:409);
 const result=Array.isArray(record)?record[0]:record;
 if(!result?.is_correct)return json({correct:false,duplicate:!!result?.is_duplicate});
 return json({correct:true,player:{id:playerId,name:player.name,position:attempt.mode==="daily-legendary"?"":(player.position||""),club:attempt.mode==="daily-legendary"?null:(player.club||null),rarity:player.rarity||"Ball Knowledge"},score:result.score,total:result.total});
});
