export const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");

function distance(a,b){
 const row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let previous=row[0];row[0]=i;
  for(let j=1;j<=b.length;j++){
   const old=row[j];
   row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));
   previous=old;
  }
 }
 return row[b.length];
}

const surnameParticles=new Set(["da","das","de","del","della","di","dos","du","la","le","van","von","bin","al","el","st"]);
function surnameForms(value){
 const words=String(value??"").trim().split(/\s+/).filter(Boolean);
 if(!words.length)return [];
 const forms=[normalize(words.at(-1))];
 let start=words.length-1;
 while(start>0&&surnameParticles.has(normalize(words[start-1])))start--;
 if(start<words.length-1)forms.push(normalize(words.slice(start).join(" ")));
 return [...new Set(forms.filter(form=>form.length>=4))];
}
function nameTargets(player){
 return [player?.name,...(Array.isArray(player?.aliases)?player.aliases:[])]
  .filter(Boolean).map(normalize).filter(Boolean);
}
function surnameTargets(player){
 const aliases=Array.isArray(player?.aliases)?player.aliases:[];
 return [...new Set([...surnameForms(player?.name),...aliases.flatMap(surnameForms)])];
}
function fuzzyTargets(input,player){
 return nameTargets(player).some(target=>{
  const shortest=Math.min(input.length,target.length);
  return (shortest>=6&&distance(input,target)<=1)||
    (shortest>=10&&distance(input,target)<=2);
 });
}

export function matches(guess,player,squad=[player]){
 const input=normalize(guess);
 if(!input||!player)return false;
 const targets=nameTargets(player);
 if(targets.includes(input))return true;

 const ownSurnames=surnameTargets(player);
 if(ownSurnames.includes(input)){
  const candidates=(Array.isArray(squad)?squad:[player]).filter(candidate=>surnameTargets(candidate).includes(input));
  if(candidates.length===1&&candidates[0]===player)return true;
 }
 if(input.length<4)return false;

 // Fuzzy matching is deliberately conservative: if a typo could point to
 // two players in this squad, ask for a more specific name instead of guessing.
 if(!fuzzyTargets(input,player))return false;
 const candidates=(Array.isArray(squad)?squad:[player]).filter(candidate=>fuzzyTargets(input,candidate));
 return candidates.length===1&&candidates[0]===player;
}
