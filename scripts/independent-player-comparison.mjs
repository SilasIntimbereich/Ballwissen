export function isCompleteIndependentPlayerComparison(row) {
  return Boolean(row?.identityMatches === true &&
    row?.clubMatches === true &&
    row?.positionMatches === true &&
    typeof row.fifaClub === "string" && row.fifaClub.trim() &&
    typeof row.secondaryClub === "string" && row.secondaryClub.trim() &&
    typeof row.fifaPosition === "string" && row.fifaPosition.trim() &&
    typeof row.secondaryPosition === "string" && row.secondaryPosition.trim());
}
