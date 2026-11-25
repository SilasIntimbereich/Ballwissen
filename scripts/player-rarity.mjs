import { assignRosterRarities } from "../assets/js/rarity.js";

export const normalizePlayerName = value => String(value || "")
  .replace(/[æÆ]/g, "ae").replace(/[œŒ]/g, "oe").replace(/[øØ]/g, "o")
  .replace(/[łŁ]/g, "l").replace(/[ßẞ]/g, "ss").replace(/[đĐðÐ]/g, "d")
  .replace(/[þÞ]/g, "th").replace(/[ıİ]/g, "i")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[’']/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const slug = value => normalizePlayerName(value).replace(/ /g, "-");
export const teamIdFor2026 = teamName => slug(teamName) + "-2026";

function tierFor(teamName, difficulty) {
  for (const [tier, names] of Object.entries(difficulty?.tiers || {})) {
    if (names.includes(teamName)) return tier;
  }
  return "niche";
}

// The audit ledger is the single source of truth for whether a squad may receive a rarity.
export function createPlayerRarityResolver(historical, worldCup2026, difficulty, audit = { teams: {} }) {
  const rosters = { teams: [] };
  const metadata = [];
  const verifiedIds = new Set();

  for (const [year, teams] of Object.entries(historical?.tournaments || {})) {
    for (const team of teams) {
      const id = team.id || (slug(team.name) + "-" + year);
      rosters.teams.push({ id, players: (team.players || []).map(player => ({ ...player })) });
      const verified = audit?.teams?.[id]?.status === "verified";
      if (verified) verifiedIds.add(id);
      metadata.push({ id, year: Number(year), verified, teamDifficulty: team.teamDifficulty || tierFor(team.name, difficulty) });
    }
  }

  const grouped2026 = new Map();
  for (const player of worldCup2026?.players || []) {
    const teamName = player.team;
    if (!grouped2026.has(teamName)) grouped2026.set(teamName, []);
    grouped2026.get(teamName).push({
      name: player.name || player.player,
      position: player.position || player.pos,
      number: player.number,
      aliases: player.aliases || []
    });
  }
  for (const [teamName, players] of grouped2026) {
    const id = teamIdFor2026(teamName);
    rosters.teams.push({ id, players });
    const verified = audit?.teams?.[id]?.status === "verified";
    if (verified) verifiedIds.add(id);
    metadata.push({ id, year: 2026, verified, teamDifficulty: tierFor(teamName, difficulty) });
  }

  assignRosterRarities(rosters, { teams: metadata });
  const byTeamAndName = new Map();
  for (const team of rosters.teams) {
    for (const player of team.players) {
      if (player.rarity) byTeamAndName.set(team.id + "|" + normalizePlayerName(player.name), player.rarity);
    }
  }

  return (player, teamId) => {
    if (!verifiedIds.has(teamId)) return null;
    const key = teamId + "|" + normalizePlayerName(player.name || player.player);
    const rarity = byTeamAndName.get(key);
    if (!rarity) throw new Error("No rarity assignment for verified player " + key);
    return rarity;
  };
}
