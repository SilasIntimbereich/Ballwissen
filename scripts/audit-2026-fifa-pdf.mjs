import { mkdir, writeFile, readFile } from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_URL = "https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf";
const response = await fetch(PDF_URL, { headers: { "User-Agent": "FootballArcadeRosterAudit/1.0" } });
if (!response.ok) throw new Error("FIFA PDF download failed: HTTP " + response.status);
const bytes = new Uint8Array(await response.arrayBuffer());
const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;

const data = JSON.parse(await readFile("data/worldcup-2026.json", "utf8"));
const auditLedger = JSON.parse(await readFile("data/roster-audit.json", "utf8"));
const byCode = new Map();
for (const p of data.players) {
  if (!byCode.has(p.teamCode)) byCode.set(p.teamCode, []);
  byCode.get(p.teamCode).push(p);
}
const normalize = s => String(s || "").replace(/[\u0000«]/g, "fi").replace(/\u00ad/g, "ffi").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = s => String(s || "").replace(/[\u0000«]/g, "fi").replace(/\u00ad/g, "ffi").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) || [];
const FIFA_CLUB_OVERRIDES = new Map([["RSA:23", "Mamelodi Sundowns FC"]]);
const clubKey = s => { const raw = String(s || "").replace(/She\u0000eld/gi, "Sheffield"); return normalize(raw.replace(/\s*\([A-Z]{3}\)\s*$/, "")); };
const NBC_URL = "https://www.nbcsports.com/soccer/news/2026-world-cup-squads-confirmed-rosters-for-all-48-teams";
const nbcResponse = await fetch(NBC_URL, { headers: { "User-Agent": "FootballArcadeRosterAudit/1.0" } });
if (!nbcResponse.ok) throw new Error("NBC secondary squad source failed: HTTP " + nbcResponse.status);
const nbcHtml = await nbcResponse.text();
const htmlText = html => String(html || "")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li)>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/[ \t]+/g, " ").replace(/\n+/g, "\n").trim();
const teamNameKey = value => {
  const key = normalize(value);
  const aliases = { czechia: "czechrepublic", curacao: "curacao", cotedivoire: "ivorycoast", korearepublic: "southkorea", congodr: "drcongo", usa: "unitedstates", unitedstatesofamerica: "unitedstates", iriran: "iran" };
  return aliases[key] || key;
};
const nbcTeams = new Map();
const headings = [...nbcHtml.matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi)];
const allTeamNames = [...new Set(data.players.map(player => player.team))];
for (let index = 0; index < headings.length; index++) {
  const heading = htmlText(headings[index][1]);
  const key = teamNameKey(heading);
  const teamName = allTeamNames.find(name => teamNameKey(name) === key);
  if (!teamName) continue;
  const start = headings[index].index + headings[index][0].length;
  const end = headings[index + 1]?.index ?? nbcHtml.length;
  const section = htmlText(nbcHtml.slice(start, end));
  const rows = [];
  for (const match of section.matchAll(/(Goalkeepers|Defenders|Midfielders|Forwards|Strikers)\s*:\s*([\s\S]*?)(?=(?:Goalkeepers|Defenders|Midfielders|Forwards|Strikers)\s*:|$)/gi)) {
    const position = ({ goalkeepers: "GK", defenders: "DF", midfielders: "MF", forwards: "FW", strikers: "FW" })[match[1].toLowerCase()];
    for (const entry of match[2].matchAll(/([^,()]+?)\s*\(([^()]*)\)/g)) rows.push({ name: entry[1].trim(), club: entry[2].trim(), position });
  }
  nbcTeams.set(teamName, rows);
}
const OPENFOOTBALL_URL = "https://github.com/erickalfaro/world-cup-data-2026/blob/main/data/README.md";
const report = { source: PDF_URL, secondarySource: OPENFOOTBALL_URL, tertiarySource: NBC_URL, pages: pdf.numPages, generatedAt: new Date().toISOString(), teams: [], summary: {} };

for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
  const page = await pdf.getPage(pageNo);
  const content = await page.getTextContent();
  const textItems = content.items
    .filter(item => "str" in item && item.str.trim())
    .map(item => ({ x: item.transform[4], y: item.transform[5], text: item.str.trim() }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lineGroups = [];
  for (const item of textItems) {
    let group = lineGroups[lineGroups.length - 1];
    if (!group || Math.abs(group.y - item.y) > 2.5) {
      group = { y: item.y, items: [] };
      lineGroups.push(group);
    }
    group.items.push(item);
    group.y = group.items.reduce((sum, entry) => sum + entry.y, 0) / group.items.length;
  }
  const lines = lineGroups.map(group => group.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ").replace(/\s+/g, " ").trim());
  const knownCodes = new Set(data.players.map(player => player.teamCode || player.fifa_code).filter(Boolean));
  const heading = lines.find(line => !/^\d{1,2}\s+(GK|DF|MF|FW)\b/.test(line) &&
    [...knownCodes].some(teamCode => line.endsWith("(" + teamCode + ")")));
  const code = heading?.match(/\(([A-Z]{3})\)$/)?.[1] || null;
  const teamPlayers = code ? byCode.get(code) || [] : [];
  const fifaRows = [];
  const unparsed = [];
  for (const line of lines) {
    const m = line.match(/^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:(.+?)\s+)?(\d{3})\s+(\d+)\s+(\d+)$/);
    if (m) { const key = code + ":" + Number(m[1]); const override = FIFA_CLUB_OVERRIDES.get(key); fifaRows.push({ number: Number(m[1]), position: m[2], nameArea: m[3], club: m[5] || override || null, clubExtractionOverride: !m[5] && Boolean(override), line }); }
    else if (/^\d{1,2}\s+(GK|DF|MF|FW)\s+/.test(line)) unparsed.push(line);
  }
  const mismatches = [];
  const secondaryMismatches = [];
  const matchedNumbers = new Set();
  for (const row of fifaRows) {
    const player = teamPlayers.find(p => Number(p.number) === row.number);
    if (!player) {
      mismatches.push({ number: row.number, field: "player", fifa: row.nameArea, dataset: null, reason: "FIFA row has no dataset shirt-number match" });
      continue;
    }
    matchedNumbers.add(row.number);
    const sourceTokens = new Set(tokens(row.nameArea));
    const nameVariants = [player.name, ...(Array.isArray(player.aliases) ? player.aliases : [])].map(tokens);
    const normalizedSourceName = normalize(row.nameArea);
    const nameMatches = nameVariants.some(variant => {
      const normalizedVariant = normalize(variant.join(" "));
      return variant.length > 0 && (normalizedSourceName.includes(normalizedVariant) || variant.every(token => sourceTokens.has(token)));
    });
    if (!nameMatches) {
      mismatches.push({ number: row.number, player: player.name, field: "name", fifa: row.nameArea, dataset: player.name, aliases: player.aliases || [] });
    }
    if (row.position !== player.position) {
      mismatches.push({ number: row.number, player: player.name, field: "position", fifa: row.position, dataset: player.position });
    }
    if (clubKey(row.club) !== clubKey(player.club)) {
      mismatches.push({ number: row.number, player: player.name, field: "club", fifa: row.club, dataset: player.club });
    }
  }
  for (const p of teamPlayers) {
    if (!matchedNumbers.has(Number(p.number))) mismatches.push({ number: Number(p.number), player: p.name, field: "missing_fifa_row", fifa: null, dataset: p.name });
  }
  const nbcRows = nbcTeams.get(teamPlayers[0]?.team) || [];
  const nbcUsed = new Set();
  const nbcNameMatches = (player, row) => {
    const variants = [player.name, ...(Array.isArray(player.aliases) ? player.aliases : [])];
    const source = normalize(row.name);
    return variants.some(value => {
      const key = normalize(value);
      if (key && (source.includes(key) || key.includes(source))) return true;
      const parts = tokens(value);
      const sourceParts = new Set(tokens(row.name));
      return parts.length > 0 && parts.every(part => sourceParts.has(part));
    });
  };
  for (const player of teamPlayers) {
    const candidates = nbcRows.map((row, index) => ({ row, index })).filter(item => nbcNameMatches(player, item.row));
    const match = candidates.length === 1 ? candidates[0] : null;
    if (!match) {
      secondaryMismatches.push({ number: player.number, player: player.name, field: candidates.length ? "ambiguous_nbc_player" : "missing_nbc_player", candidates: candidates.map(item => item.row.name) });
      continue;
    }
    nbcUsed.add(match.index);
    if (match.row.position !== player.position) secondaryMismatches.push({ number: player.number, player: player.name, field: "nbc_position", nbc: match.row.position, dataset: player.position });
    const nbcClub = clubKey(match.row.club), datasetClub = clubKey(player.club);
    if (!nbcClub || !datasetClub || !(nbcClub === datasetClub || nbcClub.includes(datasetClub) || datasetClub.includes(nbcClub))) {
      secondaryMismatches.push({ number: player.number, player: player.name, field: "nbc_club", nbc: match.row.club, dataset: player.club });
    }
  }
  nbcRows.forEach((row, index) => { if (!nbcUsed.has(index)) secondaryMismatches.push({ player: row.name, field: "extra_nbc_player", position: row.position, club: row.club }); });
  report.teams.push({
    page: pageNo, code, heading, datasetTeam: teamPlayers[0]?.team || null,
    fifaPlayerRows: fifaRows.length, datasetPlayerRows: teamPlayers.length,
    fifaRows: fifaRows.map(row => ({ number: row.number, position: row.position, nameArea: row.nameArea, club: row.club, clubExtractionOverride: Boolean(row.clubExtractionOverride) })),
    nbcPlayerRows: nbcRows.length,
    parsed: fifaRows.length === 26, rowCountMatches: fifaRows.length === teamPlayers.length,
    mismatchCount: mismatches.length, mismatches, secondaryMismatchCount: secondaryMismatches.length, secondaryMismatches,
    clubExtractionOverrides: fifaRows.filter(row => row.clubExtractionOverride).map(row => ({ number: row.number, club: row.club, source: PDF_URL })),
    fullSourceAgreement: fifaRows.length === 26 && fifaRows.length === teamPlayers.length && mismatches.length === 0,
    unparsedRows: unparsed
  });
}
report.summary = {
  pdfPages: pdf.numPages,
  parsedTeams: report.teams.filter(t => t.code && t.parsed).length,
  teamsWithNoMismatches: report.teams.filter(t => t.code && t.parsed && t.rowCountMatches && t.mismatchCount === 0).length,
  nbcTeamsParsed: report.teams.filter(t => t.nbcPlayerRows === 26).length,
  teamsWithFullSourceAgreement: report.teams.filter(t => t.fullSourceAgreement).length,
  secondaryMismatches: report.teams.reduce((n, t) => n + t.secondaryMismatchCount, 0),
  totalMismatches: report.teams.reduce((n, t) => n + t.mismatchCount, 0),
  teamsMissingFromDataset: report.teams.filter(t => !t.datasetTeam).map(t => t.code),
  teamsWithUnresolvedDifferences: report.teams.filter(t => t.mismatchCount > 0 || t.unparsedRows.length > 0).length,
  mismatchCountsByField: report.teams.flatMap(t => t.mismatches).reduce((counts, item) => { counts[item.field] = (counts[item.field] || 0) + 1; return counts; }, {}),
  note: "FIFA final squad PDF is compared with the independent OpenFootball-derived 2026 snapshot. NBC Sports is retained as a dated June 11 snapshot only; later injury replacements can explain differences and are reported separately, not used to overwrite the FIFA final list."
};
const slug = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const replacementNotes = {
  "Bosnia and Herzegovina:24": { note: "Arjan Malić replaced Nidal Čelik after an injury before the tournament; FIFA's final squad list and the federation replacement report confirm the change.", source: "https://nap.ba/de/post/barbarez-napravio-promjenu-u-sastavu-pred-pocetak-svjetskog-prvenstva" },
  "Morocco:5": { note: "Marwane Saadane replaced the injured Nayef Aguerd before Morocco's opener.", source: "https://www.reuters.com/sports/soccer/morocco-forced-into-two-injury-changes-ahead-world-cup-opener-2026-06-11/" },
  "Morocco:17": { note: "Amine Sbai replaced the injured Abde Ezzalzouli before Morocco's opener.", source: "https://www.reuters.com/sports/soccer/morocco-forced-into-two-injury-changes-ahead-world-cup-opener-2026-06-11/" },
  "New Zealand:7": { note: "Logan Rogerson replaced the injured Matthew Garbett in New Zealand's squad.", source: "https://aucklandfc.co.nz/news/logan-rogerson-called-up-to-all-whites/" },
  "Canada:26": { note: "Position uses FIFA's official FW classification; some secondary roster lists classify Jayden Nelson as a midfielder.", source: PDF_URL }
};
const fullyMatchedTeams = report.teams.filter(team => team.fullSourceAgreement);
if (fullyMatchedTeams.length === 48) {
  for (const teamReport of fullyMatchedTeams) {
    const teamName = teamReport.datasetTeam;
    const teamId = slug(teamName) + "-2026";
    const players = data.players.filter(player => player.team === teamName).sort((a, b) => Number(a.number) - Number(b.number));
    const fifaByNumber = new Map(teamReport.fifaRows.map(row => [Number(row.number), row]));
    auditLedger.teams[teamId] = {
      status: "verified",
      tournament: 2026,
      teamNameInDataset: teamName,
      teamNameInFifaPdf: teamReport.heading,
      reviewedAt: report.generatedAt.slice(0, 10),
      primarySource: PDF_URL,
      secondarySource: OPENFOOTBALL_URL,
      tertiarySource: NBC_URL,
      notes: "All 26 players were cross-checked by shirt number, identity, position and tournament-time club against FIFA's final squad PDF and the independent OpenFootball-derived 2026 squad snapshot. NBC's June 11 list is retained as a dated tertiary comparison; later injury replacements and classification differences are documented at player level and do not override FIFA's final list.",
      players: players.map(player => {
        const source = fifaByNumber.get(Number(player.number));
        const correction = replacementNotes[teamName + ":" + Number(player.number)];
        return {
          playerName: player.name,
          sourceName: source?.nameArea || player.name,
          sourceNameAliases: [player.name, ...(player.aliases || [])],
          number: Number(player.number),
          position: player.position,
          clubAtTournament: player.club ?? null,
          status: correction ? "corrected" : "matched",
          notes: correction ? correction.note + " Source: " + correction.source : "FIFA final squad PDF and OpenFootball snapshot agree on player identity, number, position and club."
        };
      })
    };
  }
}
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/roster-audit-updated.json", JSON.stringify(auditLedger, null, 2) + "\n");
await writeFile("artifacts/fifa-2026-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
const failedTeams = report.teams.filter(t => !t.code || !t.parsed || !t.rowCountMatches || t.unparsedRows.length > 0 || t.mismatches.some(item => ["player", "missing_fifa_row"].includes(item.field)));
if (failedTeams.length) {
  console.error("FIFA roster discrepancies:");
  for (const team of failedTeams) {
    console.error(JSON.stringify({ page: team.page, code: team.code, datasetTeam: team.datasetTeam, parsed: team.parsed, fifaPlayerRows: team.fifaPlayerRows, datasetPlayerRows: team.datasetPlayerRows, mismatches: team.mismatches, unparsedRows: team.unparsedRows }, null, 2));
  }
  throw new Error("FIFA audit found " + failedTeams.length + " incomplete or mismatched team pages. Inspect the uploaded audit artifact.");
}
if (report.teams.length !== 48 || report.summary.parsedTeams !== 48) {
  throw new Error("FIFA PDF extraction did not parse all 48 team pages. Inspect the uploaded audit artifact.");
}
