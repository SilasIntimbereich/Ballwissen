import { hasIndependentHttpsSources, isHttpsUrl } from "./source-url-validation.mjs";
import { namesMatch } from "./historical-player-name-match.mjs";

const normalize = value => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function isVerifiedPlayerSourceName(player, row) {
  if (!player || !row || typeof row.sourceName !== "string" || !row.sourceName.trim()) return false;
  if (namesMatch(player.name, row.sourceName)) return true;
  const aliases = Array.isArray(row.sourceNameAliases) ? row.sourceNameAliases : [];
  const hasCanonicalName = aliases.some(alias => normalize(alias) === normalize(player.name));
  const hasSourceName = aliases.some(alias => normalize(alias) === normalize(row.sourceName));
  return hasCanonicalName && hasSourceName && isHttpsUrl(row.sourceNameAliasEvidenceUrl);
}

export function isCompleteVerifiedRosterLedger(team, entry, expectedYear) {
  if (!team || !entry || entry.status !== "verified") return false;
  const year = expectedYear ?? team.year;
  const heading = entry.teamNameInFifaPdf || entry.teamNameInPrimarySource;
  if (Number(entry.tournament) !== Number(year) ||
      entry.teamNameInDataset !== team.name ||
      typeof heading !== "string" || !heading.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || "")) return false;

  const players = Array.isArray(team.players) ? team.players : [];
  const rows = Array.isArray(entry.players) ? entry.players : [];
  if (!players.length || rows.length !== players.length) return false;

  const rowKeys = rows.map(row => Number(row.number));
  if (rowKeys.some(number => !Number.isInteger(number)) ||
      new Set(rowKeys).size !== players.length) return false;

  return players.every(player => {
    const row = rows.find(candidate =>
      Number(candidate.number) === Number(player.number) &&
      normalize(candidate.playerName) === normalize(player.name)
    );
    return Boolean(row &&
      ["matched", "corrected"].includes(row.status) &&
      isVerifiedPlayerSourceName(player, row) &&
      typeof row.clubAtTournament === "string" && row.clubAtTournament.trim() &&
      row.position === player.position &&
      (player.club ?? null) === row.clubAtTournament &&
      hasIndependentHttpsSources([
        row.primarySource || entry.primarySource,
        row.secondarySource || entry.secondarySource
      ])
    );
  });
}
