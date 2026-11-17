function normalize(value) {
  return String(value || "")
    .replace(/\u0000/g, "fi")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "o")
    .replace(/[åÅ]/g, "a")
    .replace(/[łŁ]/g, "l")
    .replace(/[ß]/g, "ss")
    .replace(/[ıİ]/g, "i")
    .replace(/[œŒ]/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Explicit, reviewed display-name variants found in the 2006 final squad PDF.
const manualNameEquivalents = new Set([
  ["Juan Pablo Sorín", "Juan Sorin"],
  ["Juan Román Riquelme", "Juan Riquelme"],
  ["Leo Franco", "Leonardo Franco"],
  ["Lucho González", "Luis Gonzalez"]
].map(([a, b]) => [normalize(a), normalize(b)].sort().join("|")));

export function namesMatch(playerName, sourceName) {
  const source = String(sourceName || "");
  const manualPair = [normalize(playerName), normalize(source)].sort().join("|");
  if (manualNameEquivalents.has(manualPair)) return true;
  const sourceTokens = source
    .replace(/\u0000/g, "fi")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "o")
    .replace(/[åÅ]/g, "a")
    .replace(/[łŁ]/g, "l")
    .replace(/[ß]/g, "ss")
    .replace(/[ıİ]/g, "i")
    .replace(/[œŒ]/g, "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const playerParts = String(playerName || "")
    .trim()
    .split(/[\s-]+/)
    .map(normalize)
    .filter(Boolean);
  if (!playerParts.length) return false;
  const compactPlayer = normalize(playerName);
  const compactSource = normalize(source);
  if (compactPlayer && compactPlayer === compactSource) return true;
  // A short mononym or surname is too ambiguous to approve from a larger PDF
  // text line. It must match the source text exactly or be resolved manually.
  if (playerParts.length === 1 && compactPlayer.length < 4) return false;
  if (playerParts.every(part => sourceTokens.includes(part))) return true;
  return compactPlayer.length >= 5 && compactSource.includes(compactPlayer);
}
