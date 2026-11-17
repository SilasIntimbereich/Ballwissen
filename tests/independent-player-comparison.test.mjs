import test from "node:test";
import assert from "node:assert/strict";
import { isCompleteIndependentPlayerComparison } from "../scripts/independent-player-comparison.mjs";

const valid = {
  identityMatches: true,
  clubMatches: true,
  positionMatches: true,
  fifaClub: "Paris Saint-Germain",
  secondaryClub: "Paris Saint-Germain",
  fifaPosition: "MF",
  secondaryPosition: "MF"
};

test("requires player identity, club and position agreement", () => {
  assert.equal(isCompleteIndependentPlayerComparison(valid), true);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, positionMatches: false }), false);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, identityMatches: false }), false);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, clubMatches: false }), false);
});

test("does not treat two missing club values as an independent match", () => {
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, fifaClub: "", secondaryClub: "" }), false);
});
