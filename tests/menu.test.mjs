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
});
