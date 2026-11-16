import { readFile, writeFile } from "node:fs/promises";

const SOURCES = {
  squads: "https://datahub.io/football/worldcup/_r/-/squads.csv",
  tournaments: "https://datahub.io/football/worldcup/_r/-/tournaments.csv"
};
const YEARS = [2002, 2006, 2010, 2014, 2018, 2022];
const difficultyData = JSON.parse(await readFile("data/team-difficulty.json", "utf8"));
const difficultyOf = name =>
  Object.entries(difficultyData.tiers).find(([, names]) => names.includes(name))?.[0] || "niche";

function parseCSV(input) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  input = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(r => r.length > 1)
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
}

const responses = await Promise.all(Object.values(SOURCES).map(url => fetch(url)));
if (responses.some(r => !r.ok)) throw new Error("Could not download DataHub CSV files.");
const [squadText, tournamentText] = await Promise.all(responses.map(r => r.text()));
const tournaments = parseCSV(tournamentText);
const yearById = new Map(tournaments.map(t => [t.tournament_id, Number(t.year)]));
const squads = parseCSV(squadText);
const yearOf = r => yearById.get(r.tournament_id) ||
  Number((r.tournament_name || "").match(/(?:19|20)\d{2}/)?.[0]);

const filtered = squads.filter(r =>
  YEARS.includes(yearOf(r)) &&
  !/women|female/i.test((r.tournament_name || "") + " " + (r.tournament_id || ""))
);
const output = {
  source: "Fjelstul World Cup Database via DataHub",
  sourceUrl: "https://datahub.io/football/worldcup",
  license: "CC BY-SA 4.0",
  generatedAt: new Date().toISOString(),
  dataNotes: [
    "The DataHub squads.csv schema contains player names, positions and shirt numbers, but no club-at-tournament field.",
    "Club hints are therefore intentionally null, not guessed or copied from a player's current club.",
    "2022 has 831 source records; Iran has 25 entries and the other 31 teams have 26."
  ],
  tournaments: {}
};

for (const year of YEARS) {
  const rows = filtered.filter(r => yearOf(r) === year);
  const grouped = new Map();
  for (const r of rows) {
    const name = r.team_name || "";
    const playerName = [r.given_name, r.family_name].filter(v => v && !/^not applicable$/i.test(v.trim())).join(" ").trim();
    if (!name) throw new Error(year + ": squad row without team name.");
    if (!playerName) throw new Error(year + ", " + name + ": squad row without player name.");
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push({
      name: playerName,
      position: r.position_code || r.position_name || "",
      club: null,
      number: r.shirt_number ? Number(r.shirt_number) : null
    });
  }

  if (grouped.size !== 32)
    throw new Error("Year " + year + ": expected 32 men's teams, found " + grouped.size + ".");
  for (const [team, players] of grouped) {
    // Duplicate display names can occur in source records; preserve every roster row.\n    // Player IDs remain distinct by their source roster position.
    // The game layer must handle same-name candidates without silently dropping players.
    if (year < 2022 && players.length !== 23)
      throw new Error(year + ", " + team + ": expected 23 players, found " + players.length + ".");
    if (year === 2022 && (players.length < 25 || players.length > 26))
      throw new Error(year + ", " + team + ": expected 25–26 players, found " + players.length + ".");
  }

  if (year === 2022) {
    const shortTeams = [...grouped.entries()].filter(([, players]) => players.length === 25).map(([name]) => name);
    if (shortTeams.length !== 1 || shortTeams[0] !== "Iran")
      throw new Error("2022: expected Iran to have 25 source-listed players and all other teams 26; found " + shortTeams.join(", "));
  }

  output.tournaments[year] = [...grouped.entries()].map(([name, players]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + year,
    name, year, teamDifficulty: difficultyOf(name),
    verified: false,
    players: players.sort((a, b) => (a.number || 99) - (b.number || 99))
  })).sort((a, b) => a.name.localeCompare(b.name));
  console.log(year, grouped.size, "teams", rows.length, "players");
}

await writeFile("data/historical-squads.json", JSON.stringify(output));
console.log("Wrote data/historical-squads.json");
