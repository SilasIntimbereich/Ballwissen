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
export function matches(guess,player){
 const input=normalize(guess);
 if(!input)return false;
 const targets=[player.name,...(player.aliases||[])].filter(Boolean).map(normalize);
 if(targets.includes(input))return true;
 if(input.length<4)return false;
 return targets.some(target=>
  (Math.min(input.length,target.length)>=6&&distance(input,target)<=1)||
  (Math.min(input.length,target.length)>=10&&distance(input,target)<=2)
 );
}
