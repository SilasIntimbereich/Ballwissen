# Roster and club-data audit

## Release rule

A team is eligible for any future ranked Normal play or Daily challenge only after every player has been checked by shirt number and identity against the final tournament roster, with position and tournament-time club checked against the official squad-list snapshot. Discrepancies must be resolved and recorded. A plausible team size or a copied third-party dataset is not proof.

## Sources

| Tournament | Primary source | Independent cross-check | Status |
|---|---|---|---|
| 2002 | RSSSF: https://www.rsssf.org/tables/2002full.html; FIFA roster transcription: https://www.lacancha.com/Roster.html | Contemporary Guardian squad previews and archived squad tables | 0/32 fully audited; no tournament-time club data approved |
| 2006 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf | ABC News final squad list | 32/32 fully audited |
| 2010 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf | UEFA confirmed squad lists and 11v11 | 9/32 fully audited |
| 2014 | FIFA squad-list PDF: https://www.fifadata.com/document/FWC/2014/pdf/FWC_2014_SquadLists.pdf | The Guardian final Germany squad list | 1/32 fully audited (Germany) |
| 2018 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf | 11v11 and BBC confirmed squad list | 1/32 fully audited (Germany) |
| 2022 | FIFA final squad-list PDF: https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf | 11v11 Germany squad database | 1/32 fully audited (Germany) |
| 2026 | FIFA final squad-list PDF: https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf | OpenFootball 2026 snapshot, checked player-by-player against FIFA | 48/48 fully audited; 0 unresolved FIFA/OpenFootball differences |

## 2026 audited teams

All **48 of 48** 2026 squads have now been compared player-by-player against the FIFA final squad-list PDF and the OpenFootball-derived snapshot. The 17 November 2026 audit report records 48 parsed teams, 48 teams with no FIFA/source mismatches, 48 teams with full FIFA/OpenFootball agreement, and zero unresolved differences.

Each verified team has 26 player rows with matching identity, shirt number, position and tournament-time club. The machine-readable ledger is `data/roster-audit.json`; the reproducible check is `scripts/audit-2026-fifa-pdf.mjs`.

NBC Sports is retained only as a dated 11 June snapshot. It differs from the later final squad list in many places because it predates subsequent changes and is not used to overwrite FIFA final data. Its differences are recorded separately in the audit report.

All three Daily tiers have sufficient verified 2026 squads, subject to the existing exact squad exclusions and independent publication checks.

## Historical dataset status

The historical importer contains 192 teams and 4,511 player rows. **44 historical teams are fully audited** (1,015 player rows), including tournament-time clubs:

| Tournament | Teams | Player rows | Fully audited teams |
|---|---:|---:|---:|
| 2002 | 32 | 736 | 0 |
| 2006 | 32 | 736 | 32 |
| 2010 | 32 | 736 | 9 |
| 2014 | 32 | 736 | 1 |
| 2018 | 32 | 736 | 1 |
| 2022 | 32 | 831 | 1 |

The audited historical editions are all 32 teams from 2006; Germany, Spain, Netherlands, Brazil, Argentina, Uruguay, England, France and Italy from 2010; and Germany from 2014, 2018 and 2022. The other 148 historical teams remain unverified and must not be used in ranked Normal or Daily modes.

For audited historical teams, player identity, number, position and tournament-time club have been cross-checked against the listed primary and secondary sources. Club fields for unaudited historical teams remain blank; do not substitute present-day clubs.

The 2022 total of 831 matches FIFA published squad total. That total alone does not prove every player row. A repeated romanized display name appears in Korea DPR 2010: “Nam-Chol Pak” at shirt numbers 4 and 14. FIFA 2010 list identifies two distinct people with different birthdates, positions and clubs (April 25 and Amrokgang). Keep both records; do not deduplicate by display name alone.

**Current overall audit count: 92 of 240 squads** (48 from 2026 and 44 historical). The remaining 148 historical squads are still outstanding.

## Audit ledger requirements

Every verified team record must contain:
- `tournament`, `teamNameInDataset`, `teamNameInFifaPdf`, and ISO `reviewedAt`
- Exactly one player audit row per roster player
- Shirt number and normalized player identity
- Matching FIFA position and tournament-time club
- Primary and independent secondary HTTPS source URLs
- Status `matched` or `corrected`; unresolved, missing or extra rows block verification

The sync script and public build independently recheck the complete ledger before approving a team. They do not trust a boolean in the roster JSON.

## Daily exclusions and secure delivery

The fixed 50-squad exclusion list is stored in `data/daily-exclusions.json`. IDs refer to a specific country-and-tournament edition, not to the country globally. Migration `202611160001_daily_squad_exclusions.sql` copies those exact IDs to PostgreSQL, excludes them in the publisher, deletes old schedules containing them, and installs a database trigger that rejects future inserts or updates for excluded teams. Migration `202611160004_secure_public_rosters.sql` keeps verified Normal-mode answer names server-side until a correct guess or game completion. Migration `202611160005_independent_daily_tiers.sql` lets each ready Daily tier publish independently. Migration `202611160006_daily_rarity_reveals.sql` includes player rarity when missed Daily players are revealed.

The current V4 static build publishes all 240 local rosters in `dist/data/practice-rosters.json` so every squad can be played offline. This is intentionally unranked; answer names are inspectable in the browser. The private-answer protections in the Supabase migrations are reserved for a later online release and are not active in the current browser app.
