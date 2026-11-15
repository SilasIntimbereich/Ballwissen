import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment. Never use this key in browser code.");
const db=createClient(url,key,{auth:{persistSession:false}});
const files=["data/historical-squads.json","data/worldcup-2026.json"];
let count=0;
for(const file of files){
 let data;try{data=JSON.parse(await readFile(file,"utf8"));}catch{continue;}
 const groups=data.tournaments||{2026:data};
 for(const [year,teams] of Object.entries(groups)){
  for(const team of teams){
   const teamId=team.id||team.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+year;
   const metadata={id:teamId,tournament_year:Number(year),team_name:team.name,team_difficulty:team.teamDifficulty||null,source_url:data.sourceUrl||data.source||null,verified:team.verified===true};
   const {error:metaError}=await db.from("arcade_teams").upsert(metadata);
   if(metaError)throw new Error("Team metadata "+teamId+": "+metaError.message);
   const roster=(team.players||[]).map((p,i)=>({id:teamId+"-"+(p.number||i+1),name:p.name,position:p.position||"",club:p.club||"",number:p.number||null,rarity:p.rarity||null}));
   const {error:rosterError}=await db.from("arcade_team_answers").upsert({team_id:teamId,roster,updated_at:new Date().toISOString()});
   if(rosterError)throw new Error("Roster "+teamId+": "+rosterError.message);
   count++;
  }
 }
}
console.log("Synced",count,"teams to Supabase.");
