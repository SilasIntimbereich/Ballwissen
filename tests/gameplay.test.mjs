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
