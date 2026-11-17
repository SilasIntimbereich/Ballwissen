const normalize = value => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const teamAliases = {
  chinapr: "china",
  korearepublic: "southkorea",
  korea: "southkorea",
  usa: "unitedstates",
  ireland: "republicofireland"
};

function plainText(value) {
  return String(value || "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<span\b[^>]*class=["'][^"']*flagicon[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\[\d+\]$/g, "")
    .replace(/\s*\(c\)$/i, "")
    .replace(/\s*\[edit\]$/i, "")
    .trim();
}

export function parseWikipediaSquads(html, teams) {
  const expected = new Map(teams.map(team => [normalize(team.name), team]));
  const sections = [...String(html).matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  const parsed = new Map();

  for (let i = 0; i < sections.length; i++) {
    const heading = plainText(sections[i][1]);
    const key = normalize(heading);
    const team = expected.get(teamAliases[key] || key);
    if (!team) continue;

    const start = sections[i].index + sections[i][0].length;
    const end = sections[i + 1]?.index ?? html.length;
    const section = html.slice(start, end);
    const table = section.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!table) {
      parsed.set(team.id, []);
      continue;
    }

    const rows = [];
    for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...match[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
        .map(cell => plainText(cell[1]));
      if (cells.length < 6 || !/^\d{1,2}$/.test(cells[0])) continue;
      const position = cells[1].match(/\b(GK|DF|MF|FW)\b/i)?.[1]?.toUpperCase() || null;
      const name = cells[2].replace(/\s*\(c\)$/i, "").trim();
      const club = cells[cells.length - 1].trim();
      if (!name) continue;
      rows.push({ number: Number(cells[0]), position, name, club });
    }
    parsed.set(team.id, rows);
  }

  return parsed;
}

export function normalizeHistoricalClub(value) {
  return normalize(value)
    .replace(/^(?:afc|fc|cf|ac|sc|as|ss|us|cd|rc|rsc|bsc|vfl|sv|fk|nk|hnk|uc|ud|sd|tsg|ogc|kv|kas|1fc|1)/, "")
    .replace(/(?:fc|cf|sc|afc|sfc|if|bk|jk|vv|calcio)$/, "");
}
