const positionMap={Goalkeeper:"GK",Defender:"DF",Midfielder:"MF",Forward:"FW",GK:"GK",DF:"DF",MF:"MF",FW:"FW"};
const cleanClub=s=>{const value=String(s||"").replace(/\s*\([A-Z]{3}\)\s*$/,"").trim();return /^no club affiliation$/i.test(value)||/^no club$/i.test(value)?null:value||null;};

export function parseColumnarRows(groups,lines){
 const valuesFor=label=>{
  for(const group of groups||[]){
   const items=(group.items||[]).slice().sort((a,b)=>(a.x||0)-(b.x||0))
    .map(item=>String(item.text||"").trim()).filter(Boolean);
   for(let count=1;count<=items.length;count++){
    const prefix=items.slice(0,count).join(" ").trim();
    if(prefix.toLowerCase()===label.toLowerCase())return items.slice(count);
    if(prefix.toLowerCase().startsWith(label.toLowerCase()+" "))
     return [prefix.slice(label.length).trim(),...items.slice(count)].filter(Boolean);
   }
  }
  return [];
 };
 const displayNames=valuesFor("FIFA Display Name");
 const positions=valuesFor("POS");
 const clubs=valuesFor("Club");
 const dates=valuesFor("DOB");
 if(!displayNames.length||positions.length!==displayNames.length||
    clubs.length!==displayNames.length||dates.length!==displayNames.length)return [];
 const sourceLines=Array.isArray(lines)?lines.map(line=>String(line||"").trim()):[];
 const numberLine=sourceLines.findIndex(line=>/^#\s*\d/.test(line));
 if(numberLine<0)return [];
 const numbers=[...(sourceLines[numberLine].replace(/^#\s*/,"").matchAll(/\d{1,2}/g))].map(match=>Number(match[0]));
 for(let index=numberLine+1;index<sourceLines.length&&numbers.length<displayNames.length;index++){
  if(!/^\d{1,2}(?:\s+\d{1,2})*$/.test(sourceLines[index]))break;
  numbers.push(...sourceLines[index].match(/\d{1,2}/g).map(Number));
 }
 if(numbers.length!==displayNames.length)return [];
 return displayNames.map((nameArea,index)=>({
  number:numbers[index],
  position:String(positions[index]||"").toUpperCase(),
  nameArea,
  club:cleanClub(clubs[index]),
  date:dates[index],
  line:[numbers[index],nameArea,dates[index],positions[index],clubs[index]].join(" ")
 })).filter(row=>row.nameArea&&/^(GK|DF|MF|FW)$/.test(row.position)&&row.club);
}

export function parseRows(lines,format){
 const rows=[];
 if(format==="modern-pipe"||format==="2018"){
  // FIFA's 2014 and 2018 PDFs use the same labelled, pipe-delimited layout.
  // PDF.js may preserve, split, or omit the visual pipe separators, so parse
  // each numbered record by its field labels instead of relying on one rigid row regex.
  const text=lines.join(" ").replace(/\s+/g," ").trim();
  const starts=[...text.matchAll(/(?:#\s*)?(\d{1,2})\s*\|?\s*(?=FIFA\s+Display\s+Name\b)/gi)];
  const readField=(record,label,nextLabel)=>{
   const expression=new RegExp(label+"\\s+(.+?)(?=\\s*\\|?\\s*"+nextLabel+"\\b|$)","i");
   return record.match(expression)?.[1]?.trim()||"";
  };
  for(let index=0;index<starts.length;index++){
   const current=starts[index];
   const recordStart=current.index+current[0].length;
   const recordEnd=index+1<starts.length?starts[index+1].index:text.length;
   const record=text.slice(recordStart,recordEnd).replace(/\s*\|\s*$/,"").trim();
   const nameArea=readField(record,"FIFA Display Name","Last Name");
   const position=readField(record,"POS","Club").match(/^(GK|DF|MF|FW)\b/i)?.[1]?.toUpperCase()||"";
   const club=readField(record,"Club","Height");
   if(!nameArea||!position||!club)continue;
   rows.push({number:Number(current[1]),position,nameArea,club:cleanClub(club),line:record});
  }
  return rows;
 }
 for(const line of lines){
  let m;
  if(format==="2022"){
   m=line.match(/^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)$/);
   if(m)rows.push({number:Number(m[1]),position:m[2],nameArea:m[3],club:cleanClub(m[5]),line});
  }else if(format==="2010"){
   m=line.match(/^(\d{1,2})\s+(Goalkeeper|Defender|Midfielder|Forward)\s+(.+?)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+(\d{3})$/);
   if(m)rows.push({number:Number(m[1]),position:positionMap[m[2]],nameArea:m[3],club:cleanClub(m[5]),line});
  }else{
   m=line.match(/^(\d{1,2})\s+(.+?)\s+(\d{2}\.\d{2}\.\d{4})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)$/);
   if(m)rows.push({number:Number(m[1]),position:m[4],nameArea:m[2],club:cleanClub(m[5]),line});
  }
 }
 return rows;
}

