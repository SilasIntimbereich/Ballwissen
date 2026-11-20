import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";
import { parseFifa2002Roster, isCleanFifa2002RosterAudit } from "./historical-fifa-roster-2002.mjs";

const SOURCE_URL = "https://www.lacancha.com/Roster.html";
const SOURCE_NOTE = "A third-party page reproduces a roster release dated 24 May 2002; this is not a direct FIFA-hosted document and it predates late tournament replacements. Treat it only as a supplementary identity/number/position cross-check, never as final-roster authority. Club affiliations are not taken from this page.";
const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const teams = historical.tournaments["2002"] || [];
const report = {
  year: 2002, source: SOURCE_URL, sourceNote: SOURCE_NOTE,
  sourceStatus: "available", generatedAt: new Date().toISOString(),
  teams: [], summary: {}
};

try {
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (FIFA roster cross-check)" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const parsed = parseFifa2002Roster(await response.text(), teams);
  if (parsed.size !== teams.length) {
    report.sourceStatus = "partial";
    report.sourceError = "The page loaded, but the parser extracted " + parsed.size + " of " + teams.length + " team rosters; this supplementary source is not used as verification evidence.";
  }

  for (const team of teams) {
    const rows = parsed.get(team.id) || [];
    const players = team.players || [];
    const used = new Set();
    const item = {
      teamId: team.id, teamName: team.name,
      sourcePlayerCount: rows.length, datasetPlayerCount: players.length,
      matchedPlayers: 0, numberMatches: 0, positionDifferences: [],
      nameMismatches: [], missingFromSource: [], missingFromDataset: []
    };

    for (const player of players) {
      const number = Number(player.number);
      let rowIndex = rows.findIndex((row, index) => !used.has(index) && row.number !== null && row.number === number);
      if (rowIndex >= 0 && !namesMatch(player.name, rows[rowIndex].name)) {
        item.nameMismatches.push({ number, datasetName: player.name, sourceName: rows[rowIndex].name });
        continue;
      }
      if (rowIndex < 0) {
        rowIndex = rows.findIndex((row, index) => !used.has(index) && row.number === null && namesMatch(player.name, row.name));
      }
      if (rowIndex < 0) {
        item.missingFromSource.push({ number, datasetName: player.name });
        continue;
      }
      const row = rows[rowIndex];
      used.add(rowIndex);
      item.matchedPlayers++;
      if (row.number !== null) item.numberMatches++;
      if (player.position && row.position && player.position !== row.position) {
        item.positionDifferences.push({ number, player: player.name, datasetPosition: player.position, sourcePosition: row.position });
      }
    }

    rows.forEach((row, index) => {
      if (!used.has(index)) item.missingFromDataset.push({ number: row.number, sourceName: row.name });
    });
    item.rosterClean = isCleanFifa2002RosterAudit({
      ...item,
      sourcePlayerCount: rows.length
    }, players.length);
    report.teams.push(item);
  }

  report.summary = {
    expectedTeams: 32, parsedTeams: parsed.size,
    teamsWith23SourcePlayers: report.teams.filter(team => team.sourcePlayerCount === 23).length,
    fullyMatchedTeams: report.teams.filter(team => team.rosterClean).length,
    sourcePlayers: report.teams.reduce((sum, team) => sum + team.sourcePlayerCount, 0),
    matchedPlayers: report.teams.reduce((sum, team) => sum + team.matchedPlayers, 0),
    numberMatches: report.teams.reduce((sum, team) => sum + team.numberMatches, 0),
    nameMismatches: report.teams.reduce((sum, team) => sum + team.nameMismatches.length, 0),
    missingFromSource: report.teams.reduce((sum, team) => sum + team.missingFromSource.length, 0),
    missingFromDataset: report.teams.reduce((sum, team) => sum + team.missingFromDataset.length, 0),
    positionDifferences: report.teams.reduce((sum, team) => sum + team.positionDifferences.length, 0)
  };
} catch (error) {
  report.sourceStatus = "unavailable";
  report.sourceError = String(error);
  report.summary = {
    expectedTeams: 32, parsedTeams: 0, teamsWith23SourcePlayers: 0,
    fullyMatchedTeams: 0, sourcePlayers: 0, matchedPlayers: 0,
    numberMatches: 0, nameMismatches: 0, missingFromSource: 0,
    missingFromDataset: 0, positionDifferences: 0
  };
}

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/2002-fifa-roster-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ sourceStatus: report.sourceStatus, ...report.summary }, null, 2));
