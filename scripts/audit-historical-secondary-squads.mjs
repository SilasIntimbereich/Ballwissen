import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";
import { parseWikipediaSquads, normalizeHistoricalClub } from "./historical-wikipedia-squads.mjs";

const sources = {
  2010: "https://en.wikipedia.org/wiki/2010_FIFA_World_Cup_squads",
  2014: "https://en.wikipedia.org/wiki/2014_FIFA_World_Cup_squads",
  2018: "https://en.wikipedia.org/wiki/2018_FIFA_World_Cup_squads"
};
const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const candidates = JSON.parse(await readFile("artifacts/historical-club-candidates.json", "utf8"));
const report = {
  generatedAt: new Date().toISOString(),
  sourceDescription: "Independent secondary squad tables cross-checked against the FIFA final squad-list candidates. Disagreements remain unverified.",
  tournaments: {},
  summary: {}
};

for (const [year, sourceUrl] of Object.entries(sources)) {
  const teams = historical.tournaments[year] || [];
  const candidateTeams = candidates.tournaments[year] || [];
  const yearReport = {
    year: Number(year), source: sourceUrl, sourceStatus: "available", teams: [], summary: {}
  };
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (roster cross-check)" },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const parsed = parseWikipediaSquads(await response.text(), teams);

    for (const team of teams) {
      const rows = parsed.get(team.id) || [];
      const candidateTeam = candidateTeams.find(item => item.id === team.id);
      const players = team.players || [];
      const rowsByNumber = new Map(rows.map(row => [row.number, row]));
      const item = {
        teamId: team.id, teamName: team.name,
        sourcePlayerCount: rows.length, datasetPlayerCount: players.length,
        matchedPlayers: 0, clubMatches: 0, clubMismatches: [],
        nameMismatches: [], missingRows: [], missingClubs: [],
        positionDifferences: []
      };

      for (const player of players) {
        const number = Number(player.number);
        const row = rowsByNumber.get(number);
        if (!row) {
          item.missingRows.push({ number, datasetName: player.name });
          continue;
        }
        if (!namesMatch(player.name, row.name)) {
          item.nameMismatches.push({ number, datasetName: player.name, sourceName: row.name });
          continue;
        }
        item.matchedPlayers++;
        if (player.position && row.position && player.position !== row.position) {
          item.positionDifferences.push({ number, player: player.name, datasetPosition: player.position, sourcePosition: row.position });
        }
        const fifaPlayer = candidateTeam?.players?.find(entry => Number(entry.number) === number);
        const fifaClub = fifaPlayer?.club || "";
        if (!fifaClub || !row.club) {
          item.missingClubs.push({ number, player: player.name, fifaClub: fifaClub || null, secondaryClub: row.club || null });
          continue;
        }
        if (normalizeHistoricalClub(fifaClub) === normalizeHistoricalClub(row.club)) {
          item.clubMatches++;
        } else {
          item.clubMismatches.push({ number, player: player.name, fifaClub, secondaryClub: row.club,
            canonicalFifaClub: normalizeHistoricalClub(fifaClub), canonicalSecondaryClub: normalizeHistoricalClub(row.club) });
        }
      }

      const matchedSourceNumbers = new Set(players.map(player => Number(player.number)));
      for (const row of rows) {
        if (!matchedSourceNumbers.has(row.number)) item.missingRows.push({ number: row.number, sourceName: row.name });
      }
      item.rosterClean = rows.length === 23 && item.matchedPlayers === players.length &&
        item.nameMismatches.length === 0 && item.missingRows.length === 0;
      item.clubsClean = item.rosterClean && item.clubMatches === players.length &&
        item.clubMismatches.length === 0 && item.missingClubs.length === 0;
      item.fullyCrossChecked = item.clubsClean;
      yearReport.teams.push(item);
    }

    yearReport.summary = {
      expectedTeams: 32,
      parsedTeams: parsed.size,
      teamsWith23SourcePlayers: yearReport.teams.filter(team => team.sourcePlayerCount === 23).length,
      rosterCleanTeams: yearReport.teams.filter(team => team.rosterClean).length,
      clubsCleanTeams: yearReport.teams.filter(team => team.clubsClean).length,
      fullyCrossCheckedTeams: yearReport.teams.filter(team => team.fullyCrossChecked).length,
      sourcePlayers: yearReport.teams.reduce((sum, team) => sum + team.sourcePlayerCount, 0),
      matchedPlayers: yearReport.teams.reduce((sum, team) => sum + team.matchedPlayers, 0),
      clubMatches: yearReport.teams.reduce((sum, team) => sum + team.clubMatches, 0),
      clubMismatches: yearReport.teams.reduce((sum, team) => sum + team.clubMismatches.length, 0),
      nameMismatches: yearReport.teams.reduce((sum, team) => sum + team.nameMismatches.length, 0),
      missingRows: yearReport.teams.reduce((sum, team) => sum + team.missingRows.length, 0),
      missingClubs: yearReport.teams.reduce((sum, team) => sum + team.missingClubs.length, 0),
      positionDifferences: yearReport.teams.reduce((sum, team) => sum + team.positionDifferences.length, 0)
    };
  } catch (error) {
    yearReport.sourceStatus = "unavailable";
    yearReport.sourceError = String(error);
    yearReport.summary = {
      expectedTeams: 32, parsedTeams: 0, teamsWith23SourcePlayers: 0,
      rosterCleanTeams: 0, clubsCleanTeams: 0, fullyCrossCheckedTeams: 0,
      sourcePlayers: 0, matchedPlayers: 0, clubMatches: 0,
      clubMismatches: 0, nameMismatches: 0, missingRows: 0,
      missingClubs: 0, positionDifferences: 0
    };
  }
  report.tournaments[year] = yearReport;
}

report.summary = {
  tournaments: Object.keys(sources).length,
  teams: Object.values(report.tournaments).reduce((sum, item) => sum + item.teams.length, 0),
  fullyCrossCheckedTeams: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.fullyCrossCheckedTeams || 0), 0),
  clubMismatches: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.clubMismatches || 0), 0),
  nameMismatches: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.nameMismatches || 0), 0),
  unavailableSources: Object.values(report.tournaments).filter(item => item.sourceStatus !== "available").length
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/historical-secondary-squad-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
