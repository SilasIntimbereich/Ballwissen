import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("2002 historical roster dataset contains 32 squads of 23 players", async () => {
  const data = JSON.parse(await readFile(new URL("../data/historical-squads.json", import.meta.url), "utf8"));
  const teams = data.tournaments["2002"];
  assert.equal(teams.length, 32);
  assert.equal(teams.reduce((sum, team) => sum + team.players.length, 0), 736);
  assert.ok(teams.every(team => team.players.length === 23));
});
