const GENERIC_HEADING=/^(?:FIFA WORLD CUP.*|SQUAD LIST|LIST OF PLAYERS|LIST OF PLAYER|TEAM SQUAD|SQUAD)$/i;
const TABLE_HEADING=/^(?:#|POS|POSITION|PLAYER|NAME|DOB|DATE OF BIRTH|CLUB|HEIGHT|CAPS|GOALS)(?:\\s|$)/i;
const POSITION_LEGEND=/^GK\\s*:\\s*Goalkeeper.*DF\\s*:\\s*Defender.*MF\\s*:\\s*Midfielder.*FW\\s*:\\s*Forward$/i;
const DATE_HEADING=/^(?:DOB:|POS:|DATE OF BIRTH|(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\\s+\\d{1,2}\\s+\\w+\\s+\\d{4})/i;

const TEAM_ALIASES=new Map([
  ["iriran","iran"],["korearepublic","southkorea"],["koreadpr","northkorea"],
  ["koreademocraticpeoplesrepublic","northkorea"],["cotedivoire","ivorycoast"],
  ["usa","unitedstates"],["unitedstatesofamerica","unitedstates"],
  ["czechia","czechrepublic"],["chinesepr","china"],["chinapr","china"],
  ["bosniaherzegovina","bosniaandherzegovina"],["republicofireland","ireland"],
  ["trinidadtobago","trinidadandtobago"]
]);

const FIFA_CODES=new Map(Object.entries({
  algeria:"ALG",angola:"ANG",argentina:"ARG",australia:"AUS",austria:"AUT",
  belgium:"BEL",bosniaandherzegovina:"BIH",brazil:"BRA",cameroon:"CMR",canada:"CAN",
  chile:"CHI",china:"CHN",colombia:"COL",costarica:"CRC",croatia:"CRO",
  curacao:"CUW",czechrepublic:"CZE",denmark:"DEN",ecuador:"ECU",egypt:"EGY",
  england:"ENG",france:"FRA",germany:"GER",ghana:"GHA",greece:"GRE",
  haiti:"HAI",honduras:"HON",iceland:"ISL",iran:"IRN",iraq:"IRQ",ireland:"IRL",
  italy:"ITA",ivorycoast:"CIV",japan:"JPN",jordan:"JOR",mexico:"MEX",
  morocco:"MAR",netherlands:"NED",newzealand:"NZL",nigeria:"NGA",northkorea:"PRK",
  norway:"NOR",panama:"PAN",paraguay:"PAR",peru:"PER",poland:"POL",portugal:"POR",
  qatar:"QAT",russia:"RUS",saudiarabia:"KSA",scotland:"SCO",senegal:"SEN",
  serbia:"SRB",serbiaandmontenegro:"SCG",slovakia:"SVK",slovenia:"SVN",
  southafrica:"RSA",southkorea:"KOR",spain:"ESP",sweden:"SWE",switzerland:"SUI",
  togo:"TOG",trinidadandtobago:"TRI",tunisia:"TUN",turkey:"TUR",ukraine:"UKR",
  unitedstates:"USA",uruguay:"URU",uzbekistan:"UZB",wales:"WAL"
}));

function normalizeHeading(value){
 return String(value||"").normalize("NFD")
  .replace(/[\\u0300-\\u036f]/g,"")
  .toLowerCase()
  .replace(/[^a-z0-9]/g,"");
}

function canonicalTeamKey(value){
 const key=normalizeHeading(value);
 return TEAM_ALIASES.get(key)||key;
}

function usableHeading(line){
 const value=String(line||"").replace(/\\s+/g," ").trim();
 return Boolean(value)&&value.length<=80&&
  !GENERIC_HEADING.test(value)&&!TABLE_HEADING.test(value)&&
  !POSITION_LEGEND.test(value)&&!DATE_HEADING.test(value)&&
  !/^\\d+\\s/.test(value)&&!/^(?:coach|head coach|manager)\\b/i.test(value);
}

/**
 * Extract a country heading from one FIFA squad-list PDF page.
 * Country-code headings must match the known FIFA code for that country.
 * Unknown or mismatched headings fail closed instead of being guessed.
 */
export function extractTeamHeading(lines,knownTeams=[]){
 const values=(Array.isArray(lines)?lines:[])
  .map(line=>String(line||"").replace(/\\s+/g," ").trim())
  .filter(Boolean);
 const known=new Set(knownTeams.map(canonicalTeamKey));
 const countryCodeHeading=values.find(line=>{
  if(!usableHeading(line))return false;
  const match=line.match(/^(.*?)\\s*\\(([A-Z]{3})\\)\\s*$/);
  if(!match)return false;
  const key=canonicalTeamKey(match[1]);
  return known.has(key)&&FIFA_CODES.get(key)===match[2];
 });
 if(countryCodeHeading)return countryCodeHeading;
 return values.find(line=>usableHeading(line)&&known.has(canonicalTeamKey(line)))||"";
}
