import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(path, "utf8");

test("home menu exposes every offline mode and utility screen", async () => {
  const html = await read("dist/index.html");
  const main = await read("dist/assets/js/main.js");
  const css = await read("dist/assets/css/styles.css");
  const modes = [...html.matchAll(/data-mode="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(modes, ["daily-common", "daily-niche", "daily-legendary", "easy", "hard", "practice", "tournament"]);
  assert.match(html, /data-open-screen="stats"/);
  assert.match(html, /data-open-screen="settings"/);
  assert.match(html, /id="stats" class="screen"/);
  assert.match(html, /id="settings" class="screen"/);
  assert.match(html, /Fjelstul World Cup Database via DataHub/);
  assert.match(html, /20 of 48 teams/);
  assert.match(html, /Play offline after the first load/);
  assert.doesNotMatch(html, /assets\/js\/config\.js/);
  assert.match(html, /assets\/js\/menu\.js/);
  assert.match(main, /querySelectorAll\("\[data-mode\]"\)/);
  assert.doesNotMatch(main, /supabase|normalSessionId|normalHints/);
  assert.match(css, /\.shell\{[^}]*z-index:1/);
  assert.match(css, /\.stadium\{[^}]*z-index:0/);
  assert.match(css, /\.utility-grid\{display:grid/);
  assert.match(css, /button:focus-visible/);
  assert.ok(css.includes("h1 span{background:none;color:#f0c64a"));
  const serviceWorker = await read("dist/sw.js");
  assert.match(serviceWorker, /\.\/assets\/js\/menu\.js/);
});

test("public build includes a complete local roster for every tournament team", async () => {
  const publicData = JSON.parse(await read("dist/data/public-teams.json"));
  const localData = JSON.parse(await read("dist/data/practice-rosters.json"));
  assert.equal(publicData.teams.length, 240);
  assert.equal(new Set(publicData.teams.map(team => team.id)).size, 240);
  assert.equal(localData.teams.length, publicData.teams.length);
  const localById = new Map(localData.teams.map(team => [team.id, team]));
  assert.equal(localById.size, publicData.teams.length);
  for (const team of publicData.teams) {
    const local = localById.get(team.id);
    assert.ok(local, "missing local roster: " + team.id);
    assert.equal(local.players.length, team.total, "wrong roster size: " + team.id);
    assert.ok(local.players.length > 0, "empty local roster: " + team.id);
    assert.ok(["common","niche","legendary"].includes(team.teamDifficulty), "missing difficulty: "+team.id);
  }
  const exclusions = JSON.parse(await read("dist/data/daily-exclusions.json"));
  assert.equal(exclusions.teams.length, 50);
  assert.equal(new Set(exclusions.teams.map(team => team.id)).size, 50);
  const excludedIds = new Set(exclusions.teams.map(team => team.id));
  const eligibleDailyTeams = publicData.teams.filter(team => !excludedIds.has(team.id) && localById.has(team.id));
  assert.ok(eligibleDailyTeams.length >= 3, "offline Daily needs at least three eligible squads");
});

test("normal gameplay is local, input-enabled and handles every end state", async () => {
  const main = await read("dist/assets/js/main.js");
  const css = await read("dist/assets/css/styles.css");
  assert.match(main, /\$\("#guess-form"\)\.addEventListener\("submit"/);
  assert.match(main, /async function finish\(giveUp,completed=false\)/);
  assert.match(main, /Perfect run! You found every player\./);
  assert.match(main, /Every squad member is now revealed\./);
  assert.match(main, /roundState=createRound\(team\.players\)/);
  assert.match(main, /Local practice round · unranked/);
  assert.match(main, /function enableGuessControls\(\)/);
  assert.match(main, /input\.removeAttribute\("disabled"\)/);
  assert.match(main, /button\.removeAttribute\("disabled"\)/);
  assert.match(main, /if\(practiceOnly\)\{\$\("#timer"\)\.textContent="∞";return;\}/);
  assert.match(main, /ACCURACY · /);
  assert.match(main, /PRACTICE · NO TIMER/);
  assert.doesNotMatch(main, /supabase|normalSessionId|normalHints/);
  assert.ok(css.includes("Gameplay usability fix: keep the revealed roster visible"));
  assert.match(css, /\.result\{\s*position:relative/);
});

test("Daily modes are local, stable, tier-specific and respect exclusions", async () => {
  const main = await read("dist/assets/js/main.js");
  const data = await read("dist/assets/js/data.js");
  const sw = await read("dist/sw.js");
  assert.match(data, /dailyExclusions=new Set/);
  assert.match(main, /DAILY · /);
  assert.match(main, /Local unranked challenge with three squads from this tier/);
  assert.match(main, /function dailyRandom\(tier\)/);
  assert.match(main, /const random=dailyRandom\(tier\)/);
  assert.match(main, /dailyState=\{mode:modeName,teams,current:1,score:0,total:0,finalShown:false\}/);
  assert.match(main, /submitGuess\(roundState,value,matches\)/);
  assert.match(main, /Three local squads played/);
  assert.match(main, /!dailyExclusions\.has\(item\.id\)/);
  assert.match(main, /startDailyTeam\(1\)/);
  assert.match(main, /VIEW FINAL RESULTS/);
  assert.doesNotMatch(main, /demoFallback|MIXED TEST POOL/);
  assert.match(sw, /daily-exclusions\.json/);
});

test("local stats update from completed results and settings persist locally", async () => {
  const main = await read("dist/assets/js/main.js");
  const menu = await read("dist/assets/js/menu.js");
  assert.match(main, /football-arcade:result/);
  assert.match(main, /recordLocalResult\(dailyState\.score,dailyState\.total\)/);
  assert.match(menu, /football-arcade:result/);
  assert.match(menu, /stats\.played \+= 1/);
  assert.match(menu, /clear-local-stats/);
  assert.match(menu, /SETTINGS_KEY/);
  assert.match(menu, /compact-ui/);
  assert.match(menu, /reduce-motion/);
});
