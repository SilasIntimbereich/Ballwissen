const GENERIC_HEADING=/^(?:FIFA WORLD CUP.*|SQUAD LIST|LIST OF PLAYERS|LIST OF PLAYER|TEAM SQUAD|SQUAD)$/i;
const TABLE_HEADING=/^(?:#|POS|POSITION|PLAYER|NAME|DOB|DATE OF BIRTH|CLUB|HEIGHT|CAPS|GOALS)(?:\s|$)/i;
const POSITION_LEGEND=/^GK\s*:\s*Goalkeeper.*DF\s*:\s*Defender.*MF\s*:\s*Midfielder.*FW\s*:\s*Forward$/i;
const DATE_HEADING=/^(?:DOB:|POS:|DATE OF BIRTH|(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s+\d{1,2}\s+\w+\s+\d{4})/i;

function normalizeHeading(value){
 return String(value||"").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLowerCase()
  .replace(/[^a-z0-9]/g,"");
}

function usableHeading(line){
 const value=String(line||"").replace(/\s+/g," ").trim();
 return Boolean(value)&&value.length<=80&&
  !GENERIC_HEADING.test(value)&&!TABLE_HEADING.test(value)&&
  !POSITION_LEGEND.test(value)&&!DATE_HEADING.test(value)&&
  !/^\d+\s/.test(value)&&! /^(?:coach|head coach|manager)\b/i.test(value);
}

/**
 * Extract a country heading from one FIFA squad-list PDF page.
 * Only explicit FIFA country-code headings or exact known team names are
 * accepted. Unknown headings fail closed instead of being guessed.
 */
export function extractTeamHeading(lines,knownTeams=[]){
 const values=(Array.isArray(lines)?lines:[])
  .map(line=>String(line||"").replace(/\s+/g," ").trim())
  .filter(Boolean);
 const known=new Set(knownTeams.map(normalizeHeading));
 const countryCodeHeading=values.find(line=>{
  if(!usableHeading(line))return false;
  if(!/\([A-Z]{3}\)\s*$/.test(line))return false;
  const countryName=line.replace(/\s*\([A-Z]{3}\)\s*$/,"");
  return known.has(normalizeHeading(countryName));
 });
 if(countryCodeHeading)return countryCodeHeading;
 return values.find(line=>usableHeading(line)&&known.has(normalizeHeading(line)))||"";
}
