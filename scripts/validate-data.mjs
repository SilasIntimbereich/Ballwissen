import { readFile } from "node:fs/promises";
const read = async path => JSON.parse(await readFile(path, "utf8"));

const wc = await read("data/worldcup-2026.json");
if (wc.players.length !== 1248) throw new Error("2026: expected 1,248 players, got " + wc.players.length);
const teams = new Map();
for (const p of wc.players) {
  if (!teams.has(p.team)) teams.set(p.team, 0);
  teams.set(p.team, teams.get(p.team) + 1);
}
if (teams.size !== 48) throw new Error("2026: expected 48 teams, got " + teams.size);
for (const [team, n] of teams) if (n !== 26) throw new Error("2026: " + team + " has " + n + " entries, expected 26.");

const hist = await read("data/historical-squads.json");
let historicalPlayers = 0;
for (const year of [2002, 2006, 2010, 2014, 2018, 2022]) {
  const list = hist.tournaments?.[year];
  if (!list || list.length !== 32) throw new Error(year + ": expected 32 teams.");
  for (const team of list) {
    const count = team.players.length;
    if (year < 2022 && count !== 23)
      throw new Error(year + " " + team.name + ": expected 23 players, got " + count);
    if (year === 2022 && (count < 25 || count > 26))
      throw new Error(year + " " + team.name + ": invalid roster size " + count);
    const names = team.players.map(p => p.name?.trim());
    if (names.some(n => !n))
      throw new Error(year + " " + team.name + ": empty player name.");
    if (team.players.some(p => p.club))
      throw new Error(year + " " + team.name + ": unsupported club data must not be populated.");
    historicalPlayers += count;
  }
}
const iran = hist.tournaments[2022].find(t => t.name === "Iran");
if (!iran || iran.players.length !== 25) throw new Error("2022 Iran source roster check failed.");
console.log("Validation passed: 192 historical teams / " + historicalPlayers +
  " source-listed players; 48 teams / 1,248 rows in 2026. Historical club data is unavailable in this source.");
