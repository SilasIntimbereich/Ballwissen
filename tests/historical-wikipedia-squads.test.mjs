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
  assert.equal(normalizeHistoricalClub("Borussia M'Gladbach"), "monchengladbach");
  assert.equal(normalizeHistoricalClub("Borussia Mönchengladbach"), "monchengladbach");
  assert.equal(normalizeHistoricalClub("Al-Helal"), "hilal");
  assert.equal(normalizeHistoricalClub("Al-Nasser"), "nassr");
  assert.equal(normalizeHistoricalClub("Ascoli"), "ascoli");
  assert.equal(normalizeHistoricalClub("AS Roma"), "roma");
  assert.equal(normalizeHistoricalClub("Hertha BSC Berlin"), "herthaberlin");
});


test("parses country squads nested beneath World Cup group headings",()=>{
 const teams=[{id:"egypt-2018",name:"Egypt"},{id:"russia-2018",name:"Russia"}];
 const html=`
  <h2><span class="mw-headline">Group A</span></h2>
  <h3><span class="mw-headline">Egypt</span></h3>
  <p>Coach: Héctor Cúper</p>
  <table><tr><th>No.</th><th>Pos.</th><th>Player</th><th>DOB</th><th>Caps</th><th>Goals</th><th>Club</th></tr>
   <tr><td>1</td><td>1 GK</td><td>Essam El Hadary</td><td>date</td><td>158</td><td>0</td><td>Al Taawoun</td></tr>
  </table>
  <h3><span class="mw-headline">Russia</span></h3>
  <table><tr><td>1</td><td>1 GK</td><td>Igor Akinfeev</td><td>date</td><td>106</td><td>0</td><td>CSKA Moscow</td></tr></table>
  <h2><span class="mw-headline">Group B</span></h2>
 `;
 const parsed=parseWikipediaSquads(html,teams);
 assert.deepEqual(parsed.get("egypt-2018"),[{number:1,position:"GK",name:"Essam El Hadary",club:"Al Taawoun"}]);
 assert.deepEqual(parsed.get("russia-2018"),[{number:1,position:"GK",name:"Igor Akinfeev",club:"CSKA Moscow"}]);
});


test("also supports deeper nested country headings",()=>{
 const teams=[{id:"egypt-2018",name:"Egypt"}];
 const html=`
  <h3>Group A</h3>
  <h4>Egypt</h4>
  <table><tr><td>1</td><td>1 GK</td><td>Essam El Hadary</td><td>date</td><td>158</td><td>0</td><td>Al Taawoun</td></tr></table>
  <h3>Group B</h3>
 `;
 const parsed=parseWikipediaSquads(html,teams);
 assert.deepEqual(parsed.get("egypt-2018"),[{number:1,position:"GK",name:"Essam El Hadary",club:"Al Taawoun"}]);
});

test("normalizes documented historical club aliases without merging ambiguous Olimpia clubs",()=>{
  const equivalent=[
    ["AZ","AZ Alkmaar"],
    ["Mainz 05","FSV Mainz 05"],
    ["Chivas","Guadalajara"],
    ["Saprissa","Deportivo Saprissa"],
    ["Al Ahly","Al-Ahly Cairo"],
    ["Nagoya Grampus","Nagoya Grampus Eight"],
    ["West Bromwich Albion","West Bromwich A."],
    ["Urawa Red Diamonds","Urawa Reds"],
    ["Jeonbuk Hyundai Motors","Jeonbuk Motors"],
    ["Dynamo Kyiv","Dynamo Kiev"],
    ["Gent","AA Gent"],
    ["AGF","AGF Aarhus"],
    ["LA Galaxy","Los Angeles Galaxy"],
    ["Paris Saint-Germain","Paris SG"],
    ["Club León","León"],
    ["Tigres UANL","Tigres"],
    ["PAOK","PAOK Thessaloniki"],
    ["1899 Hoffenheim","Hoffenheim"],
    ["Olympiacos","Olympiakos"],
    ["Genk","Racing Genk"],
    ["AIK","AIK Stockholm"],
    ["Zenit Saint Petersburg","Zenit St Petersburg"],
    ["Legia Warsaw","Legia Warszawa"],
    ["SPAL","SPAL Ferrara"]
  ];
  for(const [a,b] of equivalent)assert.equal(normalizeHistoricalClub(a),normalizeHistoricalClub(b),a+" / "+b);
  assert.notEqual(normalizeHistoricalClub("Olimpia Tegucigalpa"),normalizeHistoricalClub("Olimpia Asuncion"));
});
