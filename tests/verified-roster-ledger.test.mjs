import test from "node:test";
import assert from "node:assert/strict";
import { isCompleteVerifiedRosterLedger } from "../scripts/verified-roster-ledger.mjs";

const team = {
  id: "france-2018",
  name: "France",
  year: 2018,
  players: [{ number: 1, name: "Hugo Lloris", position: "GK", club: "Tottenham Hotspur" }]
};
const validEntry = {
  status: "verified",
  tournament: 2018,
  teamNameInDataset: "France",
  teamNameInFifaPdf: "France",
  reviewedAt: "2026-11-17",
  primarySource: "https://www.fifa.com/squad.pdf",
  secondarySource: "https://www.planetworldcup.com/CUPS/2018/squad_fra18.html",
  players: [{
    number: 1,
    playerName: "Hugo Lloris",
    sourceName: "Hugo Lloris",
    status: "matched",
    position: "GK",
    clubAtTournament: "Tottenham Hotspur"
  }]
};

test("accepts only complete player-level ledgers with distinct HTTPS hosts", () => {
  assert.equal(isCompleteVerifiedRosterLedger(team, validEntry, 2018), true);
  assert.equal(isCompleteVerifiedRosterLedger(team, {
    ...validEntry,
    secondarySource: "https://www.fifa.com/other.pdf"
  }, 2018), false);
});

test("rejects incomplete, mismatched or duplicate player rows", () => {
  assert.equal(isCompleteVerifiedRosterLedger(team, { ...validEntry, players: [] }, 2018), false);
  assert.equal(isCompleteVerifiedRosterLedger(team, {
    ...validEntry, players: [{ ...validEntry.players[0], clubAtTournament: "Wrong club" }]
  }, 2018), false);
  assert.equal(isCompleteVerifiedRosterLedger(team, {
    ...validEntry, players: [{ ...validEntry.players[0], position: "FW" }]
  }, 2018), false);
  assert.equal(isCompleteVerifiedRosterLedger(team, {
    ...validEntry, players: [{ ...validEntry.players[0], number: 99 }]
  }, 2018), false);
});
