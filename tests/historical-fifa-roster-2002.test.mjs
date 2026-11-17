import test from "node:test";
import assert from "node:assert/strict";
import { parseFifa2002Roster } from "../scripts/historical-fifa-roster-2002.mjs";

test("parses FIFA's 2002 roster table by country code, number, position and display name", () => {
  const teams = [
    { id: "argentina-2002", name: "Argentina" },
    { id: "brazil-2002", name: "Brazil" }
  ];
  const html = `
    <pre>
      ARG 1 GK BURGOS German
      ARG 2 DF AYALA Roberto
      ARG GK BONANO Roberto
      BRA 1 GK MARCOS
      BRA 13 DF BELLETTI
    </pre>`;
  const parsed = parseFifa2002Roster(html, teams);
  assert.deepEqual(parsed.get("argentina-2002"), [
    { number: 1, position: "GK", name: "BURGOS German" },
    { number: 2, position: "DF", name: "AYALA Roberto" },
    { number: null, position: "GK", name: "BONANO Roberto" }
  ]);
  assert.deepEqual(parsed.get("brazil-2002"), [
    { number: 1, position: "GK", name: "MARCOS" },
    { number: 13, position: "DF", name: "BELLETTI" }
  ]);
});


test("does not mark a roster clean when any position differs",()=>{
 const {isCleanFifa2002RosterAudit}=await import("../scripts/historical-fifa-roster-2002.mjs");
 const valid={sourcePlayerCount:23,matchedPlayers:23,nameMismatches:[],missingFromSource:[],missingFromDataset:[],positionDifferences:[]};
 assert.equal(isCleanFifa2002RosterAudit(valid,23),true);
 assert.equal(isCleanFifa2002RosterAudit({...valid,positionDifferences:[{number:1}]},23),false);
 assert.equal(isCleanFifa2002RosterAudit({...valid,sourcePlayerCount:22},23),false);
});
