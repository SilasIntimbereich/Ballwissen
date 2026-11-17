const GENERIC_HEADING = /^(?:FIFA WORLD CUP.*|SQUAD LIST|LIST OF PLAYERS|LIST OF PLAYER|TEAM SQUAD|SQUAD)$/i;
const TABLE_HEADING = /^(?:#|POS|POSITION|PLAYER|NAME|DOB|DATE OF BIRTH|CLUB|HEIGHT|CAPS|GOALS)(?:\s|$)/i;
const POSITION_LEGEND = /^GK\s*:\s*Goalkeeper.*DF\s*:\s*Defender.*MF\s*:\s*Midfielder.*FW\s*:\s*Forward$/i;
const DATE_HEADING = /^(?:DOB:|POS:|DATE OF BIRTH|(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s+\d{1,2}\s+\w+\s+\d{4})/i;

function normalizeHeading(value) {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function usableHeading(line) {
  const value = String(line || "").replace(/\s+/g, " ").trim();
  return Boolean(value) &&
    value.length <= 80 &&
    !GENERIC_HEADING.test(value) &&
    !TABLE_HEADING.test(value) &&
    !POSITION_LEGEND.test(value) &&
    !DATE_HEADING.test(value) &&
    !/^\d+\s/.test(value) &&
    !/^(?:coach|head coach|manager)\b/i.test(value);
}

/**
 * Extract a country heading from a single FIFA squad-list PDF page.
 * Prefer FIFA country-code headings, then exact known tournament team names.
 */
export function extractTeamHeading(lines, knownTeams = []) {
  const values = (Array.isArray(lines) ? lines : [])
    .map(line => String(line || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const countryCodeHeading = values.find(line =>
    usableHeading(line) && /\([A-Z]{3}\)\s*$/.test(line)
  );
  if (countryCodeHeading) return countryCodeHeading;

  const known = new Set(knownTeams.map(normalizeHeading));
  const knownHeading = values.find(line =>
    usableHeading(line) && known.has(normalizeHeading(line))
  );
  if (knownHeading) return knownHeading;

  const listIndex = values.findIndex(line => /^(?:LIST OF PLAYERS|SQUAD LIST)$/i.test(line));
  if (listIndex >= 0) {
    const followingHeading = values.slice(listIndex + 1).find(usableHeading);
    if (followingHeading) return followingHeading;
  }

  return values.find(usableHeading) || "";
}
