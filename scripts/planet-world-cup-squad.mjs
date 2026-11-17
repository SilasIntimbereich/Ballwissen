function decode(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function parsePlanetWorldCupSquad(html) {
  const text = decode(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:tr|p|div|pre|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
  const players = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const match = line.match(/^(\d{1,2})\s+(GK|DF|MD|MF|FW)\s+(.+?)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+)$/i);
    if (!match) continue;
    const club = match[5]
      .replace(/\s+\d{4}(?:,\d{2})*\s*$/, "")
      .replace(/\s*\([A-Z]{3}\)\s*$/i, "")
      .trim();
    players.push({
      number: Number(match[1]),
      position: match[2].toUpperCase() === "MD" ? "MF" : match[2].toUpperCase(),
      name: match[3].trim(),
      club
    });
  }
  return players;
}
