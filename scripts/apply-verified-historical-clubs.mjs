import { readFile, writeFile, mkdir } from "node:fs/promises";

const dataset = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const candidates = JSON.parse(await readFile("artifacts/historical-club-candidates.json", "utf8"));
const rosterAudit = JSON.parse(await readFile("data/roster-audit.json", "utf8"));
const fifaAudit = JSON.parse(await readFile("artifacts/historical-fifa-audit.json", "utf8"));
const secondaryAudit = JSON.parse(await readFile("artifacts/historical-secondary-squad-audit.json", "utf8"));
const audit2022 = JSON.parse(await readFile("artifacts/2022-independent-club-audit.json", "utf8"));
const audit2002Clubs = JSON.parse(await readFile("artifacts/2002-club-audit.json", "utf8"));
rosterAudit.teams ||= {};

const report = {
  generatedAt: new Date().toISOString(),
  rule: "Only teams with complete player-by-player source agreement receive club and position data. Existing club values without a complete verified ledger entry are cleared. Available FIFA PDF candidates must not conflict with the independent archives.",
  appliedTeams: [],
  skippedTeams: [],
  clearedTeams: [],
  summary: {}
};
let dataChanged = false;
let ledgerChanged = false;

function ledgerIsVerified(team) {
  const entry = rosterAudit.teams?.[team.id];
  return entry?.status === "verified" &&
    Array.isArray(entry.players) &&
    entry.players.length === (team.players || []).length &&
    entry.players.every(row =>
      ["matched", "corrected"].includes(row.status) &&
      typeof row.clubAtTournament === "string" && row.clubAtTournament.trim()
    ) &&
    typeof entry.primarySource === "string" && entry.primarySource.trim() &&
    typeof entry.secondarySource === "string" && entry.secondarySource.trim();
}

function applyTeam(year, teamId, candidatePlayers, sources) {
  const dataTeam = dataset.tournaments[String(year)]?.find(team => team.id === teamId);
  if (!dataTeam) {
    report.skippedTeams.push({ year, teamId, reason: "Team not found in historical dataset" });
    return;
  }
  const byNumber = new Map(candidatePlayers.map(player => [Number(player.number), player]));
  const updates = [];
  for (const player of dataTeam.players || []) {
    const candidate = byNumber.get(Number(player.number));
    if (!candidate || typeof candidate.club !== "string" || !candidate.club.trim() ||
        typeof candidate.position !== "string" || !candidate.position.trim()) {
      report.skippedTeams.push({ year, teamId, teamName: dataTeam.name,
        reason: "Not every player has a verified club and position candidate" });
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
    delete player.clubSource;
    delete player.positionSource;
  }
  if (playerUpdates) dataChanged = true;

  const sourceList = sources.filter(value => typeof value === "string" && value.trim());
  const prior = rosterAudit.teams[teamId] || {};
  rosterAudit.teams[teamId] = {
    ...prior,
    status: "verified",
    primarySource: sourceList[0],
    secondarySource: sourceList.slice(1).join(" | "),
    players: updates.map(({ player }) => ({
      number: Number(player.number),
      name: player.name,
      status: "matched",
      clubAtTournament: player.club
    }))
  };
  ledgerChanged = true;

  report.appliedTeams.push({
    year, teamId, teamName: dataTeam.name, playerCount: updates.length,
    playerRowsUpdated: playerUpdates, sources: sourceList
  });
}

for (const year of ["2010", "2014", "2018"]) {
  const yearAudit = secondaryAudit.tournaments?.[year];
  const candidateTeams = candidates.tournaments?.[year] || [];
  const fifaTournament = fifaAudit.tournaments?.find(tournament => Number(tournament.year) === Number(year));
  for (const teamAudit of yearAudit?.teams || []) {
    if (!teamAudit.fullyCrossChecked) {
      report.skippedTeams.push({ year: Number(year), teamId: teamAudit.teamId, teamName: teamAudit.teamName,
        reason: "Independent squad, club or position archives did not fully agree" });
      continue;
    }
    const candidateTeam = candidateTeams.find(team => team.id === teamAudit.teamId);
    if (!candidateTeam) {
      report.skippedTeams.push({ year: Number(year), teamId: teamAudit.teamId, reason: "Verified candidate team missing" });
      continue;
    }
    const sources = [teamAudit.planetSource, yearAudit.source];
    if (teamAudit.fifaPdfAgreement !== "unavailable" && fifaTournament?.url) sources.push(fifaTournament.url);
    applyTeam(Number(year), teamAudit.teamId, candidateTeam.players || [], sources);
  }
}

for (const teamAudit of audit2002Clubs.teams || []) {
  if (!teamAudit.clubCandidatesComplete) {
    report.skippedTeams.push({ year: 2002, teamId: teamAudit.teamId, teamName: teamAudit.teamName,
      reason: "Final RSSSF roster, Planet World Cup and Wikipedia club/position checks did not all agree" });
    continue;
  }
  const candidateTeam = candidates.tournaments?.["2002"]?.find(team => team.id === teamAudit.teamId);
  if (!candidateTeam) {
    report.skippedTeams.push({ year: 2002, teamId: teamAudit.teamId, teamName: teamAudit.teamName,
      reason: "Verified 2002 club candidate team missing" });
    continue;
  }
  applyTeam(2002, teamAudit.teamId, candidateTeam.players || [],
    [teamAudit.planetSource, "https://en.wikipedia.org/wiki/2002_FIFA_World_Cup_squads", "https://raw.githubusercontent.com/rsssf/tables/master/tables/2002full.txt"]);
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
  applyTeam(2022, teamAudit.teamId, candidatePlayers, [
    fifaTournamentSource(fifaAudit),
    "https://www.footballsquads.co.uk/national/worldcup/wc2022.htm"
  ]);
}

function fifaTournamentSource(audit) {
  return audit.tournaments?.find(tournament => Number(tournament.year) === 2022)?.url ||
    "https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf";
}

// Clear historical club hints unless the team has a complete, source-backed audit ledger.
for (const [year, teams] of Object.entries(dataset.tournaments || {})) {
  for (const team of teams || []) {
    if (ledgerIsVerified(team)) continue;
    const rowsWithClubs = (team.players || []).filter(player => player.club);
    if (!rowsWithClubs.length) continue;
    for (const player of team.players || []) {
      delete player.club;
      delete player.clubSource;
      delete player.positionSource;
    }
    dataChanged = true;
    report.clearedTeams.push({
      year: Number(year), teamId: team.id, teamName: team.name,
      playerRowsCleared: rowsWithClubs.length,
      reason: "No complete verified player-level audit ledger entry"
    });
  }
}

await mkdir("artifacts", { recursive: true });
if (dataChanged) await writeFile("data/historical-squads.json", JSON.stringify(dataset, null, 2) + "\n");
if (ledgerChanged) await writeFile("data/roster-audit.json", JSON.stringify(rosterAudit, null, 2) + "\n");
report.summary = {
  appliedTeams: report.appliedTeams.length,
  skippedTeams: report.skippedTeams.length,
  clearedTeams: report.clearedTeams.length,
  playerRowsUpdated: report.appliedTeams.reduce((sum, team) => sum + team.playerRowsUpdated, 0),
  playerRowsCleared: report.clearedTeams.reduce((sum, team) => sum + team.playerRowsCleared, 0),
  dataFileChanged: dataChanged,
  auditLedgerChanged: ledgerChanged,
  verifiedLedgerTeams: Object.values(rosterAudit.teams).filter(entry => entry.status === "verified").length
};
await writeFile("artifacts/verified-historical-club-application.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
