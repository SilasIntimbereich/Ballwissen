import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("accepts an explicit source-name alias backed by two independent sources", () => {
  const aliased = {
    ...validEntry,
    players: [{
      ...validEntry.players[0],
      sourceName: "Hugo L.",
      sourceNameAliases: ["Hugo Lloris", "Hugo L."]
    }]
  };
  assert.equal(isCompleteVerifiedRosterLedger(team, aliased, 2018), true);
  const undocumented = {
    ...aliased,
    players: [{ ...aliased.players[0], sourceNameAliases: ["Hugo Lloris"] }]
  };
  assert.equal(isCompleteVerifiedRosterLedger(team, undocumented, 2018), false);
  const invalidAliasEvidence = {
    ...aliased,
    players: [{ ...aliased.players[0], sourceNameAliasEvidenceUrl: "http://example.com/alias" }]
  };
  assert.equal(isCompleteVerifiedRosterLedger(team, invalidAliasEvidence, 2018), false);
});


test("downgrades stale verified markers instead of leaving invalid trust metadata", async () => {
  const { downgradeIncompleteVerifiedRosterLedger } = await import("../scripts/verified-roster-ledger.mjs");
  const stale = structuredClone(validEntry);
  stale.players[0].clubAtTournament = "Old club";
  assert.equal(downgradeIncompleteVerifiedRosterLedger(team, stale, 2018), true);
  assert.equal(stale.status, "needs_review");
  assert.match(stale.verificationIssue, /no longer matches/i);
  assert.equal(downgradeIncompleteVerifiedRosterLedger(team, validEntry, 2018), false);
  assert.equal(validEntry.status, "verified");
});

test("every currently verified historical and 2026 team passes the strict ledger guard", async () => {
  const [audit, historical, worldCup2026] = await Promise.all([
    readFile("data/roster-audit.json", "utf8").then(JSON.parse),
    readFile("data/historical-squads.json", "utf8").then(JSON.parse),
    readFile("data/worldcup-2026.json", "utf8").then(JSON.parse)
  ]);
  const teams = Object.values(historical.tournaments).flat();
  const grouped = new Map();
  for (const player of worldCup2026.players) {
    if (!grouped.has(player.team)) grouped.set(player.team, []);
    grouped.get(player.team).push({
      name: player.player || player.name,
      position: player.pos || player.position,
      club: player.club || null,
      number: Number(player.number)
    });
  }
  const slug = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const [name, players] of grouped) {
    teams.push({ id: slug(name) + "-2026", name, year: 2026, players });
  }
  const byId = new Map(teams.map(team => [team.id, team]));
  const verified = Object.entries(audit.teams).filter(([, entry]) => entry.status === "verified");
  for (const [id, entry] of verified) {
    const team = byId.get(id);
    assert.ok(team, "verified team must exist in the data: " + id);
    assert.equal(isCompleteVerifiedRosterLedger(team, entry, team.year), true, id);
  }
});
