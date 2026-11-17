import { readFile, writeFile, mkdir } from "node:fs/promises";
import { namesMatch } from "./historical-player-name-match.mjs";
import { parseWikipediaSquads, normalizeHistoricalClub } from "./historical-wikipedia-squads.mjs";
import { parsePlanetWorldCupSquad, decodePlanetWorldCupResponse } from "./planet-world-cup-squad.mjs";

const sources = {
  2010: {
    wikipedia: "https://en.wikipedia.org/wiki/2010_FIFA_World_Cup_squads",
    slugs: {
      Algeria:"alg", Argentina:"arg", Australia:"aus", Brazil:"bra", Cameroon:"cmr",
      Chile:"chi", Denmark:"den", England:"eng", France:"fra", Germany:"ger", Ghana:"gha",
      Greece:"gre", Honduras:"hon", Italy:"ita", "Ivory Coast":"civ", Japan:"jpn",
      Mexico:"mex", Netherlands:"ned", "New Zealand":"nzl", Nigeria:"nga", "North Korea":"prk",
      Paraguay:"par", Portugal:"por", Serbia:"srb", Slovakia:"svk", Slovenia:"slo",
      "South Africa":"rsa", "South Korea":"kor", Spain:"esp", Switzerland:"sui",
      "United States":"usa", Uruguay:"uru"
    }
  },
  2014: {
    wikipedia: "https://en.wikipedia.org/wiki/2014_FIFA_World_Cup_squads",
    slugs: {
      Algeria:"alg", Argentina:"arg", Australia:"aus", Belgium:"bel",
      "Bosnia and Herzegovina":"bih", Brazil:"bra", Cameroon:"cmr", Chile:"chi",
      Colombia:"col", "Costa Rica":"crc", Croatia:"cro", Ecuador:"ecu", England:"eng",
      France:"fra", Germany:"ger", Ghana:"gha", Greece:"gre", Honduras:"hon", Iran:"irn",
      Italy:"ita", "Ivory Coast":"civ", Japan:"jpn", Mexico:"mex", Netherlands:"ned",
      Nigeria:"nga", Portugal:"por", Russia:"rus", "South Korea":"kor", Spain:"esp",
      Switzerland:"sui", "United States":"usa", Uruguay:"uru"
    }
  },
  2018: {
    wikipedia: "https://en.wikipedia.org/wiki/2018_FIFA_World_Cup_squads",
    slugs: {
      Argentina:"arg", Australia:"aus", Belgium:"bel", Brazil:"bra", Colombia:"col",
      "Costa Rica":"crc", Croatia:"cro", Denmark:"den", Egypt:"egy", England:"eng",
      France:"fra", Germany:"ger", Iceland:"isl", Iran:"irn", Japan:"jpn", Mexico:"mex",
      Morocco:"mar", Nigeria:"nga", Panama:"pan", Peru:"per", Poland:"pol", Portugal:"por",
      Russia:"rus", "Saudi Arabia":"ksa", Senegal:"sen", Serbia:"srb", "South Korea":"kor",
      Spain:"esp", Sweden:"swe", Switzerland:"sui", Tunisia:"tun", Uruguay:"uru"
    }
  }
};
const historical = JSON.parse(await readFile("data/historical-squads.json", "utf8"));
const candidates = JSON.parse(await readFile("artifacts/historical-club-candidates.json", "utf8"));
const report = {
  generatedAt: new Date().toISOString(),
  sourceDescription: "Cross-checks each squad against Wikipedia and Planet World Cup. When FIFA PDF-derived club candidates are available, they are an additional check. Clubs are approved only when both independent archives agree on every player and any available FIFA candidate does not conflict.",
  tournaments: {},
  summary: {}
};

for (const [year, config] of Object.entries(sources)) {
  const teams = historical.tournaments[year] || [];
  const candidateTeams = candidates.tournaments[year] || [];
  const yearReport = {
    year: Number(year), source: config.wikipedia, sourceStatus: "available",
    teams: [], summary: {}
  };
  try {
    const response = await fetch(config.wikipedia, {
      headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (roster cross-check)" },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error("Wikipedia HTTP " + response.status);
    const wikiRowsByTeam = parseWikipediaSquads(await response.text(), teams);

    for (const team of teams) {
      const wikiRows = wikiRowsByTeam.get(team.id) || [];
      const slug = config.slugs[team.name];
      const planetUrl = slug ? `https://www.planetworldcup.com/CUPS/${year}/squad_${slug}${String(year).slice(-2)}.html` : null;
      let planetRows = [];
      let planetStatus = "unavailable";
      let planetError = null;
      if (planetUrl) {
        try {
          const planetResponse = await fetch(planetUrl, {
            headers: { "User-Agent": "FootballArcadeHistoricalAudit/1.0 (historical squad archive)" },
            signal: AbortSignal.timeout(15000)
          });
          if (!planetResponse.ok) throw new Error("HTTP " + planetResponse.status);
          planetRows = parsePlanetWorldCupSquad(await decodePlanetWorldCupResponse(planetResponse));
          planetStatus = planetRows.length ? "available" : "parsed_no_players";
        } catch (error) {
          planetError = String(error);
        }
      }

      const players = team.players || [];
      const wikiByNumber = new Map(wikiRows.map(row => [row.number, row]));
      const planetByNumber = new Map(planetRows.map(row => [row.number, row]));
      const candidateTeam = candidateTeams.find(item => item.id === team.id);
      const candidateByNumber = new Map((candidateTeam?.players || []).map(row => [Number(row.number), row]));
      const item = {
        teamId: team.id, teamName: team.name, planetSource: planetUrl,
        planetSourceStatus: planetStatus, planetSourceError: planetError,
        wikipediaPlayerCount: wikiRows.length, planetPlayerCount: planetRows.length,
        datasetPlayerCount: players.length, matchedPlayers: 0,
        clubMatches: 0, clubMismatches: [], positionMatches: 0, positionMismatches: [],
        fifaPdfCandidatePlayers: 0, fifaPdfCandidateMatches: 0, fifaPdfCandidateMismatches: [],
        mismatches: [], clubsAssigned: 0
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

        const fifaCandidate = candidateByNumber.get(number);
        if (fifaCandidate?.club && fifaCandidate?.clubSource) {
          item.fifaPdfCandidatePlayers++;
          if (normalizeHistoricalClub(fifaCandidate.club) === planetClub) {
            item.fifaPdfCandidateMatches++;
          } else {
            item.fifaPdfCandidateMismatches.push({ number, player: player.name,
              fifaClub: fifaCandidate.club, planetClub: planet.club, fifaSource: fifaCandidate.clubSource });
          }
        }
        assignments.push({ candidatePlayer: fifaCandidate, planet, wiki });
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

      item.rosterClean = wikiRows.length === players.length && planetRows.length === players.length &&
        item.matchedPlayers === players.length && item.mismatches.length === 0;
      item.clubsClean = item.rosterClean && item.clubMatches === players.length &&
        item.clubMismatches.length === 0;
      item.positionsClean = item.rosterClean && item.positionMatches === players.length &&
        item.positionMismatches.length === 0;
      item.fifaPdfAgreement = item.fifaPdfCandidatePlayers === 0 ? "unavailable" :
        item.fifaPdfCandidateMismatches.length ? "mismatch" :
        item.fifaPdfCandidatePlayers === players.length ? "complete" : "partial_agreement";
      item.independentArchivesAgree = item.rosterClean && item.clubsClean && item.positionsClean;
      item.fullyCrossChecked = Boolean(candidateTeam) && item.independentArchivesAgree && item.fifaPdfAgreement !== "mismatch";
      item.verificationLevel = item.fullyCrossChecked
        ? item.fifaPdfAgreement === "complete" ? "FIFA PDF + two independent archives" :
          item.fifaPdfAgreement === "partial_agreement" ? "two independent archives + partial FIFA PDF agreement" :
          "two independent archives"
        : "not verified";

      if (item.fullyCrossChecked && candidateTeam) {
        for (const assignment of assignments) {
          if (!assignment.candidatePlayer || !assignment.planet.club) continue;
          assignment.candidatePlayer.club = assignment.planet.club;
          assignment.candidatePlayer.position = assignment.planet.position === "MD" ? "MF" : assignment.planet.position;
          assignment.candidatePlayer.clubSource = planetUrl;
          item.clubsAssigned++;
        }
        item.fullyCrossChecked = item.clubsAssigned === players.length;
      }
      yearReport.teams.push(item);
    }

    yearReport.summary = {
      expectedTeams: 32, parsedWikipediaTeams: wikiRowsByTeam.size,
      planetPagesAvailable: yearReport.teams.filter(team => team.planetSourceStatus === "available").length,
      teamsWith23WikipediaPlayers: yearReport.teams.filter(team => team.wikipediaPlayerCount === 23).length,
      teamsWith23PlanetPlayers: yearReport.teams.filter(team => team.planetPlayerCount === 23).length,
      independentArchivesAgreeTeams: yearReport.teams.filter(team => team.independentArchivesAgree).length,
      fullyCrossCheckedTeams: yearReport.teams.filter(team => team.fullyCrossChecked).length,
      teamsWithCompleteFifaPdfComparison: yearReport.teams.filter(team => team.fifaPdfAgreement === "complete").length,
      matchedPlayers: yearReport.teams.reduce((sum, team) => sum + team.matchedPlayers, 0),
      clubMatches: yearReport.teams.reduce((sum, team) => sum + team.clubMatches, 0),
      clubMismatches: yearReport.teams.reduce((sum, team) => sum + team.clubMismatches.length, 0),
      positionMismatches: yearReport.teams.reduce((sum, team) => sum + team.positionMismatches.length, 0),
      fifaPdfCandidateMismatches: yearReport.teams.reduce((sum, team) => sum + team.fifaPdfCandidateMismatches.length, 0),
      unresolvedMismatches: yearReport.teams.reduce((sum, team) => sum + team.mismatches.length, 0),
      clubCandidatesAssigned: yearReport.teams.reduce((sum, team) => sum + team.clubsAssigned, 0)
    };
    if (yearReport.summary.clubCandidatesAssigned) {
      await writeFile("artifacts/historical-club-candidates.json", JSON.stringify(candidates, null, 2) + "\n");
    }
  } catch (error) {
    yearReport.sourceStatus = "unavailable";
    yearReport.sourceError = String(error);
    yearReport.summary = {
      expectedTeams: 32, parsedWikipediaTeams: 0, planetPagesAvailable: 0,
      teamsWith23WikipediaPlayers: 0, teamsWith23PlanetPlayers: 0,
      independentArchivesAgreeTeams: 0, fullyCrossCheckedTeams: 0,
      teamsWithCompleteFifaPdfComparison: 0, matchedPlayers: 0,
      clubMatches: 0, clubMismatches: 0, positionMismatches: 0,
      fifaPdfCandidateMismatches: 0, unresolvedMismatches: 0, clubCandidatesAssigned: 0
    };
  }
  report.tournaments[year] = yearReport;
}

report.summary = {
  tournaments: Object.keys(sources).length,
  teams: Object.values(report.tournaments).reduce((sum, item) => sum + item.teams.length, 0),
  fullyCrossCheckedTeams: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.fullyCrossCheckedTeams || 0), 0),
  clubCandidatesAssigned: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.clubCandidatesAssigned || 0), 0),
  clubMismatches: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.clubMismatches || 0), 0),
  fifaPdfCandidateMismatches: Object.values(report.tournaments).reduce((sum, item) => sum + (item.summary.fifaPdfCandidateMismatches || 0), 0),
  unavailableWikipediaSources: Object.values(report.tournaments).filter(item => item.sourceStatus !== "available").length
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/historical-secondary-squad-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
