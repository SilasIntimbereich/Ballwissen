export async function loadWeeklyLeaderboard(){
 const list=document.querySelector("#leaderboard-list"),self=document.querySelector("#leaderboard-self");
 const config=window.FOOTBALL_ARCADE_CONFIG||{};
 if(!config.supabaseUrl||!config.supabaseAnonKey){list.innerHTML="<li>Supabase is not connected yet. Live rankings are disabled.</li>";return;}
 try{
  const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
  const client=createClient(config.supabaseUrl,config.supabaseAnonKey);
  let {data:{session}}=await client.auth.getSession();
  if(!session){const auth=await client.auth.signInAnonymously();if(auth.error)throw auth.error;session=auth.data.session;}
  const {data,error}=await client.functions.invoke("weekly-leaderboard",{method:"GET"});
  if(error)throw error;
  list.innerHTML="";
  const entries=data.entries||[];
  const top=entries.filter(x=>x.rank<=10);
  if(!top.length){list.innerHTML="<li>No completed Daily Common results in the last seven days.</li>";}
  top.forEach(entry=>{const li=document.createElement("li");li.textContent="#"+entry.rank+" · "+entry.display_name+" · "+entry.points+" pts";list.append(li);});
  const own=entries.find(x=>x.is_current_user);
  if(own)self.textContent="YOUR POSITION: #"+own.rank+" · "+own.points+" POINTS";
  else self.textContent="Your weekly position appears after your first completed Daily Common challenge.";
 }catch{list.innerHTML="<li>Live leaderboard temporarily unavailable.</li>";self.textContent="";}
}
