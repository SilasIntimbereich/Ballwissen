import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE_URL = "https://www.rsssf.org/tables/2002full.html";
const normalize = value => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const teamAliases = {
  ireland: "republicofireland",
  usa: "unitedstates",
  chinapr: "china",
  korearepublic: "southkorea"
};

const playerAliases = new Map([
  ["cameroon|alioumboukar", "boukaralioum"],
  ["china|qian", "anqi"],
  ["brazil|robertocarlos", "robertocarlosii"],
  ["brazil|ricardinho", "ricardinhoii"]
]);

export function parseSquads(sourceText, teams) {
  const expected = new Map(teams.map(team => [normalize(team.name), team]));
  const lines = sourceText.split(/\r?\n/);
  const start = lines.findIndex(line => /^Squads\s*$/i.test(line.trim()));
  if (start < 0) throw new Error("RSSSF squad section not found");

  const squads = new Map();
  let current = null;
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^==/.test(line)) break;

    const heading = line.replace(/\s+‹§[^›]+›$/, "").trim();
    const key = normalize(heading);
    const mappedKey = teamAliases[key] || key;
    const team = expected.get(mappedKey);
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

const contentType=response.headers.get("content-type")||"";
const bytes=await response.arrayBuffer();
const decoder=/charset=(?:iso-8859-1|windows-1252)/i.test(contentType)?new TextDecoder("windows-1252"):new TextDecoder("utf-8");
const rawHtml=decoder.decode(bytes);
const sourceText=rawHtml
  .replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<br\s*\/?\s*>/gi,"\n")
  .replace(/<\/(?:p|div|h[1-6]|li|pre|tr)>/gi,"\n")
  .replace(/<[^>]*>/g," ")
  .replace(/&nbsp;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&eacute;/gi,"é").replace(/&Eacute;/g,"É")
  .replace(/&ouml;/gi,"ö").replace(/&Ouml;/g,"Ö")
  .replace(/&uuml;/gi,"ü").replace(/&Uuml;/g,"Ü")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/\r/g,"");
const squads = parseSquads(sourceText, teams);
const report = {
  year: 2002, source: SOURCE_URL, sourceStatus: "available",
  generatedAt: new Date().toISOString(), teams: [], summary: {}
};

for (const team of teams) {
  const sourceNames = squads.get(team.id) || [];
  const datasetNames = team.players.map(player => player.name);
  const sourceSet = new Set(sourceNames.map(normalize));
  const datasetSet = new Set(datasetNames.map(normalize));
  const matched = [];
  const missingFromSource = [];
  const missingFromDataset = [];

  for (const player of datasetNames) {
    const key = normalize(player);
    if (sourceSet.has(key)) {
      matched.push({ datasetName: player, sourceName: sourceNames.find(name => normalize(name) === key) });
      continue;
    }
    const alias = playerAliases.get(normalize(team.name) + "|" + key);
    if (alias && sourceSet.has(alias)) {
      matched.push({
        datasetName: player,
        sourceName: sourceNames.find(name => normalize(name) === alias),
        match: "manual-alias"
      });
    } else {
      missingFromSource.push(player);
    }
  }

  for (const name of sourceNames) {
    const key = normalize(name);
    if (!datasetSet.has(key) && !matched.some(row => normalize(row.sourceName) === key)) {
      missingFromDataset.push(name);
    }
  }

  report.teams.push({
    teamId: team.id, teamName: team.name,
    sourcePlayerCount: sourceNames.length, datasetPlayerCount: datasetNames.length,
    matchedCount: matched.length, missingFromSource, missingFromDataset,
    sourceComplete: sourceNames.length === 23,
    rosterClean: sourceNames.length === 23 && matched.length === 23 &&
      missingFromSource.length === 0 && missingFromDataset.length === 0,
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
    sum + team.missingFromSource.length + team.missingFromDataset.length, 0)
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/2002-roster-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));

if (report.summary.parsedTeams !== 32 || report.summary.sourcePlayers !== 736) {
  throw new Error("2002 source parser did not account for all 32 squads and 736 players");
}
