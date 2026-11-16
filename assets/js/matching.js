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
 if(words.length>1&&surnameParticles.has(normalize(words.at(-2))))
  forms.push(normalize(words.slice(-2).join(" ")));
 return [...new Set(forms.filter(form=>form.length>=4))];
}
function nameTargets(player){
 return [player?.name,...(player?.aliases||[])].filter(Boolean).map(normalize);
}
export function matches(guess,player,squad=[player]){
 const input=normalize(guess);
 if(!input||!player)return false;
 const targets=nameTargets(player);
 if(targets.includes(input))return true;
 const ownSurnames=[...surnameForms(player.name),...(player.aliases||[]).flatMap(surnameForms)];
 if(ownSurnames.includes(input)){
  const candidates=(Array.isArray(squad)?squad:[player]).filter(candidate=>
   [...surnameForms(candidate?.name),...(candidate?.aliases||[]).flatMap(surnameForms)].includes(input)
  );
  if(candidates.length===1&&candidates[0]===player)return true;
 }
 if(input.length<4)return false;
 return targets.some(target=>
  (Math.min(input.length,target.length)>=6&&distance(input,target)<=1)||
  (Math.min(input.length,target.length)>=10&&distance(input,target)<=2)
 );
}
