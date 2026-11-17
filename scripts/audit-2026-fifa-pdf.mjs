import { mkdir, writeFile } from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_URL = "https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf";
const response = await fetch(PDF_URL, { headers: { "User-Agent": "FootballArcadeRosterAudit/1.0" } });
if (!response.ok) throw new Error("FIFA PDF download failed: HTTP " + response.status);
const bytes = new Uint8Array(await response.arrayBuffer());
const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;

const data = JSON.parse(await (await import("node:fs/promises")).readFile("data/worldcup-2026.json", "utf8"));
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
const report = { source: PDF_URL, secondarySource: NBC_URL, pages: pdf.numPages, generatedAt: new Date().toISOString(), teams: [], summary: {} };

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
    nbcPlayerRows: nbcRows.length,
    parsed: fifaRows.length === 26, rowCountMatches: fifaRows.length === teamPlayers.length,
    mismatchCount: mismatches.length, mismatches, secondaryMismatchCount: secondaryMismatches.length, secondaryMismatches,,
    clubExtractionOverrides: fifaRows.filter(row => row.clubExtractionOverride).map(row => ({ number: row.number, club: row.club, source: PDF_URL }))
    fullSourceAgreement: fifaRows.length === 26 && nbcRows.length === 26 && mismatches.length === 0 && secondaryMismatches.length === 0,
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
  note: "This compares the FIFA final squad PDF against the local dataset and NBC Sports as a second source. FIFA/NBC differences remain unresolved; this report does not automatically approve teams."
};
await mkdir("artifacts", { recursive: true });
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
