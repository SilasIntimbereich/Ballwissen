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

test("requires identity and club agreement plus an official FIFA position", () => {
  assert.equal(isCompleteIndependentPlayerComparison(valid), true);
  // A secondary archive can use a different position taxonomy. FIFA's final
  // squad list remains authoritative, while the difference stays in the report.
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, positionMatches: false, secondaryPosition: "FW" }), true);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, identityMatches: false }), false);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, clubMatches: false }), false);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, fifaPosition: "" }), false);
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, secondaryPosition: "" }), false);
});

test("does not treat two missing club values as an independent match", () => {
  assert.equal(isCompleteIndependentPlayerComparison({ ...valid, fifaClub: "", secondaryClub: "" }), false);
});
