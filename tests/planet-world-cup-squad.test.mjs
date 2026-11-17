import test from "node:test";
import assert from "node:assert/strict";
import { parsePlanetWorldCupSquad, decodePlanetWorldCupResponse } from "../scripts/planet-world-cup-squad.mjs";

test("parses Planet World Cup 2002 players, positions and tournament clubs", () => {
  const html = `
    <pre>
      1 GK Oliver Kahn               05 Nov 1980   Bayern Munich           1994,98
      6 MD Christian Ziege            01 Feb 1972   Tottenham Hotspur (GER) 1998
      8 MD Dietmar Hamann             27 Aug 1973   Liverpool (ENG)         1998
    </pre>`;
  assert.deepEqual(parsePlanetWorldCupSquad(html), [
    { number: 1, position: "GK", name: "Oliver Kahn", club: "Bayern Munich" },
    { number: 6, position: "MF", name: "Christian Ziege", club: "Tottenham Hotspur" },
    { number: 8, position: "MF", name: "Dietmar Hamann", club: "Liverpool" }
  ]);
});

test("decodes archive response using its declared charset", async () => {
  const bytes = new TextEncoder().encode("Müller");
  const response = {
    headers: { get: () => "text/html; charset=utf-8" },
    arrayBuffer: async () => bytes.buffer
  };
  assert.equal(await decodePlanetWorldCupResponse(response), "Müller");
});
