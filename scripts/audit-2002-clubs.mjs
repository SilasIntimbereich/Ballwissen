import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";
import { parseWikipediaSquads, normalizeHistoricalClub } from "./historical-wikipedia-squads.mjs";
import { parsePlanetWorldCupSquad } from "./planet-world-cup-squad.mjs";

const WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/2002_FIFA_World_Cup_squads";
const slugs = {
  Argentina:"arg", Belgium:"bel", Brazil:"bra", Cameroon:"cmr", China:"chn",
  "Costa Rica":"crc", Croatia:"cro", Denmark:"den", Ecuador:"ecu", England:"eng",
  France:"fra", Germany:"ger", "Republic of Ireland":"irl", Italy:"ita", Japan:"jpn",
  "South Korea":"kor", Mexico:"mex", Nigeria:"nga", Paraguay:"par", Poland:"pol",
  Portugal:"por", Russia:"rus", "Saudi Arabia":"ksa", Senegal:"sen", Slovenia:"slo",
  "South Africa":"rsa", Spain:"esp", Sweden:"swe", Tunisia:"tun", Turkey:"tur",
  Uruguay:"uru", "United States":"usa"
};
const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const candidateData = JSON.parse(await readFile("artifacts/historical-club-candidates.json", "utf8"));
const rsssfAudit = JSON.parse(await readFile("artifacts/2002-roster-audit.json", "utf8"));
const fifaRosterAudit = JSON.parse(await readFile("artifacts/2002-fifa-roster-audit.json", "utf8"));
const teams = historical.tournaments["2002"] || [];
const rsssfCleanTeams = new Set((rsssfAudit.teams || []).filter(team => team.rosterClean).map(team => team.teamId));
const fifaSupplementaryCleanTeams = new Set((fifaRosterAudit.teams || []).filter(team => team.rosterClean).map(team => team.teamId));
const report = {
  year: 2002,
  wikipediaSource: WIKIPEDIA_URL,
  sourceDescription: "A 2002 team receives club candidates only when the final RSSSF roster, the Planet World Cup squad page and the Wikipedia squad table agree player-by-player on number/name, and both club and position archives agree. FIFA's 24 May release is reported as supplementary because it predates some late replacements.",
  sourceStatus: "available",
  generatedAt: new Date().toISOString(),
  teams: [],
  summary: {}
};

try {
  const response = await fetch(WIKIPEDIA_URL, {
    headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (roster cross-check)" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error("Wikipedia HTTP " + response.status);
  const wikiRowsByTeam = parseWikipediaSquads(await response.text(), teams);
  const candidateTeams = candidateData.tournaments["2002"] || [];

  for (const team of teams) {
    const wikiRows = wikiRowsByTeam.get(team.id) || [];
    const slug = slugs[team.name];
    let planetRows = [];
    let planetStatus = "unavailable";
    let planetUrl = slug ? `https://www.planetworldcup.com/CUPS/2002/squad_${slug}02.html` : null;
    let planetError = null;
    if (planetUrl) {
      try {
        const planetResponse = await fetch(planetUrl, {
          headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (historical squad archive)" },
          signal: AbortSignal.timeout(15000)
        });
        if (!planetResponse.ok) throw new Error("HTTP " + planetResponse.status);
        planetRows = parsePlanetWorldCupSquad(await planetResponse.text());
        planetStatus = planetRows.length ? "available" : "parsed_no_players";
      } catch (error) {
        planetError = String(error);
      }
    }
    const players = team.players || [];
    const wikiByNumber = new Map(wikiRows.map(row => [row.number, row]));
    const planetByNumber = new Map(planetRows.map(row => [row.number, row]));
    const candidateTeam = candidateTeams.find(item => item.id === team.id);
    const item = {
      teamId: team.id, teamName: team.name, planetSource: planetUrl,
      planetSourceStatus: planetStatus, planetSourceError: planetError,
      rsssfRosterClean: rsssfCleanTeams.has(team.id),
      fifaSupplementaryRosterClean: fifaSupplementaryCleanTeams.has(team.id),
      wikipediaPlayerCount: wikiRows.length, planetPlayerCount: planetRows.length,
      datasetPlayerCount: players.length, matchedPlayers: 0,
      clubMatches: 0, positionMatches: 0,
      mismatches: [], clubMismatches: [], positionMismatches: [],
      clubsAssigned: 0
    };
    const assignments = [];

    for (const player of players) {
      const number = Number(player.number);
      const wiki = wikiByNumber.get(number);
      const planet = planetByNumber.get(number);
      if (!wiki || !planet) {
        item.mismatches.push({ number, field: "missing_source_row", player: player.name,
          wikipediaFound: Boolean(wiki), planetFound: Boolean(planet) });
        continue;
      }
      const wikiNameMatch = namesMatch(player.name, wiki.name) || namesMatch(wiki.name, player.name);
      const planetNameMatch = namesMatch(player.name, planet.name) || namesMatch(planet.name, player.name);
      if (!wikiNameMatch || !planetNameMatch) {
        item.mismatches.push({ number, field: "name", datasetName: player.name,
          wikipediaName: wiki.name, planetName: planet.name });
        continue;
      }
      item.matchedPlayers++;
      const wikiClub = normalizeHistoricalClub(wiki.club);
      const planetClub = normalizeHistoricalClub(planet.club);
      if (wiki.club && planet.club && wikiClub && wikiClub === planetClub) {
        item.clubMatches++;
      } else {
        item.clubMismatches.push({ number, player: player.name, wikipediaClub: wiki.club,
          planetWorldCupClub: planet.club, canonicalWikipediaClub: wikiClub, canonicalPlanetClub: planetClub });
      }
      const planetPosition = planet.position === "MD" ? "MF" : planet.position;
      if (wiki.position && planetPosition && wiki.position === planetPosition) {
        item.positionMatches++;
      } else {
        item.positionMismatches.push({ number, player: player.name,
          wikipediaPosition: wiki.position, planetWorldCupPosition: planetPosition });
      }
      const candidatePlayer = candidateTeam?.players?.find(entry => Number(entry.number) === number);
      assignments.push({ candidatePlayer, planet, wiki });
    }

    for (const row of wikiRows) {
      if (!players.some(player => Number(player.number) === row.number)) {
        item.mismatches.push({ number: row.number, field: "extra_wikipedia_row", sourceName: row.name });
      }
    }
    for (const row of planetRows) {
      if (!players.some(player => Number(player.number) === row.number)) {
        item.mismatches.push({ number: row.number, field: "extra_planet_row", sourceName: row.name });
      }
    }

    item.rosterComplete = wikiRows.length === 23 && planetRows.length === 23 &&
      item.matchedPlayers === players.length && item.mismatches.length === 0;
    item.clubsClean = item.rosterComplete && item.clubMatches === players.length &&
      item.clubMismatches.length === 0;
    item.positionsClean = item.rosterComplete && item.positionMatches === players.length &&
      item.positionMismatches.length === 0;
    item.clubCandidatesComplete = Boolean(candidateTeam) && item.rsssfRosterClean && item.clubsClean && item.positionsClean;

    if (item.clubCandidatesComplete && candidateTeam) {
      for (const assignment of assignments) {
        if (!assignment.candidatePlayer || !assignment.planet.club) continue;
        assignment.candidatePlayer.club = assignment.planet.club;
        assignment.candidatePlayer.position = assignment.planet.position === "MD" ? "MF" : assignment.planet.position;
        assignment.candidatePlayer.clubSource = planetUrl;
        item.clubsAssigned++;
      }
      item.clubCandidatesComplete = item.clubsAssigned === players.length;
    }
    report.teams.push(item);
  }

  report.summary = {
    expectedTeams: 32, parsedWikipediaTeams: wikiRowsByTeam.size,
    planetPagesAvailable: report.teams.filter(team => team.planetSourceStatus === "available").length,
    teamsWith23WikipediaPlayers: report.teams.filter(team => team.wikipediaPlayerCount === 23).length,
    teamsWith23PlanetPlayers: report.teams.filter(team => team.planetPlayerCount === 23).length,
    rsssfRosterCleanTeams: rsssfCleanTeams.size,
    fifaSupplementaryCleanTeams: fifaSupplementaryCleanTeams.size,
    teamsWithAllSourcesAndClubAgreement: report.teams.filter(team => team.clubCandidatesComplete).length,
    matchedPlayers: report.teams.reduce((sum, team) => sum + team.matchedPlayers, 0),
    clubMatches: report.teams.reduce((sum, team) => sum + team.clubMatches, 0),
    clubMismatches: report.teams.reduce((sum, team) => sum + team.clubMismatches.length, 0),
    positionMismatches: report.teams.reduce((sum, team) => sum + team.positionMismatches.length, 0),
    unresolvedMismatches: report.teams.reduce((sum, team) => sum + team.mismatches.length, 0),
    clubCandidatesAssigned: report.teams.reduce((sum, team) => sum + team.clubsAssigned, 0)
  };
  if (report.summary.clubCandidatesAssigned) {
    await writeFile("artifacts/historical-club-candidates.json", JSON.stringify(candidateData, null, 2) + "\n");
  }
} catch (error) {
  report.sourceStatus = "unavailable";
  report.sourceError = String(error);
  report.summary = {
    expectedTeams: 32, parsedWikipediaTeams: 0, planetPagesAvailable: 0,
    teamsWith23WikipediaPlayers: 0, teamsWith23PlanetPlayers: 0,
    rsssfRosterCleanTeams: rsssfCleanTeams.size, fifaSupplementaryCleanTeams: fifaSupplementaryCleanTeams.size,
    teamsWithAllSourcesAndClubAgreement: 0, matchedPlayers: 0, clubMatches: 0,
    clubMismatches: 0, positionMismatches: 0, unresolvedMismatches: 0, clubCandidatesAssigned: 0
  };
}

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/2002-club-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ sourceStatus: report.sourceStatus, ...report.summary }, null, 2));
