import { readFile } from "node:fs/promises";
const read = async path => JSON.parse(await readFile(path, "utf8"));
const fail = message => { throw new Error(message); };
const positions = new Set(["GK", "DF", "MF", "FW"]);

const wc = await read("data/worldcup-2026.json");
if (wc.players.length !== 1248) fail("2026: expected 1,248 players, got " + wc.players.length);
const teams = new Map();
for (const p of wc.players) {
  if (!p.name?.trim() || !p.team?.trim() || !p.club?.trim() || !p.position || !positions.has(p.position))
    fail("2026: incomplete or invalid player row: " + JSON.stringify(p));
  if (!Number.isInteger(Number(p.number)) || Number(p.number) < 1 || Number(p.number) > 99)
    fail("2026: invalid shirt number for " + p.name);
  if (!teams.has(p.team)) teams.set(p.team, []);
  teams.get(p.team).push(p);
}
if (teams.size !== 48) fail("2026: expected 48 teams, got " + teams.size);
for (const [team, players] of teams) {
  if (players.length !== 26) fail("2026: " + team + " has " + players.length + " entries, expected 26.");
  const numbers = players.map(p => Number(p.number));
  if (new Set(numbers).size !== numbers.length) fail("2026: duplicate shirt number in " + team);
}

const difficulty = await read("data/team-difficulty.json");
const tierEntries = Object.entries(difficulty.tiers || {});
const tierNames = tierEntries.flatMap(([, names]) => names);
if (new Set(tierNames).size !== tierNames.length)
  fail("A national team is assigned to more than one difficulty tier.");

const hist = await read("data/historical-squads.json");
const dailyExclusions = await read("data/daily-exclusions.json");
const audit = await read("data/roster-audit.json");
if (audit.schemaVersion !== 1 || !audit.teams || typeof audit.teams !== "object")
  fail("Invalid player-level roster audit ledger.");
let historicalPlayers = 0;
for (const year of [2002, 2006, 2010, 2014, 2018, 2022]) {
  const list = hist.tournaments?.[year];
  if (!list || list.length !== 32) fail(year + ": expected 32 teams.");
  const teamNames = new Set();
  for (const team of list) {
    if (teamNames.has(team.name)) fail(year + ": duplicate team " + team.name);
    teamNames.add(team.name);
    const count = team.players.length;
    if (year < 2022 && count !== 23)
      fail(year + " " + team.name + ": expected 23 players, got " + count);
    if (year === 2022 && (count < 25 || count > 26))
      fail(year + " " + team.name + ": invalid roster size " + count);
    const names = team.players.map(p => p.name?.trim());
    if (names.some(n => !n))
      fail(year + " " + team.name + ": empty player name.");
    if (names.some(n => /\bnot applicable\b/i.test(n)))
      fail(year + " " + team.name + ": source placeholder leaked into player name.");
    if (team.players.some(p => !positions.has(p.position)))
      fail(year + " " + team.name + ": missing or invalid player position.");
    const numbers = team.players.map(p => Number(p.number));
    if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > 99))
      fail(year + " " + team.name + ": invalid shirt number.");
    if (new Set(numbers).size !== numbers.length)
      fail(year + " " + team.name + ": duplicate shirt number.");
    const normalizedNames = new Map();
    for (const player of team.players) {
      const key = String(player.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!normalizedNames.has(key)) normalizedNames.set(key, []);
      normalizedNames.get(key).push(player);
    }
    for (const [key, sameName] of normalizedNames) {
      if (sameName.length < 2) continue;
      const knownNorthKoreaHomonym = team.id === "north-korea-2010" && key === "namcholpak" &&
        sameName.length === 2 && sameName.map(p => Number(p.number)).sort((a,b)=>a-b).join(",") === "4,14";
      if (!knownNorthKoreaHomonym)
        fail(year + " " + team.name + ": unexpected duplicate normalized player name " + key);
    }
    // Historical club values may be added only together with a complete team-level player audit.
    if (team.players.some(p => p.club) && audit.teams?.[team.id]?.status !== "verified")
      fail(year + " " + team.name + ": historical club data requires a complete independent player audit.");
    historicalPlayers += count;
  }
}
const historicalTeams = Object.values(hist.tournaments).flat();
const historicalById = new Map(historicalTeams.map(t => [t.id, t]));
if (dailyExclusions.count !== 50 || dailyExclusions.teams?.length !== 50)
  fail("Daily exclusions must contain exactly 50 squads.");
if (new Set(dailyExclusions.teams.map(t => t.id)).size !== 50)
  fail("Daily exclusion IDs must be unique.");
for (const excluded of dailyExclusions.teams) {
  const team = historicalById.get(excluded.id);
  if (!team) fail("Daily exclusion references unknown historical team: " + excluded.id);
  if (team.name !== excluded.name || team.year !== excluded.year)
    fail("Daily exclusion name/year mismatch: " + excluded.id);
}
const migration = await readText("supabase/migrations/202611160001_daily_squad_exclusions.sql");
for (const excluded of dailyExclusions.teams) {
  if (!migration.includes("'" + excluded.id + "'"))
    fail("Server-side Daily exclusion migration is missing " + excluded.id);
}
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const allTeams = [
  ...historicalTeams,
  ...[...teams.entries()].map(([name, players]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-2026",
    name, year: 2026, players
  }))
];
const allTeamsById = new Map(allTeams.map(t => [t.id, t]));
for (const [teamId, record] of Object.entries(audit.teams)) {
  if (record.status !== "verified") continue;
  const team = allTeamsById.get(teamId);
  if (!team) fail("Audit ledger marks an unknown team verified: " + teamId);
  if (!Array.isArray(record.players) || record.players.length !== team.players.length)
    fail("Verified audit row count mismatch: " + teamId);
  for (const player of team.players) {
    const row = record.players.find(r => Number(r.number) === Number(player.number) && normalize(r.playerName) === normalize(player.name));
    if (!row || !["matched", "corrected"].includes(row.status))
      fail("Verified audit contains missing/unresolved player: " + teamId + " / " + player.name);
    if (row.position !== player.position)
      fail("Verified audit position mismatch: " + teamId + " / " + player.name);
    if (!Object.hasOwn(row, "clubAtTournament") || (row.clubAtTournament ?? null) !== (player.club ?? null))
      fail("Verified audit club mismatch: " + teamId + " / " + player.name);
    const primary = row.primarySource || record.primarySource;
    const secondary = row.secondarySource || record.secondarySource;
    if (![primary, secondary].every(value => {
      try { return new URL(value).protocol === "https:"; } catch { return false; }
    })) fail("Verified audit requires primary and secondary HTTPS sources: " + teamId + " / " + player.name);
  }
}
const iran = hist.tournaments[2022].find(t => t.name === "Iran");
if (!iran || iran.players.length !== 25) fail("2022 Iran source roster check failed.");
const allTeamNames = new Set([
  ...historicalTeams.map(t => t.name),
  ...teams.keys()
]);
const unclassified = [...allTeamNames].filter(name => !tierNames.includes(name));
if (unclassified.length)
  fail("Missing team difficulty tier for: " + unclassified.join(", "));

async function readText(path) {
  return await readFile(path, "utf8");
}

console.log("Structural validation passed: 192 historical teams / " + historicalPlayers +
  " source-listed players; 48 teams / 1,248 rows in 2026; 50 exact Daily exclusions are present in both JSON and the server-side SQL migration.");
console.log("Historical clubs remain intentionally blank and all roster datasets remain unverified pending player-by-player independent audits.");
