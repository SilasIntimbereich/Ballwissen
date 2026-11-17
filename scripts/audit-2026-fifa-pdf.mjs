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
const clubKey = s => normalize(String(s || "").replace(/\s*\([A-Z]{3}\)\s*$/, ""));
const report = { source: PDF_URL, pages: pdf.numPages, generatedAt: new Date().toISOString(), teams: [], summary: {} };

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
    if (m) fifaRows.push({ number: Number(m[1]), position: m[2], nameArea: m[3], club: m[5] || null, line });
    else if (/^\d{1,2}\s+(GK|DF|MF|FW)\s+/.test(line)) unparsed.push(line);
  }
  const mismatches = [];
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
  report.teams.push({
    page: pageNo, code, heading, datasetTeam: teamPlayers[0]?.team || null,
    fifaPlayerRows: fifaRows.length, datasetPlayerRows: teamPlayers.length,
    parsed: fifaRows.length === 26, rowCountMatches: fifaRows.length === teamPlayers.length,
    mismatchCount: mismatches.length, mismatches, unparsedRows: unparsed
  });
}
report.summary = {
  pdfPages: pdf.numPages,
  parsedTeams: report.teams.filter(t => t.code && t.parsed).length,
  teamsWithNoMismatches: report.teams.filter(t => t.code && t.parsed && t.rowCountMatches && t.mismatchCount === 0).length,
  totalMismatches: report.teams.reduce((n, t) => n + t.mismatchCount, 0),
  teamsMissingFromDataset: report.teams.filter(t => !t.datasetTeam).map(t => t.code),
  teamsWithUnresolvedDifferences: report.teams.filter(t => t.mismatchCount > 0 || t.unparsedRows.length > 0).length,
  mismatchCountsByField: report.teams.flatMap(t => t.mismatches).reduce((counts, item) => { counts[item.field] = (counts[item.field] || 0) + 1; return counts; }, {}),
  note: "This is an extraction and comparison report, not an independent approval ledger. Name, position and club differences remain unresolved until manually checked against independent sources."
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
