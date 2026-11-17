const GENERIC_HEADING = /^(?:FIFA WORLD CUP.*|SQUAD LIST|LIST OF PLAYERS|LIST OF PLAYER|TEAM SQUAD|SQUAD)$/i;
const TABLE_HEADING = /^(?:#|POS|POSITION|PLAYER|NAME|DOB|DATE OF BIRTH|CLUB|HEIGHT|CAPS|GOALS)(?:\s|$)/i;

function usableHeading(line) {
  const value = String(line || "").replace(/\s+/g, " ").trim();
  return Boolean(value) &&
    value.length <= 80 &&
    !GENERIC_HEADING.test(value) &&
    !TABLE_HEADING.test(value) &&
    !/^\d+\s/.test(value) &&
    !/^(?:coach|head coach|manager)\b/i.test(value);
}

/**
 * Extract the country heading from a single FIFA squad-list PDF page.
 * FIFA's older PDFs use "List of Players" followed by a country name;
 * Qatar 2022 uses the generic "SQUAD LIST" label and a country-code heading.
 */
export function extractTeamHeading(lines) {
  const values = (Array.isArray(lines) ? lines : [])
    .map(line => String(line || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const countryCodeHeading = values.find(line =>
    usableHeading(line) && /\([A-Z]{3}\)\s*$/.test(line)
  );
  if (countryCodeHeading) return countryCodeHeading;

  const listIndex = values.findIndex(line => /^(?:LIST OF PLAYERS|SQUAD LIST)$/i.test(line));
  if (listIndex >= 0) {
    const followingHeading = values.slice(listIndex + 1).find(usableHeading);
    if (followingHeading) return followingHeading;
  }

  return values.find(usableHeading) || "";
}
