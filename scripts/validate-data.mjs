import { readFile } from "node:fs/promises";
const read = async path => JSON.parse(await readFile(path, "utf8"));
const fail = message => { throw new Error(message); };
const positions = new Set(["GK", "DF", "MF", "FW"]);

const wc = await read("data/worldcup-2026.json");
if (wc.players.length !== 1248) fail("2026: expected 1,248 players, got " + wc.players.length);
const teams = new Map();
const teamCodes = new Map();
for (const p of wc.players) {
  if (!p.name?.trim() || !p.team?.trim() || !p.teamCode?.trim() || !p.club?.trim() || !p.position || !positions.has(p.position))
    fail("2026: incomplete or invalid player row: " + JSON.stringify(p));
  if (!Number.isInteger(Number(p.number)) || Number(p.number) < 1 || Number(p.number) > 99)
    fail("2026: invalid shirt number for " + p.name);
  if (!teams.has(p.team)) teams.set(p.team, []);
  teams.get(p.team).push(p);
  if (teamCodes.has(p.team) && teamCodes.get(p.team) !== p.teamCode) fail("2026: inconsistent FIFA team code for " + p.team);
  teamCodes.set(p.team, p.teamCode);
}
if (teams.size !== 48) fail("2026: expected 48 teams, got " + teams.size);
if (new Set(teamCodes.values()).size !== 48) fail("2026: FIFA team codes must be unique across all 48 teams.");
for (const [team, players] of teams) {
  if (players.length !== 26) fail("2026: " + team + " has " + players.length + " entries, expected 26.");
  const numbers = players.map(p => Number(p.number));
  if (new Set(numbers).size !== numbers.length) fail("2026: duplicate shirt number in " + team);
  const names = players.map(p => p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (new Set(names).size !== names.length) fail("2026: duplicate normalized player name in " + team);
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
    if (year === 2022 && count === 25 && team.name !== "Iran")
      fail("2022: only Iran should have a 25-player source list; found " + team.name);
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
const historicalIds = historicalTeams.map(t => t.id);
if (new Set(historicalIds).size !== historicalIds.length)
  fail("Historical team IDs must be unique across tournament editions.");
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
if (!migration.includes("create trigger enforce_daily_squad_exclusions") ||
    !migration.includes("Daily challenge cannot include excluded squad"))
  fail("Daily exclusion database trigger is missing.");
if (!migration.includes("daily_challenges_date_mode_team_unique_idx"))
  fail("Daily schedule must prevent duplicate teams within one mode/day.");
const dailyFunction = await readText("supabase/functions/daily-challenge/index.ts");
if (!dailyFunction.includes("daily_excluded_squads") || !dailyFunction.includes("excludedIds.has") ||
    !dailyFunction.includes("new Set(challenges.map(c=>c.team_id)).size!==3"))
  fail("Daily challenge API must fail closed for excluded or malformed schedules.");
const statisticsMigration = await readText("supabase/migrations/202611160002_statistics_integrity.sql");
if (!statisticsMigration.includes("order by bucket_start") ||
    !statisticsMigration.includes("count(*)-1") ||
    !statisticsMigration.includes("s.points desc,s.user_id"))
  fail("Statistics ordering, peer-percentile or deterministic leaderboard fix is missing.");
const atomicMigration = await readText("supabase/migrations/202611160003_atomic_game_actions.sql");
for (const functionName of ["record_daily_player_guess","complete_daily_team","record_normal_player_guess","finish_normal_game_session"]) {
  if (!atomicMigration.includes("function public." + functionName))
    fail("Atomic game-action database function is missing: " + functionName);
}
if (!atomicMigration.includes("normal_results_user_team_unique_idx") ||
    !atomicMigration.includes("on conflict(user_id,team_id) where user_id is not null"))
  fail("Normal-mode statistics must count one latest result per player and squad.");
const atomicChecks = [
  ["supabase/functions/daily-guess/index.ts","record_daily_player_guess"],
  ["supabase/functions/submit-daily/index.ts","complete_daily_team"],
  ["supabase/functions/normal-guess/index.ts","record_normal_player_guess"],
  ["supabase/functions/submit-normal-result/index.ts","finish_normal_game_session"]
];
for (const [path,functionName] of atomicChecks) {
  if (!(await readText(path)).includes('rpc("' + functionName + '"'))
    fail("Edge Function is not wired to atomic game action: " + path);
}
const edgeWiring = [
  ["supabase/functions/daily-guess/index.ts","record_daily_player_guess"],
  ["supabase/functions/submit-daily/index.ts","complete_daily_team"],
  ["supabase/functions/normal-guess/index.ts","record_normal_player_guess"],
  ["supabase/functions/submit-normal-result/index.ts","finish_normal_game_session"]
];
for (const [path,functionName] of edgeWiring) {
  if (!(await readText(path)).includes('rpc("' + functionName + '"'))
    fail("Edge Function is not wired to atomic database action: " + path);
}
for (const excluded of dailyExclusions.teams) {
  if (!migration.includes("'" + excluded.id + "'"))
    fail("Server-side Daily exclusion migration is missing " + excluded.id);
}
if (!/delete from public\.daily_challenges/i.test(migration))
  fail("Daily exclusion migration must purge previously scheduled excluded squads.");
if (!/create trigger enforce_daily_squad_exclusions/i.test(migration) ||
    !/create or replace function public\.reject_excluded_daily_squad/i.test(migration))
  fail("Daily exclusion migration is missing the database-level exclusion trigger.");
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const allTeams = [
  ...historicalTeams,
  ...[...teams.entries()].map(([name, players]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-2026",
    name, year: 2026, players
  }))
];
const allTeamsById = new Map(allTeams.map(t => [t.id, t]));
const excludedIds = new Set(dailyExclusions.teams.map(t => t.id));
const eligibleDailyByTier = Object.fromEntries(tierEntries.map(([tier]) => [tier, 0]));
for (const team of allTeams) {
  const tier = tierEntries.find(([, names]) => names.includes(team.name))?.[0];
  if (tier && !excludedIds.has(team.id)) eligibleDailyByTier[tier]++;
}
for (const [tier, count] of Object.entries(eligibleDailyByTier)) {
  if (count < 3) fail("Fewer than three non-excluded squads remain for Daily " + tier + ": " + count);
}
for (const [teamId, record] of Object.entries(audit.teams)) {
  if (record.status !== "verified") continue;
  const team = allTeamsById.get(teamId);
  if (!team) fail("Audit ledger marks an unknown team verified: " + teamId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt || ""))
    fail("Verified audit requires an ISO review date: " + teamId);
  if (!Array.isArray(record.players) || record.players.length !== team.players.length)
    fail("Verified audit row count mismatch: " + teamId);
  const auditKeys = record.players.map(r => Number(r.number) + "|" + normalize(r.playerName));
  if (new Set(auditKeys).size !== auditKeys.length)
    fail("Verified audit contains duplicate player rows: " + teamId);
  for (const row of record.players) {
    if (!team.players.some(p => Number(p.number) === Number(row.number) && normalize(p.name) === normalize(row.playerName)))
      fail("Verified audit contains an extra player row: " + teamId + " / " + row.playerName);
  }
  for (const player of team.players) {
    const row = record.players.find(r => Number(r.number) === Number(player.number) && normalize(r.playerName) === normalize(player.name));
    if (!row || !["matched", "corrected"].includes(row.status) || !String(row.sourceName || "").trim())
      fail("Verified audit contains missing/unresolved player or source name: " + teamId + " / " + player.name);
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
console.log("Potential non-excluded Daily pool: " + Object.entries(eligibleDailyByTier).map(([tier,count])=>tier+"="+count).join(", ") + ". These are candidates only; at least three fully audited teams per tier are still required before publishing Daily challenges.");
console.log("Historical club fields remain blank pending independent audits. The 2026 dataset has " + Object.values(audit.teams).filter(r => r.status === "verified").length + " fully audited team(s); all other squads remain unverified.");
