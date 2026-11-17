function normalize(value) {
  return String(value || "")
    .replace(/\u0000/g, "fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Conservative identity comparison for FIFA squad display-name fields.
 * It tolerates spacing/hyphenation and common PDF ligature extraction issues,
 * but does not infer nicknames or materially different transliterations.
 */
export function namesMatch(playerName, sourceName) {
  const source = String(sourceName || "");
  const sourceTokens = source
    .replace(/\u0000/g, "fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const playerParts = String(playerName || "")
    .trim()
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean);
  if (!playerParts.length) return false;
  if (playerParts.every(part => sourceTokens.includes(part))) return true;

  const compactPlayer = normalize(playerName);
  const compactSource = normalize(source);
  return compactPlayer.length >= 5 && compactSource.includes(compactPlayer);
}
