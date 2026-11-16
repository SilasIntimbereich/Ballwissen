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
const normalize = s => String(s || "").replace(/\u00ad/g, "ffi").replace(/«/g, "fi").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const tokens = s => normalize(s).match(/[a-z0-9]+/g) || [];
const clubKey = s => normalize(String(s || "").replace(/\s*\([A-Z]{3}\)\s*$/, ""));
const report = { source: PDF_URL, pages: pdf.numPages, generatedAt: new Date().toISOString(), teams: [], summary: {} };

for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
  const page = await pdf.getPage(pageNo);
  const content = await page.getTextContent();
  const lineMap = new Map();
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const y = Math.round(item.transform[5] * 10) / 10;
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y).push({ x: item.transform[4], text: item.str.trim() });
  }
  const lines = [...lineMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x).map(x => x.text).join(" ").replace(/\s+/g, " ").trim());
  const heading = lines.find(line => /\([A-Z]{3}\)/.test(line) && !/SQUAD LIST|FIFA WORLD CUP/i.test(line));
  const code = heading?.match(/\(([A-Z]{3})\)/)?.[1] || null;
  const teamPlayers = code ? byCode.get(code) || [] : [];
  const fifaRows = [];
  const unparsed = [];
  for (const line of lines) {
    const m = line.match(/^(\d{1,2})\s+(GK|DF|MF|FW)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)$/);
    if (m) fifaRows.push({ number: Number(m[1]), position: m[2], nameArea: m[3], club: m[5], line });
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
    const nameMatches = nameVariants.some(variant => variant.length > 0 && variant.every(token => sourceTokens.has(token)));
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
  teamsMissingFromDataset: report.teams.filter(t => !t.datasetTeam).map(t => t.code)
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/fifa-2026-audit.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
if (report.teams.length !== 48 || report.summary.parsedTeams !== 48) {
  throw new Error("FIFA PDF extraction did not parse all 48 team pages. Inspect the uploaded audit artifact.");
}
