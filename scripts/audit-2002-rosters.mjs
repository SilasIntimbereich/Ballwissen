import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE_URL = "https://raw.githubusercontent.com/rsssf/tables/master/tables/2002full.txt";
const normalize = value => String(value || "")
  .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const teamAliases = {
  ireland: "republic of ireland",
  "south korea": "south korea",
  "united states": "united states"
};

const playerAliases = new Map([
  ["cameroon|alioumboukar", "boukaralioum"],
  ["china|qian", "anqi"],
  ["brazil|robertocarlos", "robertocarlosii"],
  ["brazil|ricardinho", "ricardinhoii"]
]);

function parseSquads(text, teams) {
  const expected = new Map(teams.map(team => [normalize(team.name), team]));
  expected.set(normalize("Republic of Ireland"), teams.find(t => normalize(t.name) === normalize("Republic of Ireland")));
  const lines = text.split(/\\r?\\n/);
  const start = lines.findIndex(line => /==\\s*Squads\\s*==/i.test(line));
  if (start < 0) throw new Error("RSSSF squad section not found");
  const squads = new Map();
  let current = null;
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^==\\s*Oldest and youngest/i.test(line)) break;
    const heading = line.replace(/\\s+‹§[^›]+›$/, "").trim();
    const key = normalize(heading);
    const mappedName = key === "ireland" ? "republic of ireland" : heading;
    const team = expected.get(normalize(mappedName));
    if (team && heading === heading.toUpperCase()) {
      current = team;
      squads.set(team.id, []);
      continue;
    }
    if (!current || /^Coach:/i.test(line) || /^\\*/.test(line)) {
      if (/^Coach:/i.test(line)) current = null;
      continue;
    }
    const name = line.replace(/\\s+\\[[^\\]]+\\]$/, "").trim();
    if (!name || name.length > 70 || /^(?:==|Coach:)/i.test(name)) continue;
    squads.get(current.id).push(name);
  }
  return squads;
}

const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const teams = historical.tournaments["2002"] || [];
const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "FootballArcadeRosterAudit/1.0" }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error("RSSSF source unavailable: HTTP " + response.status);
const sourceText = await response.text();
const squads = parseSquads(sourceText, teams);
const report = { year: 2002, source: SOURCE_URL, generatedAt: new Date().toISOString(), teams: [], summary: {} };

for (const team of teams) {
  const sourceNames = squads.get(team.id) || [];
  const datasetNames = team.players.map(player => player.name);
  const sourceSet = new Set(sourceNames.map(name => normalize(name)));
  const datasetSet = new Set(datasetNames.map(name => normalize(name)));
  const matched = [];
  const missingFromSource = [];
  const missingFromDataset = [];
  for (const player of datasetNames) {
    const key = normalize(player);
    if (sourceSet.has(key)) matched.push({ datasetName: player, sourceName: sourceNames.find(name => normalize(name) === key) });
    else {
      const alias = playerAliases.get(normalize(team.name) + "|" + key);
      if (alias && sourceSet.has(alias)) matched.push({ datasetName: player, sourceName: sourceNames.find(name => normalize(name) === alias), match: "manual-alias" });
      else missingFromSource.push(player);
    }
  }
  for (const name of sourceNames) {
    const key = normalize(name);
    if (!datasetSet.has(key) && !matched.some(row => normalize(row.sourceName) === key)) missingFromDataset.push(name);
  }
  report.teams.push({
    teamId: team.id, teamName: team.name,
    sourcePlayerCount: sourceNames.length, datasetPlayerCount: datasetNames.length,
    matchedCount: matched.length, missingFromSource, missingFromDataset,
    sourceComplete: sourceNames.length === 23,
    rosterClean: sourceNames.length === 23 && matched.length === 23 && missingFromSource.length === 0 && missingFromDataset.length === 0,
    matched
  });
}

report.summary = {
  expectedTeams: 32, parsedTeams: squads.size,
  teamsWith23SourcePlayers: report.teams.filter(team => team.sourceComplete).length,
  fullyMatchedTeams: report.teams.filter(team => team.rosterClean).length,
  sourcePlayers: report.teams.reduce((sum, team) => sum + team.sourcePlayerCount, 0),
  datasetPlayers: report.teams.reduce((sum, team) => sum + team.datasetPlayerCount, 0),
  matchedPlayers: report.teams.reduce((sum, team) => sum + team.matchedCount, 0),
  unresolvedDifferences: report.teams.reduce((sum, team) => sum + team.missingFromSource.length + team.missingFromDataset.length, 0)
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/2002-roster-audit.json", JSON.stringify(report, null, 2) + "\\n");
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.parsedTeams !== 32 || report.summary.sourcePlayers !== 736) {
  throw new Error("2002 source parser did not account for all 32 squads and 736 players");
}
