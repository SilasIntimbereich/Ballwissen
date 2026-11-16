import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(path, "utf8");

test("home menu exposes all seven selectable destinations", async () => {
  const html = await read("dist/index.html");
  const main = await read("dist/assets/js/main.js");
  const css = await read("dist/assets/css/styles.css");
  const modes = [...html.matchAll(/data-mode="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(modes, ["daily-common", "daily-niche", "daily-legendary", "easy", "hard", "practice", "tournament"]);
  assert.match(html, /data-open-screen="stats"/);
  assert.match(html, /data-open-screen="settings"/);
  assert.match(html, /id="stats" class="screen"/);
  assert.match(html, /id="settings" class="screen"/);
  assert.match(html, /assets\/js\/menu\.js/);
  assert.match(main, /querySelectorAll\("\[data-mode\]"\)/);
  assert.match(css, /\.shell\{[^}]*z-index:1/);
  assert.match(css, /\.stadium\{[^}]*pointer-events:none/);
  assert.match(css, /\.utility-grid\{display:grid/);
  assert.match(css, /button:focus-visible/);
  const serviceWorker = await read("dist/sw.js");
  assert.match(serviceWorker, /\.\/assets\/js\/menu\.js/);
});

test("public build contains the data required by the mode and tournament selectors", async () => {
  const publicData = JSON.parse(await read("dist/data/public-teams.json"));
  const practiceData = JSON.parse(await read("dist/data/practice-rosters.json"));
  assert.equal(publicData.teams.length, 240);
  assert.equal(new Set(publicData.teams.map(team => team.id)).size, 240);
  assert.equal(practiceData.teams.length, publicData.teams.filter(team => !team.verified).length);
  const practiceIds = new Set(practiceData.teams.map(team => team.id));
  assert.ok(publicData.teams.filter(team => !team.verified).every(team => practiceIds.has(team.id)));
  assert.ok(publicData.teams.filter(team => team.verified).every(team => !practiceIds.has(team.id)));
  const exclusions = JSON.parse(await read("dist/data/daily-exclusions.json"));
  assert.equal(exclusions.teams.length, 50);
  assert.equal(new Set(exclusions.teams.map(team => team.id)).size, 50);
  const excludedIds = new Set(exclusions.teams.map(team => team.id));
  const eligibleDemoTeams = publicData.teams.filter(team =>
    !team.verified && !excludedIds.has(team.id) && practiceIds.has(team.id)
  );
  assert.ok(eligibleDemoTeams.length >= 3, "offline Daily demo needs at least three eligible practice squads");
});


test("gameplay keeps the roster visible and handles all end states", async () => {
  const main = await read("dist/assets/js/main.js");
  const css = await read("dist/assets/css/styles.css");
  assert.match(main, /\$\("#guess-form"\)\.addEventListener\("submit"/);
  assert.match(main, /async function finish\(giveUp,completed=false\)/);
  assert.match(main, /giveUp:giveUp\|\|completed/);
  assert.match(main, /Perfect run! You found every player\./);
  assert.match(main, /Every squad member is now revealed\./);
  assert.match(main, /cardForPlayer\(player\.id\)\|\|/);
  assert.match(main, /const onlineLocked=selected\.verified&&!supabase/);
  assert.ok(css.includes("Gameplay usability fix: keep the revealed roster visible"));
  assert.match(css, /\.result\{\s*position:relative/);
});


test("offline Daily demo is playable without exposing verified answer rosters", async () => {
  const main = await read("dist/assets/js/main.js");
  const data = await read("dist/assets/js/data.js");
  const sw = await read("dist/sw.js");
  assert.match(data, /dailyExclusions=new Set/);
  assert.match(main, /if\(!supabase\)\{/);
  assert.match(main, /DAILY DEMO/);
  assert.match(main, /Local unranked demo with three squads from this tier/);
  assert.match(main, /demoFallback=pool\.length<3/);
  assert.match(main, /mixed test pool/);
  assert.match(main, /dailyState\.demo/);
  assert.match(main, /team\.players\.findIndex/);
  assert.match(main, /Three local practice squads played/);
  assert.match(sw, /daily-exclusions\.json/);
  assert.match(main, /!dailyExclusions\.has\(item\.id\)/);
  assert.match(main, /item\.verified&&!dailyExclusions\.has\(item\.id\)/);
});


test("game controls are explicitly enabled and Daily demo Give Up shows a round result", async () => {
  const main = await read("dist/assets/js/main.js");
  assert.match(main, /function enableGuessControls\(\)/);
  assert.match(main, /input\.removeAttribute\("disabled"\)/);
  assert.match(main, /button\.removeAttribute\("disabled"\)/);
  assert.match(main, /\$\("#result-score"\)\.textContent=found\.size\+" \/ "+team\.players\.length/);
  assert.match(main, /\$\("#result-home"\)\.textContent=dailyState\.current>=3\?"VIEW FINAL RESULTS":"NEXT TEAM"/);
  assert.match(main, /if\(dailyState\?\.demo\)\{/);
});
