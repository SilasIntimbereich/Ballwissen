import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";

const SOURCE_URL = "https://raw.githubusercontent.com/rsssf/tables/master/tables/2002full.txt";
const normalize = value => String(value || "")
  .replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const teamAliases = {
  ireland: "republicofireland",
  usa: "unitedstates",
  chinapr: "china",
  korearepublic: "southkorea"
};

const playerAliases = new Map([
  ["argentina|juanpablosorin", "sorinjuan"],
  ["argentina|juansebastianveron", "veronjuan"],
  ["unitedstates|johnobrien", "obrienjohn"],
  ["unitedstates|brianmcbride", "mcbridebrian"],
  ["unitedstates|tonysanneh", "sannehanthony"],
  ["slovenia|djoninovak", "djoninovak"],
  ["southkorea|chadoori", "duricha"],
  ["tunisia|joseclayton", "clayton"],
  ["cameroon|alioumboukar", "boukaralioum"],
  ["china|qian", "anqi"],
  ["brazil|robertocarlos", "robertocarlosii"],
  ["brazil|ricardinho", "ricardinhoii"],
  ["brazil|julianobelletti", "belletti"],
  ["ecuador|kleberchala", "cleberchala"],
  ["ecuador|geovannyespinoza", "geovannyespinoza"],
  ["japan|alex", "alessandrosantos"],
  ["nigeria|efetoboresodje", "efesodje"],
  ["paraguay|richardbaez", "richartbaez"],
  ["paraguay|jorgecampos", "jorgelu iscampos".replace(/ /g, "")],
  ["portugal|caneira", "marcocaneira"],
  ["portugal|figo", "luisfigo"],
  ["portugal|nelson", "nelsonpereira"],
  ["portugal|frechaut", "nunofrechaut"],
  ["republicofireland|andyobrien", "andrewobrien"],
  ["russia|ruslannigamatullin", "ruslannigmatullin"],
  ["russia|alexei smertin".replace(/ /g, ""), "alexeysmertin"],
  ["russia|valerykarpin", "valerikarpin"],
  ["russia|egortitov", "yegortitov"],
  ["russia|alexandrmostovoi", "alexandrmostovoi"],
  ["russia|viacheslavdaev", "viacheslavdaev"],
  ["russia|dmitryalenichev", "dmitryalenichev"],
  ["russia|alexanderkerzhakov", "alexanderkerzhakov"],
  ["russia|dmitrykhokhlov", "dmitrykhokhlov"],
  ["russia|aleksanderfilimonov", "aleksanderfilimonov"],
  ["saudiarabia|mohammedaldeayea", "mohamedaldeayea"],
  ["saudiarabia|mohsinharthi", "mohsinalharthi"],
  ["saudiarabia|mohammedalshlhoub", "mohammadalshalhoub"],
  ["saudiarabia|obeidaldossary", "obeidaldossary"],
  ["saudiarabia|ahmeddukhi aldossary".replace(/ /g, ""), "ahmeddukhialdossary"],
  ["saudiarabia|husseinsulimani", "husseinsulimani"],
  ["saudiarabia|khamis alowairan aldossari".replace(/ /g, ""), "khamisalowairanaldossari"],
  ["saudiarabia|alhassanal yami".replace(/ /g, ""), "alyamialhassan"],
  ["saudiarabia|mohammedalkhojali", "babkrmohammedkhojali"],
  ["senegal|papeboubadiop", "papaboubadiop"],
  ["senegal|maktharndiaye", "maktharndiaye"],
  ["slovenia|djoninovak", "dzoninovak"],
  ["southafrica|macdonaldmukasi", "mukasimacdonald"],
  ["southafrica|benedictmccarthy", "mccarthybenedict"],
  ["southkorea|choijincheol", "jincheulchoi"],
  ["southkorea|yoosangcheol", "sangchulyoo"],
  ["southkorea|seolkihyun", "kihyeonseol"],
  ["southkorea|leecheonsoo", "chuns oolee".replace(/ /g, "")],
  ["southkorea|chadoori", "duricha"],
  ["southkorea|hwangseonhong", "sunhonghwang"],
  ["southkorea|songjonggook", "chonggugsong"],
  ["spain|puyol", "puyol"],
  ["spain|hierro", "hierro"],
  ["spain|baraja", "baraja"],
  ["spain|morientes", "morientes"],
  ["spain|depedro", "depedro"],
  ["spain|luque", "luque"],
  ["spain|albelda", "albelda"],
  ["spain|romero", "romero"],
  ["spain|mendieta", "mendieta"],
  ["spain|valeron", "valeron"],
  ["spain|nadal", "nadal"],
  ["spain|contreras", "contreras"],
  ["sweden|fredrikljungberg", "freddieljungberg"],
  ["tunisia|zoubeirbeya", "zoubeirbaya"],
  ["tunisia|ziedjaz iri".replace(/ /g, ""), "ziadjaziri"],
  ["tunisia|imedmhadhebi", "imedmhadhebi"],
  ["tunisia|slimbenachour", "slimbenachour"],
  ["tunisia|ahmedjaouachi", "ahmedjaouachi"],
  ["turkey|mustafa izzet".replace(/ /g, ""), "muzzyizzet"],
  ["turkey|zaferozgultekin", "ozgultekinzafer"]
]);

export function parseSquads(sourceText, teams) {
  const expected = new Map(teams.map(team => [normalize(team.name), team]));
  const lines = sourceText.split(/\r?\n/);
  const start = lines.findIndex(line => /^==\s*Squads\b/i.test(line.trim()));
  if (start < 0) throw new Error("RSSSF squad section not found");

  const squads = new Map();
  let current = null;
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^==/.test(line)) break;

    const heading = line.replace(/\s+‹§[^›]+›$/, "").trim();
    const key = normalize(heading);
    const team = expected.get(teamAliases[key] || key);
    if (team && heading === heading.toUpperCase()) {
      current = team;
      squads.set(team.id, []);
      continue;
    }

    if (!current) continue;
    if (/^Coach:/i.test(line)) {
      current = null;
      continue;
    }
    if (/^\*/.test(line)) continue;

    const name = line.replace(/\s+\[[^\]]+\]$/, "").trim();
    if (name && name.length <= 70 && !/^(?:==|Coach:)/i.test(name)) {
      squads.get(current.id).push(name);
    }
  }
  return squads;
}


function parsePlanetWorldCupEngland(html) {
  const text=html
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<br\s*\/?\s*>/gi,"\n")
    .replace(/<[^>]*>/g," ");
  const names=[];
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*\d{1,2}\s+(?:GK|DF|MD|FW)\s+(.+?)\s{2,}\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\b/);
    if(match) names.push(match[1].trim());
  }
  return names;
}

const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const teams = historical.tournaments["2002"] || [];
const response = await fetch(SOURCE_URL, {
  headers: { "User-Agent": "FootballArcadeRosterAudit/1.0" },
  signal: AbortSignal.timeout(30000)
});

if (!response.ok) {
  const report = {
    year: 2002, source: SOURCE_URL, sourceStatus: "unavailable",
    httpStatus: response.status, generatedAt: new Date().toISOString(),
    summary: { expectedTeams: 32, parsedTeams: 0, sourcePlayers: 0, unavailable: true },
    teams: teams.map(team => ({ teamId: team.id, teamName: team.name, sourceStatus: "unavailable" }))
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/2002-roster-audit.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary, null, 2));
  process.exit(0);
}

const sourceText = await response.text();
const squads = parseSquads(sourceText, teams);
const teamSourceUrls=new Map(teams.map(team=>[team.id,SOURCE_URL]));
const teamSourceNotes=new Map();
const england=teams.find(team=>normalize(team.name)==="england");
if(england){
  const englandUrl="https://www.planetworldcup.com/CUPS/2002/squad_eng02.html";
  try{
    const englandResponse=await fetch(englandUrl,{headers:{"User-Agent":"FootballArcadeRosterAudit/1.0"},signal:AbortSignal.timeout(15000)});
    if(englandResponse.ok){
      const englandNames=parsePlanetWorldCupEngland(await englandResponse.text());
      if(englandNames.length===23){
        squads.set(england.id,englandNames);
        teamSourceUrls.set(england.id,englandUrl);
        teamSourceNotes.set(england.id,"Planet World Cup final England squad used instead of the RSSSF page, which retains Danny Murphy from the pre-replacement list; Trevor Sinclair is in the final 23.");
      }
    }
  }catch{}
}
const report = {
  year: 2002, source: SOURCE_URL, sourceStatus: "available",
  generatedAt: new Date().toISOString(), teams: [], summary: {}
};

for (const team of teams) {
  const sourceNames = squads.get(team.id) || [];
  const datasetNames = team.players.map(player => player.name);
  const matched = [];
  const matchedSourceNames = new Set();
  const missingFromSource = [];
  const missingFromDataset = [];

  for (const player of datasetNames) {
    const key = normalize(player);
    let sourceName = sourceNames.find(name => normalize(name) === key);
    let matchType = "exact";
    if (!sourceName) {
      const alias = playerAliases.get(normalize(team.name) + "|" + key);
      if (alias) {
        sourceName = sourceNames.find(name => normalize(name) === alias);
        if (sourceName) matchType = "manual-alias";
      }
    }
    if (!sourceName) {
      sourceName = sourceNames.find(name => namesMatch(player, name));
      if (sourceName) matchType = "normalized-name";
    }
    if (sourceName) {
      matched.push({ datasetName: player, sourceName, match: matchType });
      matchedSourceNames.add(sourceName);
    } else {
      missingFromSource.push(player);
    }
  }
  for (const name of sourceNames) {
    if (!matchedSourceNames.has(name)) missingFromDataset.push(name);
  }
  report.teams.push({
    teamId: team.id, teamName: team.name,
    sourceUrl: teamSourceUrls.get(team.id)||SOURCE_URL,
    sourceNote: teamSourceNotes.get(team.id)||null,
    sourcePlayerCount: sourceNames.length, datasetPlayerCount: datasetNames.length,
    matchedCount: matched.length, missingFromSource, missingFromDataset,
    sourceComplete: sourceNames.length === 23,
    rosterClean: sourceNames.length === 23 && matched.length === 23 && missingFromSource.length === 0 && missingFromDataset.length === 0,
    matched
  });
}

report.summary = {
  expectedTeams: 32,
  parsedTeams: squads.size,
  teamsWith23SourcePlayers: report.teams.filter(team => team.sourceComplete).length,
  fullyMatchedTeams: report.teams.filter(team => team.rosterClean).length,
  sourcePlayers: report.teams.reduce((sum, team) => sum + team.sourcePlayerCount, 0),
  datasetPlayers: report.teams.reduce((sum, team) => sum + team.datasetPlayerCount, 0),
  matchedPlayers: report.teams.reduce((sum, team) => sum + team.matchedCount, 0),
  unresolvedDifferences: report.teams.reduce((sum, team) =>
    sum + team.missingFromSource.length + team.missingFromDataset.length, 0),
  sourceOverrides: report.teams.filter(team => team.sourceUrl !== SOURCE_URL).length
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/2002-roster-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));

if (report.summary.parsedTeams !== 32 || report.summary.sourcePlayers !== 736) {
  throw new Error("2002 source parser did not account for all 32 squads and 736 players");
}
