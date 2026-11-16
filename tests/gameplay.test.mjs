import test from "node:test";
import assert from "node:assert/strict";
import { createRound, submitGuess, revealRound } from "../assets/js/gameplay.js";
import { matches } from "../assets/js/matching.js";

const squad = [
  { name: "Kylian Mbappé" },
  { name: "Antoine Griezmann" },
  { name: "Olivier Giroud" }
];

test("round accepts correct names, accents and minor typos", () => {
  const round = createRound(squad);
  assert.equal(submitGuess(round, "Kylian Mbappe", matches).status, "correct");
  assert.equal(submitGuess(round, "Antoine Griezman", matches).status, "correct");
  assert.equal(round.found.size, 2);
});

test("round distinguishes wrong and duplicate guesses", () => {
  const round = createRound(squad);
  assert.equal(submitGuess(round, "Lionel Messi", matches).status, "incorrect");
  submitGuess(round, "Kylian Mbappe", matches);
  assert.equal(submitGuess(round, "Kylian Mbappe", matches).status, "duplicate");
});

test("round completion is detected exactly once all players are found", () => {
  const round = createRound(squad);
  submitGuess(round, "Kylian Mbappe", matches);
  submitGuess(round, "Antoine Griezmann", matches);
  const last = submitGuess(round, "Olivier Giroud", matches);
  assert.equal(last.complete, true);
  assert.equal(last.score, 3);
  assert.equal(last.total, 3);
  assert.equal(submitGuess(round, "another guess", matches).status, "ended");
});

test("Give Up reveals every missing player and preserves the score", () => {
  const round = createRound(squad);
  submitGuess(round, "Kylian Mbappe", matches);
  const result = revealRound(round);
  assert.equal(result.score, 1);
  assert.equal(result.total, 3);
  assert.deepEqual(result.missed.map(item => item.player.name), ["Antoine Griezmann", "Olivier Giroud"]);
  assert.equal(revealRound(round).missed.length, 2);
  assert.equal(submitGuess(round, "Olivier Giroud", matches).status, "ended");
});

test("empty and invalid rounds are handled safely", () => {
  const round = createRound(squad);
  assert.equal(submitGuess(round, "   ", matches).status, "empty");
  assert.throws(() => createRound([]), /at least one player/);
  assert.deepEqual(revealRound(null), { score: 0, total: 0, missed: [] });
});

test("app wires the gameplay engine into normal and Daily demo rounds", async () => {
  const main = await (await import("node:fs/promises")).readFile("dist/assets/js/main.js", "utf8");
  const shell = await (await import("node:fs/promises")).readFile("dist/sw.js", "utf8");
  assert.match(main, /import \{createRound,submitGuess,revealRound\} from "\.\/gameplay\.js"/);
  assert.match(main, /roundState=createRound\(team\.players\)/);
  assert.match(main, /submitGuess\(roundState,value,matches\)/);
  assert.match(main, /revealRound\(roundState\)/);
  assert.match(main, /scrollIntoView\(\{behavior:"smooth",block:"center"\}\)/);
  assert.match(main, /submitting\)return/);
  assert.match(main, /dailyState\.finalShown=true/);
  assert.match(main, /if\(!dailyState\.finalShown\)\{finishDailyOverall\(\);return;\}/);
  assert.match(shell, /assets\/js\/gameplay\.js/);
});

test("Argentina 2018 accepts Messi and Di Maria by surname", async () => {
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
  const argentina = data.tournaments["2018"].find(team => team.id === "argentina-2018");
  const round = createRound(argentina.players);
  assert.equal(submitGuess(round, "Messi", matches).status, "correct");
  assert.equal(submitGuess(round, "Di Maria", matches).status, "correct");
});

test("surname matching refuses ambiguous surnames in the same squad", () => {
  const squad = [{name:"Lucas Hernandez"},{name:"Theo Hernandez"}];
  const round = createRound(squad);
  assert.equal(submitGuess(round, "Hernandez", matches).status, "incorrect");
  assert.equal(submitGuess(round, "Lucas", matches).status, "incorrect");
});

test("compound surname matching supports Van Dijk and De Bruyne", () => {
  const squad = [{name:"Virgil van Dijk"},{name:"Kevin De Bruyne"}];
  const round = createRound(squad);
  assert.equal(submitGuess(round, "Van Dijk", matches).status, "correct");
  assert.equal(submitGuess(round, "De Bruyne", matches).status, "correct");
});

test("multi-particle surnames are accepted without accepting ambiguous family names", () => {
  const squad = [{name:"Nicolás de la Cruz"},{name:"José Luis Rodríguez"}];
  const round = createRound(squad);
  assert.equal(submitGuess(round, "De La Cruz", matches).status, "correct");
});
