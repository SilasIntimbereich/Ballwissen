import test from "node:test";
import assert from "node:assert/strict";
import { parseFifa2002Roster } from "../scripts/historical-fifa-roster-2002.mjs";

test("parses Slovenia's FIFA code SVN and numbered roster rows", () => {
  const html = `
    <table>
      <tr><td>SVN</td><td>1</td><td>GK</td><td>SIMEUNOVIC Marko</td></tr>
      <tr><td>ARG</td><td>1</td><td>GK</td><td>BURGOS German</td></tr>\n      <tr><td>ARG</td><td></td><td>GK</td><td>BONANO Roberto</td></tr>
    </table>`;
  const teams = [
    { id: "slovenia-2002", name: "Slovenia" },
    { id: "argentina-2002", name: "Argentina" }
  ];
  const parsed = parseFifa2002Roster(html, teams);
  assert.equal(parsed.size, 2);
  assert.deepEqual(parsed.get("slovenia-2002"), [
    { number: 1, position: "GK", name: "SIMEUNOVIC Marko" }
  ]);
  assert.deepEqual(parsed.get("argentina-2002"), [
    { number: 1, position: "GK", name: "BURGOS German" },
    { number: null, position: "GK", name: "BONANO Roberto" }
  ]);
});
