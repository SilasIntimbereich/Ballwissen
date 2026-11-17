import test from "node:test";
import assert from "node:assert/strict";
import { parseWikipediaSquads, normalizeHistoricalClub } from "../scripts/historical-wikipedia-squads.mjs";

test("parses team headings, squad numbers, positions, names and tournament clubs", () => {
  const teams = [{ id: "denmark-2002", name: "Denmark" }, { id: "china-2002", name: "China" }];
  const html = `
    <h3><span class="mw-headline">Denmark</span></h3>
    <table class="wikitable">
      <tr><th>No.</th><th>Pos.</th><th>Player</th><th>DOB</th><th>Caps</th><th>Club</th></tr>
      <tr><td>1</td><td>1<sup>GK</sup></td><td><a>Thomas Sørensen</a> (c)<sup>[1]</sup></td><td>date</td><td>14</td><td><a>Sunderland</a></td></tr>
    </table>
    <h3><span class="mw-headline">China PR</span></h3>
    <table class="wikitable">
      <tr><td>1</td><td>1 GK</td><td>Jiang Jin</td><td>date</td><td>0</td><td>Shandong Luneng</td></tr>
    </table>`;
  const parsed = parseWikipediaSquads(html, teams);
  assert.deepEqual(parsed.get("denmark-2002"), [{ number: 1, position: "GK", name: "Thomas Sørensen", club: "Sunderland" }]);
  assert.deepEqual(parsed.get("china-2002"), [{ number: 1, position: "GK", name: "Jiang Jin", club: "Shandong Luneng" }]);
});

test("normalizes club prefixes and suffixes without merging distinct clubs", () => {
  assert.equal(normalizeHistoricalClub("FC Barcelona"), "barcelona");
  assert.equal(normalizeHistoricalClub("Barcelona B"), "barcelonab");
  assert.equal(normalizeHistoricalClub("HNK Hajduk Split"), "hajduksplit");
  assert.equal(normalizeHistoricalClub("Al-Nassr"), "nassr");
  assert.equal(normalizeHistoricalClub("Al Nassr FC"), "nassr");
  assert.equal(normalizeHistoricalClub("Alavés"), "alaves");
  assert.equal(normalizeHistoricalClub("Bayern München"), "bayernmunich");
});
