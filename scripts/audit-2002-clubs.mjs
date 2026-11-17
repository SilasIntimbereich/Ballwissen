import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";
import { parseWikipediaSquads } from "./historical-wikipedia-squads.mjs";

const SOURCE_URL = "https://en.wikipedia.org/wiki/2002_FIFA_World_Cup_squads";
const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const candidateData = JSON.parse(await readFile("artifacts/historical-club-candidates.json", "utf8"));
const fifaRosterAudit = JSON.parse(await readFile("artifacts/2002-fifa-roster-audit.json", "utf8"));
const fifaVerifiedTeams = new Set((fifaRosterAudit.teams || []).filter(team => team.rosterClean).map(team => team.teamId));
const teams = historical.tournaments["2002"] || [];
const report = {
  year: 2002,
  source: SOURCE_URL,
  sourceDescription: "Secondary source listing club affiliations as of 31 May 2002; candidates only, not a verification approval.",
  sourceStatus: "available",
  generatedAt: new Date().toISOString(),
  teams: [],
  summary: {}
};

try {
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (roster cross-check)" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const html = await response.text();
  const parsed = parseWikipediaSquads(html, teams);
  const candidateTeams = candidateData.tournaments["2002"] || [];

  for (const team of teams) {
    const rows = parsed.get(team.id) || [];
    const candidateTeam = candidateTeams.find(item => item.id === team.id || item.teamId === team.id);
    const players = team.players || [];
    const rowsByNumber = new Map(rows.map(row => [row.number, row]));
    const item = {
      teamId: team.id,
      teamName: team.name,
      rosterIdentityVerified: fifaVerifiedTeams.has(team.id),
      sourcePlayerCount: rows.length,
      datasetPlayerCount: players.length,
      matchedPlayers: 0,
      clubsAssigned: 0,
      mismatches: [],
      positionDifferences: []
    };

    for (const player of players) {
      const row = rowsByNumber.get(Number(player.number));
      if (!row) {
        item.mismatches.push({ number: Number(player.number), field: "missing_source_row", player: player.name });
        continue;
      }
      if (!namesMatch(player.name, row.name)) {
        item.mismatches.push({ number: Number(player.number), field: "name", datasetName: player.name, sourceName: row.name });
        continue;
      }
      item.matchedPlayers++;
      if (row.position && player.position && row.position !== player.position) {
        item.positionDifferences.push({ number: Number(player.number), player: player.name, datasetPosition: player.position, sourcePosition: row.position });
      }
      const candidatePlayer = candidateTeam?.players?.find(entry => Number(entry.number) === Number(player.number));
      if (candidatePlayer && row.club && fifaVerifiedTeams.has(team.id)) {
        candidatePlayer.club = row.club;
        candidatePlayer.clubSource = SOURCE_URL;
        item.clubsAssigned++;
      } else if (!row.club) {
        item.mismatches.push({ number: Number(player.number), field: "missing_source_club", player: player.name });
      }
    }

    for (const row of rows) {
      if (!players.some(player => Number(player.number) === row.number)) {
        item.mismatches.push({ number: row.number, field: "extra_source_row", sourceName: row.name });
      }
    }
    item.rosterComplete = rows.length === 23 && item.matchedPlayers === players.length && item.mismatches.length === 0;
    item.clubCandidatesComplete = item.rosterIdentityVerified && item.rosterComplete && item.clubsAssigned === players.length;
    report.teams.push(item);
  }

  report.summary = {
    expectedTeams: 32,
    parsedTeams: parsed.size,
    fifaRosterVerifiedTeams: fifaVerifiedTeams.size,
    teamsWith23SourcePlayers: report.teams.filter(team => team.sourcePlayerCount === 23).length,
    rosterCleanTeams: report.teams.filter(team => team.rosterComplete).length,
    teamsWithAllClubCandidates: report.teams.filter(team => team.clubCandidatesComplete).length,
    sourcePlayers: report.teams.reduce((sum, team) => sum + team.sourcePlayerCount, 0),
    matchedPlayers: report.teams.reduce((sum, team) => sum + team.matchedPlayers, 0),
    clubCandidatesAssigned: report.teams.reduce((sum, team) => sum + team.clubsAssigned, 0),
    unresolvedMismatches: report.teams.reduce((sum, team) => sum + team.mismatches.length, 0),
    positionDifferences: report.teams.reduce((sum, team) => sum + team.positionDifferences.length, 0)
  };
  if (candidateTeams.length) {
    await writeFile("artifacts/historical-club-candidates.json", JSON.stringify(candidateData, null, 2) + "\n");
  }
} catch (error) {
  report.sourceStatus = "unavailable";
  report.sourceError = String(error);
  report.summary = {
    expectedTeams: 32, parsedTeams: 0, teamsWith23SourcePlayers: 0,
    rosterCleanTeams: 0, teamsWithAllClubCandidates: 0,
    sourcePlayers: 0, matchedPlayers: 0, clubCandidatesAssigned: 0,
    unresolvedMismatches: 0, positionDifferences: 0
  };
}

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/2002-club-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ sourceStatus: report.sourceStatus, ...report.summary }, null, 2));
