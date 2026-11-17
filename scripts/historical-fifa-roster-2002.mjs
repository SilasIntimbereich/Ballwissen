const normalize = value => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const codeToTeam = {
  ARG:"Argentina", BEL:"Belgium", BRA:"Brazil", CHN:"China", CMR:"Cameroon",
  CRC:"Costa Rica", CRO:"Croatia", DEN:"Denmark", ECU:"Ecuador", ENG:"England",
  ESP:"Spain", FRA:"France", GER:"Germany", IRL:"Republic of Ireland", ITA:"Italy",
  JPN:"Japan", KOR:"South Korea", KSA:"Saudi Arabia", MEX:"Mexico", NGA:"Nigeria",
  PAR:"Paraguay", POL:"Poland", POR:"Portugal", RUS:"Russia", SEN:"Senegal",
  SLO:"Slovenia", SVN:"Slovenia", RSA:"South Africa", SWE:"Sweden", TUN:"Tunisia", TUR:"Turkey",
  URU:"Uruguay", USA:"United States", NED:"Netherlands"
};

function decode(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function parseFifa2002Roster(html, teams) {
  const expected = new Map(teams.map(team => [normalize(team.name), team]));
  const text = decode(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:tr|p|div|pre|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
  const result = new Map();

  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z]{3})\s+(?:(\d{1,2})\s+)?(GK|DF|MF|FW)\s+(.+)$/i);
    if (!match) continue;
    const teamName = codeToTeam[match[1].toUpperCase()];
    const team = expected.get(normalize(teamName));
    if (!team) continue;
    if (!result.has(team.id)) result.set(team.id, []);
    result.get(team.id).push({
      number: match[2] ? Number(match[2]) : null,
      position: match[3].toUpperCase(),
      name: match[4].trim()
    });
  }
  return result;
}

export function isCleanFifa2002RosterAudit(item, expectedPlayerCount) {
  return Boolean(item &&
    expectedPlayerCount === 23 &&
    item.sourcePlayerCount === 23 &&
    item.matchedPlayers === expectedPlayerCount &&
    item.nameMismatches?.length === 0 &&
    item.missingFromSource?.length === 0 &&
    item.missingFromDataset?.length === 0 &&
    item.positionDifferences?.length === 0);
}
