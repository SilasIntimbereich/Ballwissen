# Roster and club-data audit

## Release rule

A team is eligible for public Daily challenges and online leaderboards only after every player has been checked by shirt number and identity against the final tournament roster, with position and tournament-time club checked against the official squad-list snapshot. Discrepancies must be resolved and recorded. A plausible team size or a copied third-party dataset is not proof.

## Sources

| Tournament | Primary source | Independent cross-check | Status |
|---|---|---|---|
| 2002 | RSSSF: https://www.rsssf.org/tables/2002full.html; FIFA roster transcription: https://www.lacancha.com/Roster.html | Contemporary Guardian squad previews and archived squad tables | No complete player/club audit; club data is missing from the imported dataset |
| 2006 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf | RSSSF tournament archive | No complete player/club audit |
| 2010 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf | RSSSF tournament archive | No complete player/club audit |
| 2014 | FIFA squad-list PDF: https://www.fifadata.com/document/FWC/2014/pdf/FWC_2014_SquadLists.pdf | RSSSF tournament archive | No complete player/club audit |
| 2018 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf | BBC confirmed squads: https://www.bbc.co.uk/sport/football/44083365 | No complete player/club audit |
| 2022 | FIFA final squad-list PDF: https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf | RSSSF tournament archive | No complete player/club audit |
| 2026 | FIFA final squad-list PDF: https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf | DFB data center, NBC Sports, CBF/DFB federation announcements as specified per team | 7 of 48 teams fully audited; 41 remain unverified |

## 2026 audited teams

The 2026 FIFA PDF contains 48 team pages and records player, position and club data. The machine-readable player-by-player ledger is `data/roster-audit.json`.

- **Czechia / Czech Republic: 26/26.** FIFA page 15 and NBC Sports confirmed squad list. FIFA uses “Czechia (CZE)”; the dataset uses “Czech Republic”, with the same code.
- **Australia: 26/26.** FIFA page 3 and NBC Sports confirmed squad list.
- **Germany: 26/26.** FIFA page 20 and Bundesliga final squad list. The DFB's 5 June replacement notice confirms Assan Ouédraogo replaced injured Lennart Karl; an older NBC list was stale.
- **France: 26/26.** FIFA page 19 and NBC Sports confirmed squad list. FIFA position codes are retained where the secondary article groups players differently.
- **Argentina: 26/26.** FIFA page 2 and DFB data center. Nicolás González (#15) is MF in FIFA's final squad PDF; the DFB groups him under its tactical Sturm section, so the FIFA position code is retained. Marcos Senesi (#2) is DF.
- **Brazil: 26/26.** FIFA page 7 and DFB data center; the CBF's 7 June replacement notice confirms Éderson Silva replaced injured Wesley. Éderson Silva (#2, MF) and Ederson Moraes (#23, GK) are distinct players.
- **Algeria: 26/26.** FIFA page 1 and DFB data center. Player identities and shirt numbers were cross-checked; FIFA supplies the final position and club values.

These seven audits verify only these seven squads, not the full 2026 tournament. The other 41 teams remain unverified and must not be used in ranked Daily modes.

## Historical dataset status

The historical importer contains 192 teams and 4,511 player rows:

| Tournament | Teams | Player rows | Club values currently present | Fully audited teams |
|---|---:|---:|---:|---:|
| 2002 | 32 | 736 | 0 | 0 |
| 2006 | 32 | 736 | 0 | 0 |
| 2010 | 32 | 736 | 0 | 0 |
| 2014 | 32 | 736 | 0 | 0 |
| 2018 | 32 | 736 | 0 | 0 |
| 2022 | 32 | 831 | 0 | 0 |

The 2022 total of 831 matches FIFA's published squad total. That total alone does not prove every player row. Historical club fields remain intentionally empty until each team has a complete player-level audit. Do not substitute present-day clubs.

A repeated romanized display name appears in Korea DPR 2010: “Nam-Chol Pak” at shirt numbers 4 and 14. FIFA's 2010 list identifies two distinct people with different birthdates, positions and clubs (April 25 and Amrokgang). Keep both records; do not deduplicate by display name alone.

## Audit ledger requirements

Every verified team record must contain:
- `tournament`, `teamNameInDataset`, `teamNameInFifaPdf`, and ISO `reviewedAt`
- Exactly one player audit row per roster player
- Shirt number and normalized player identity
- Matching FIFA position and tournament-time club
- Primary and independent secondary HTTPS source URLs
- Status `matched` or `corrected`; unresolved, missing or extra rows block verification

The sync script independently rechecks the complete ledger before it can set `arcade_teams.verified=true`. It does not trust a boolean in the roster JSON.

## Daily exclusions

The fixed 50-squad exclusion list is stored in `data/daily-exclusions.json`. IDs refer to a specific country-and-tournament edition, not to the country globally. The SQL migration copies those exact IDs to `public.daily_excluded_squads`, excludes them in the publisher, deletes old schedules containing them, and installs a database trigger that rejects future inserts or updates for excluded teams. The API also fails closed for excluded, unverified or malformed schedules. These are code-level protections; the migrations and Edge Functions still need to be deployed to the Supabase project before live backend protection is active.
