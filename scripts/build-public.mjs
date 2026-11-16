import { cp, mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const [worldCup2026, historical, difficulty, audit] = await Promise.all([
  readJson("data/worldcup-2026.json"),
  readJson("data/historical-squads.json"),
  readJson("data/team-difficulty.json"),
  readJson("data/roster-audit.json")
]);
const tierOf = name => Object.entries(difficulty.tiers || {}).find(([, names]) => names.includes(name))?.[0] || "niche";
const verified = id => audit.teams?.[id]?.status === "verified";
const slug = name => name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const allTeams = [];
for (const [year, teams] of Object.entries(historical.tournaments || {})) {
  for (const team of teams) allTeams.push({ ...team, year: Number(year) });
}
const grouped2026 = new Map();
for (const p of worldCup2026.players) {
  if (!grouped2026.has(p.team)) grouped2026.set(p.team, []);
  grouped2026.get(p.team).push({
    name: p.player || p.name,
    position: p.pos || p.position,
    club: p.club || null,
    number: Number(p.number),
    teamCode: p.fifa_code || p.teamCode,
    rarity: p.rarity || null
  });
}
for (const [name, players] of grouped2026) {
  allTeams.push({ id: slug(name) + "-2026", name, year: 2026, players });
}

const publicTeams = [];
const practiceTeams = [];
for (const team of allTeams) {
  const isAudited = verified(team.id);
  const players = [...(team.players || [])].sort((a, b) => Number(a.number) - Number(b.number));
  if (isAudited && players.length !== 26 && team.year === 2026)
    throw new Error("Verified 2026 team has unexpected roster size: " + team.id);
  publicTeams.push({
    id: team.id,
    name: team.name,
    year: team.year,
    teamDifficulty: team.teamDifficulty || tierOf(team.name),
    verified: isAudited,
    total: players.length,
    teamCode: team.teamCode || players[0]?.teamCode || null
  });
  if (!isAudited) practiceTeams.push({ id: team.id, players });
}
if (publicTeams.length !== 240) throw new Error("Expected 240 total squads, got " + publicTeams.length);

await rm("dist", { recursive: true, force: true });
await mkdir("dist/data", { recursive: true });
await cp("assets", "dist/assets", { recursive: true });
await cp("index.html", "dist/index.html");
await cp("manifest.webmanifest", "dist/manifest.webmanifest");
await cp("sw.js", "dist/sw.js");
await writeFile("dist/data/public-teams.json", JSON.stringify({ version: 1, teams: publicTeams }, null, 2) + "\n");
await writeFile("dist/data/practice-rosters.json", JSON.stringify({ version: 1, teams: practiceTeams }, null, 2) + "\n");

const verifiedIds = new Set(publicTeams.filter(t => t.verified).map(t => t.id));
if (practiceTeams.some(t => verifiedIds.has(t.id))) throw new Error("A verified answer roster leaked into practice data.");
for (const path of ["dist/data/worldcup-2026.json", "dist/data/historical-squads.json", "dist/data/roster-audit.json"])
  try { await stat(path); throw new Error("Private source data leaked into public build: " + path); } catch (e) { if (e.code !== "ENOENT") throw e; }

console.log("Public build created: " + publicTeams.length + " teams; " + publicTeams.filter(t => t.verified).length + " verified teams have no names in public data; " + practiceTeams.length + " unverified practice rosters are included.");
