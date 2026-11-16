export const normalizePlayerName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function createPlayerRarityResolver(historical,worldCup2026,overrides){
 const appearances=new Map();
 const add=(name,year,aliases=[])=>{
  for(const value of [name,...aliases]){
   const key=normalizePlayerName(value);
   if(!key)continue;
   if(!appearances.has(key))appearances.set(key,new Set());
   appearances.get(key).add(Number(year));
  }
 };
 for(const [year,teams] of Object.entries(historical.tournaments||{}))
  for(const team of teams)for(const player of team.players||[])add(player.name,year,player.aliases||[]);
 for(const player of worldCup2026.players||[])add(player.name||player.player,2026,player.aliases||[]);
 const legendary=new Set((overrides.legendary||[]).map(normalizePlayerName));
 const niche=new Set((overrides.niche||[]).map(normalizePlayerName));
 return player=>{
  const key=normalizePlayerName(player.name||player.player);
  if(legendary.has(key))return "Legendary";
  if(niche.has(key))return "Niche";
  const count=appearances.get(key)?.size||1;
  if(count>=3)return "Common";
  if(count===2)return "Rare";
  return "Ball Knowledge";
 };
}
