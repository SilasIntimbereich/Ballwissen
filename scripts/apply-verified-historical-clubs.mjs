import { readFile, writeFile, mkdir } from "node:fs/promises";

const dataset = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const candidates = JSON.parse(await readFile("artifacts/historical-club-candidates.json", "utf8"));
const fifaAudit = JSON.parse(await readFile("artifacts/historical-fifa-audit.json", "utf8"));
const secondaryAudit = JSON.parse(await readFile("artifacts/historical-secondary-squad-audit.json", "utf8"));
const audit2022 = JSON.parse(await readFile("artifacts/2022-independent-club-audit.json", "utf8"));
const report = {
  generatedAt: new Date().toISOString(),
  rule: "Apply club and position values only when FIFA primary roster data and an independent secondary squad archive agree for every player in the team.",
  appliedTeams: [],
  skippedTeams: [],
  summary: {}
};
let changed = false;

function applyTeam(year, teamId, sourceTeam, candidatePlayers, sourceDescription) {
  const dataTeam = dataset.tournaments[String(year)]?.find(team => team.id === teamId);
  if (!dataTeam) {
    report.skippedTeams.push({ year, teamId, reason: "Team not found in historical dataset" });
    return;
  }
  const byNumber = new Map(candidatePlayers.map(player => [Number(player.number), player]));
  const updates = [];
  for (const player of dataTeam.players || []) {
    const candidate = byNumber.get(Number(player.number));
    if (!candidate || !candidate.club || !candidate.position) {
      report.skippedTeams.push({ year, teamId, teamName: dataTeam.name,
        reason: "Not every player has a FIFA club and position candidate" });
      return;
    }
    updates.push({ player, candidate });
  }
  if (updates.length !== dataTeam.players.length) {
    report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "Player count mismatch" });
    return;
  }
  let playerUpdates = 0;
  for (const { player, candidate } of updates) {
    if (player.club !== candidate.club || player.position !== candidate.position) playerUpdates++;
    player.club = candidate.club;
    player.position = candidate.position;
  }
  if (playerUpdates) changed = true;
  report.appliedTeams.push({
    year, teamId, teamName: dataTeam.name, playerCount: updates.length,
    playerRowsUpdated: playerUpdates, sources: sourceDescription
  });
}

for (const year of ["2010", "2014", "2018"]) {
  const yearAudit = secondaryAudit.tournaments?.[year];
  const candidateTeams = candidates.tournaments?.[year] || [];
  for (const teamAudit of yearAudit?.teams || []) {
    if (!teamAudit.fullyCrossChecked) {
      report.skippedTeams.push({ year: Number(year), teamId: teamAudit.teamId, teamName: teamAudit.teamName,
        reason: "Independent secondary roster/club audit did not fully agree" });
      continue;
    }
    const candidateTeam = candidateTeams.find(team => team.id === teamAudit.teamId);
    if (!candidateTeam) {
      report.skippedTeams.push({ year: Number(year), teamId: teamAudit.teamId, reason: "FIFA candidate team missing" });
      continue;
    }
    applyTeam(Number(year), teamAudit.teamId, teamAudit, candidateTeam.players || [],
      ["FIFA final squad-list PDF", yearAudit.source]);
  }
}

const fifa2022 = fifaAudit.tournaments?.find(tournament => Number(tournament.year) === 2022);
for (const teamAudit of audit2022.teams || []) {
  if (!teamAudit.fullyCrossChecked) {
    report.skippedTeams.push({ year: 2022, teamId: teamAudit.teamId, teamName: teamAudit.teamName,
      reason: "FIFA/independent 2022 club audit did not fully agree" });
    continue;
  }
  const fifaTeam = fifa2022?.teams?.find(team => team.teamId === teamAudit.teamId);
  if (!fifaTeam || !fifaTeam.rosterIdentityClean) {
    report.skippedTeams.push({ year: 2022, teamId: teamAudit.teamId, teamName: teamAudit.teamName,
      reason: "FIFA player identity audit did not pass" });
    continue;
  }
  const candidatePlayers = (fifaTeam.candidates || [])
    .filter(player => player.status === "matched" && player.clubAtTournament)
    .map(player => ({ number: player.number, club: player.clubAtTournament, position: player.position }));
  applyTeam(2022, teamAudit.teamId, teamAudit, candidatePlayers,
    ["FIFA final squad-list PDF", "FootballSquads independent archive"]);
}

await mkdir("artifacts", { recursive: true });
if (changed) await writeFile("data/historical-squads.json", JSON.stringify(dataset, null, 2) + "\n");
report.summary = {
  appliedTeams: report.appliedTeams.length,
  skippedTeams: report.skippedTeams.length,
  playerRowsUpdated: report.appliedTeams.reduce((sum, team) => sum + team.playerRowsUpdated, 0),
  dataFileChanged: changed
};
await writeFile("artifacts/verified-historical-club-application.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
