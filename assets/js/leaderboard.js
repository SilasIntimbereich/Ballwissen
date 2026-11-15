export async function loadWeeklyLeaderboard(){
 const list=document.querySelector("#leaderboard-list");
 const config=window.FOOTBALL_ARCADE_CONFIG||{};
 if(!config.supabaseUrl||!config.supabaseAnonKey){list.innerHTML="<li>Supabase is not connected yet. Live rankings are disabled.</li>";return;}
 try{
  const response=await fetch(config.supabaseUrl.replace(/\/$/,"")+"/functions/v1/weekly-leaderboard",{headers:{apikey:config.supabaseAnonKey}});
  if(!response.ok)throw new Error("Leaderboard endpoint unavailable");
  const payload=await response.json();
  list.innerHTML="";
  if(!payload.entries?.length){list.innerHTML="<li>No completed Daily Common results in the last seven days.</li>";return;}
  payload.entries.forEach(entry=>{const li=document.createElement("li");li.textContent="#"+entry.rank+" · "+entry.display_name+" · "+entry.points+" pts";list.append(li);});
 }catch{list.innerHTML="<li>Live leaderboard temporarily unavailable.</li>";}
}
