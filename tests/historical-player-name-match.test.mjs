import test from "node:test";
import assert from "node:assert/strict";
import { namesMatch } from "../scripts/historical-player-name-match.mjs";

test("matches hyphenated names against unhyphenated FIFA display fields", () => {
  assert.equal(namesMatch("Kim Min-jae", "KIM Minjae Minjae KIM M J KIM"), true);
  assert.equal(namesMatch("Moussa N'Diaye", "NDIAYE Moussa Moussa NDIAYE M. NDIAYE"), true);
});

test("repairs the null-character ligature artifact in PDF text extraction", () => {
  assert.equal(namesMatch("Sofiane Boufal", "BOUFAL So\u0000ane So\u0000ane BOUFAL"), true);
  assert.equal(namesMatch("Daniel-Kofi Kyereh", "KYEREH Daniel-Ko\u0000 Daniel Ko\u0000 KYEREH"), true);
});

test("does not silently accept a nickname or a different first name", () => {
  assert.equal(namesMatch("Papu Gómez", "GOMEZ Alejandro Alejandro Dario GÓMEZ GÓMEZ"), false);
  assert.equal(namesMatch("Sebas Méndez", "MENDEZ Jhegson Jhegson Sebastián MÉNDEZ CARABALÍ MENDEZ"), false);
});
