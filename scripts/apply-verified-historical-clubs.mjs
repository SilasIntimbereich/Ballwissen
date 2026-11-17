import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";
import { normalizeHistoricalClub } from "./historical-wikipedia-squads.mjs";

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
  rule: "Only complete player-by-player identity, club and position agreement across at least two independent HTTPS sources is applied. Incomplete evidence never overwrites existing squad data.",
  appliedTeams: [],
  skippedTeams: [],
  clearedTeams: [],
  summary: {}
};
let dataChanged = false;
let ledgerChanged = false;

const normalizePosition = value => {
  const position = String(value || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return position === "MD" ? "MF" : position;
};
const normalizeName = value => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const validHttps = value => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

function ledgerIsVerified(team) {
  const entry = rosterAudit.teams?.[team.id];
  const heading = entry?.teamNameInFifaPdf || entry?.teamNameInPrimarySource;
  return entry?.status === "verified" &&
    entry.tournament === team.year &&
    entry.teamNameInDataset === team.name &&
    typeof heading === "string" && heading.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || "") &&
    Array.isArray(entry.players) &&
    entry.players.length === (team.players || []).length &&
    entry.players.every(row =>
      ["matched", "corrected"].includes(row.status) &&
      typeof row.sourceName === "string" && row.sourceName.trim() &&
      typeof row.clubAtTournament === "string" && row.clubAtTournament.trim() &&
      typeof row.position === "string" && row.position.trim() &&
      validHttps(row.primarySource || entry.primarySource) &&
      validHttps(row.secondarySource || entry.secondarySource)
    );
}

function applyTeam(year, teamId, candidatePlayers, sources, evidencePlayers, fifaHeading, primaryHeading) {
  const dataTeam = dataset.tournaments[String(year)]?.find(team => team.id === teamId);
  if (!dataTeam) {
    report.skippedTeams.push({ year, teamId, reason: "Team not found in historical dataset" });
    return;
  }
  const sourceList = [...new Set((sources || []).filter(value => typeof value === "string" && value.trim() && validHttps(value)))];
  if (sourceList.length < 2) {
    report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "At least two independent HTTPS sources are required" });
    return;
  }

  const candidateRows = Array.isArray(candidatePlayers) ? candidatePlayers : [];
  const evidenceRows = Array.isArray(evidencePlayers) ? evidencePlayers : [];
  const candidateByNumber = new Map(candidateRows.map(player => [Number(player.number), player]));
  const evidenceByNumber = new Map(evidenceRows.map(player => [Number(player.number), player]));
  if (candidateByNumber.size !== candidateRows.length || evidenceByNumber.size !== evidenceRows.length ||
      candidateRows.length !== dataTeam.players.length || evidenceRows.length !== dataTeam.players.length) {
    report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "Candidate/evidence rows are incomplete or contain duplicate shirt numbers" });
    return;
  }

  const updates = [];
  for (const player of dataTeam.players || []) {
    const number = Number(player.number);
    const candidate = candidateByNumber.get(number);
    const evidence = evidenceByNumber.get(number);
    if (!candidate || !evidence || evidence.identityMatches === false) {
      report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "A player is missing a positive identity cross-check" });
      return;
    }

    const wikiName = evidence.wikipediaName || evidence.sourceName || evidence.secondaryName;
    const planetName = evidence.planetName || evidence.secondaryName || evidence.sourceName;
    const hasIndependentIdentity = evidence.identityMatches === true ||
      (wikiName && planetName && namesMatch(player.name, wikiName) && namesMatch(player.name, planetName));
    const clubA = evidence.wikipediaClub || evidence.fifaClub;
    const clubB = evidence.planetClub || evidence.secondaryClub;
    const clubMatches = evidence.clubMatches === true ||
      Boolean(clubA && clubB && normalizeHistoricalClub(clubA) &&
        normalizeHistoricalClub(clubA) === normalizeHistoricalClub(clubB));
    const positionA = normalizePosition(evidence.wikipediaPosition || evidence.fifaPosition);
    const positionB = normalizePosition(evidence.planetPosition || evidence.secondaryPosition);
    const positionMatches = evidence.positionMatches === true ||
      Boolean(positionA && positionB && positionA === positionB);
    const club = evidence.planetClub || evidence.secondaryClub || candidate.clubAtTournament || candidate.club;
    const position = evidence.planetPosition || evidence.secondaryPosition || candidate.position;
    if (!hasIndependentIdentity || !clubMatches || !positionMatches ||
        typeof club !== "string" || !club.trim() ||
        typeof position !== "string" || !normalizePosition(position)) {
      report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "Player identity, club or position did not agree across sources" });
      return;
    }

    const candidateSourceName = candidate.sourceName || candidate.name;
    if (candidateSourceName && evidence.identityMatches !== true && !namesMatch(player.name, candidateSourceName)) {
      report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "FIFA candidate name conflicts with the independent player identity checks" });
      return;
    }
    const sourceName = candidateSourceName && (namesMatch(player.name, candidateSourceName) || evidence.identityMatches === true)
      ? candidateSourceName
      : planetName || wikiName || player.name;
    if (!sourceName) {
      report.skippedTeams.push({ year, teamId, teamName: dataTeam.name, reason: "A source display name is missing" });
      return;
    }
    updates.push({
      player,
      number,
      sourceName,
      club: club.trim(),
      position: normalizePosition(position),
      status: normalizeName(sourceName) === normalizeName(player.name) ? "matched" : "corrected"
    });
  }

  const prior = rosterAudit.teams[teamId] || {};
  const priorRows = Array.isArray(prior.players) ? prior.players : [];
  const priorByNumber = new Map(priorRows.map(row => [Number(row.number), row]));
  const ledgerRows = updates.map(({ player, number, sourceName, club, position, status }) => {
    const priorRow = priorByNumber.get(number) || {};
    return {
      ...priorRow,
      number,
      playerName: player.name,
      sourceName,
      sourceNameAliases: [...new Set([player.name, ...(priorRow.sourceNameAliases || [])])],
      status,
      position,
      clubAtTournament: club,
      primarySource: sourceList[0],
      secondarySource: sourceList[1]
    };
  });

  let playerUpdates = 0;
  for (const { player, club, position } of updates) {
    if (player.club !== club || player.position !== position) playerUpdates++;
    player.club = club;
    player.position = position;
    delete player.clubSource;
    delete player.positionSource;
  }
  if (playerUpdates) dataChanged = true;

  const teamNameInFifaPdf = fifaHeading || prior.teamNameInFifaPdf || null;
  rosterAudit.teams[teamId] = {
    ...prior,
    status: "verified",
    tournament: Number(year),
    teamNameInDataset: dataTeam.name,
    ...(teamNameInFifaPdf ? { teamNameInFifaPdf } : { teamNameInPrimarySource: primaryHeading || dataTeam.name }),
    reviewedAt: new Date().toISOString().slice(0, 10),
    primarySource: sourceList[0],
    secondarySource: sourceList[1],
    additionalSources: sourceList.slice(2),
    players: ledgerRows
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
    const fifaTeam = fifaTournament?.teams?.find(team => team.teamId === teamAudit.teamId);
    const fifaHeading = teamAudit.fifaPdfAgreement !== "unavailable" ? fifaTeam?.pdfHeading : null;
    const sources = [teamAudit.planetSource, yearAudit.source];
    if (fifaHeading && fifaTournament?.url) sources.push(fifaTournament.url);
    applyTeam(Number(year), teamAudit.teamId, candidateTeam.players || [], sources,
      teamAudit.playerChecks || [], fifaHeading, teamAudit.teamName);
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
    report.skippedTeams.push({ year: 2002, teamId: teamAudit.teamId, reason: "Verified 2002 club candidate team missing" });
    continue;
  }
  applyTeam(2002, teamAudit.teamId, candidateTeam.players || [],
    [teamAudit.planetSource, "https://en.wikipedia.org/wiki/2002_FIFA_World_Cup_squads", "https://raw.githubusercontent.com/rsssf/tables/master/tables/2002full.txt"],
    teamAudit.playerChecks || [], null, teamAudit.teamName);
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
    .map(player => ({
      number: player.number,
      sourceName: player.sourceName,
      clubAtTournament: player.clubAtTournament,
      position: player.position
    }));
  const evidencePlayers = (teamAudit.comparisons || []).map(comparison => ({
    ...comparison,
    identityMatches: comparison.identityMatches === true,
    sourceName: fifaTeam.candidates?.find(player => Number(player.number) === Number(comparison.number))?.sourceName
  }));
  applyTeam(2022, teamAudit.teamId, candidatePlayers, [
    fifaTournamentSource(fifaAudit),
    "https://www.footballsquads.co.uk/national/worldcup/wc2022.htm"
  ], evidencePlayers, fifaTeam.pdfHeading || null, teamAudit.teamName);
}

function fifaTournamentSource(audit) {
  return audit.tournaments?.find(tournament => Number(tournament.year) === 2022)?.url ||
    "https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf";
}

// Remove unverified club hints rather than presenting them as tournament-time facts.
for (const [year, teams] of Object.entries(dataset.tournaments || {})) {
  for (const team of teams || []) {
    if (ledgerIsVerified({ ...team, year: Number(year) })) continue;
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
