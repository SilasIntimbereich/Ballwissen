import { assignRosterRarities } from "../assets/js/rarity.js";

export const normalizePlayerName = value => String(value || "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const slug = value => normalizePlayerName(value).replace(/ /g, "-");
export const teamIdFor2026 = teamName => slug(teamName) + "-2026";

function tierFor(teamName, difficulty) {
  for (const [tier, names] of Object.entries(difficulty?.tiers || {})) {
    if (names.includes(teamName)) return tier;
  }
  return "niche";
}

// Server and browser use the exact same team-aware rarity algorithm.
// Team ID is part of the lookup because one player can have different recall difficulty across squads.
export function createPlayerRarityResolver(historical, worldCup2026, difficulty) {
  const rosters = { teams: [] };
  const metadata = [];
  for (const [year, teams] of Object.entries(historical?.tournaments || {})) {
    for (const team of teams) {
      const id = team.id || (slug(team.name) + "-" + year);
      rosters.teams.push({ id, players: (team.players || []).map(player => ({ ...player })) });
      metadata.push({ id, year: Number(year), teamDifficulty: team.teamDifficulty || tierFor(team.name, difficulty) });
    }
  }
  const grouped2026 = new Map();
  for (const player of worldCup2026?.players || []) {
    const teamName = player.team;
    if (!grouped2026.has(teamName)) grouped2026.set(teamName, []);
    grouped2026.get(teamName).push({ name: player.name || player.player, position: player.position || player.pos, number: player.number, aliases: player.aliases || [] });
  }
  for (const [teamName, players] of grouped2026) {
    const id = teamIdFor2026(teamName);
    rosters.teams.push({ id, players });
    metadata.push({ id, year: 2026, teamDifficulty: tierFor(teamName, difficulty) });
  }
  assignRosterRarities(rosters, { teams: metadata });
  const byTeamAndName = new Map();
  for (const team of rosters.teams) {
    for (const player of team.players) byTeamAndName.set(team.id + "|" + normalizePlayerName(player.name), player.rarity);
  }
  return (player, teamId) => {
    const key = teamId + "|" + normalizePlayerName(player.name || player.player);
    const rarity = byTeamAndName.get(key);
    if (!rarity) throw new Error("No shared rarity assignment for " + key);
    return rarity;
  };
}
