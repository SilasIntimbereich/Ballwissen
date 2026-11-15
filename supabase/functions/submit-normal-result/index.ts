import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function distance(a:string,b:string){const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return d[b.length];}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return Response.json({error:"POST required"},{status:405,headers:cors});
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
 const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return Response.json({error:"Sign in required"},{status:401,headers:cors});
 const {teamId,guessedNames=[]}=await req.json();
 if(typeof teamId!=="string"||!Array.isArray(guessedNames)||guessedNames.length>60||guessedNames.some((x:unknown)=>typeof x!=="string"||x.length>80))return Response.json({error:"Invalid result"},{status:400,headers:cors});
 const db=createClient(url,service);
 const {data:team}=await db.from("arcade_teams").select("id").eq("id",teamId).eq("verified",true).maybeSingle();
 const {data:answer}=await db.from("arcade_team_answers").select("roster").eq("team_id",teamId).maybeSingle();
 if(!team||!answer)return Response.json({error:"Verified team not found"},{status:404,headers:cors});
 const roster=(answer.roster||[]) as Array<{name:string}>,guesses=[...new Set(guessedNames.map(norm))].filter(Boolean);
 const found=roster.filter(p=>guesses.some(g=>{const n=norm(p.name);return g===n||(Math.min(g.length,n.length)>=6&&distance(g,n)<=1)||(Math.min(g.length,n.length)>=10&&distance(g,n)<=2);}));
 const {error}=await db.from("normal_game_results").insert({user_id:user.id,team_id:teamId,score:found.length,total:roster.length});
 if(error)return Response.json({error:"Could not save result"},{status:500,headers:cors});
 const {data:percentile}=await db.rpc("team_percentile",{p_team_id:teamId,p_score:found.length,p_total:roster.length});
 const {data:distribution}=await db.rpc("team_score_distribution",{p_team_id:teamId});
 return Response.json({score:found.length,total:roster.length,outscoredPercent:percentile,distribution:distribution||[]},{headers:cors});
});