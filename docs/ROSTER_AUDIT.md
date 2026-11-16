# Roster and club-data audit

## Release rule

A team is eligible for any future ranked Normal play or Daily challenge only after every player has been checked by shirt number and identity against the final tournament roster, with position and tournament-time club checked against the official squad-list snapshot. Discrepancies must be resolved and recorded. A plausible team size or a copied third-party dataset is not proof.

## Sources

| Tournament | Primary source | Independent cross-check | Status |
|---|---|---|---|
| 2002 | RSSSF: https://www.rsssf.org/tables/2002full.html; FIFA roster transcription: https://www.lacancha.com/Roster.html | Contemporary Guardian squad previews and archived squad tables | No complete player/club audit; club data is missing from the imported dataset |
| 2006 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf | RSSSF tournament archive | No complete player/club audit |
| 2010 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf | RSSSF tournament archive | No complete player/club audit |
| 2014 | FIFA squad-list PDF: https://www.fifadata.com/document/FWC/2014/pdf/FWC_2014_SquadLists.pdf | RSSSF tournament archive | No complete player/club audit |
| 2018 | FIFA squad-list PDF: https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf | BBC confirmed squads: https://www.bbc.co.uk/sport/football/44083365 | No complete player/club audit |
| 2022 | FIFA final squad-list PDF: https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf | RSSSF tournament archive | No complete player/club audit |
| 2026 | FIFA final squad-list PDF: https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf | DFB data center, NBC Sports, federation and national Olympic committee announcements as specified per team | 20 of 48 teams fully audited; 28 remain unverified |

## 2026 audited teams

The 2026 FIFA PDF contains 48 team pages and records player, position and club data. The machine-readable player-by-player ledger is `data/roster-audit.json`. The weekly GitHub Actions workflow runs `scripts/audit-2026-fifa-pdf.mjs`, compares the FIFA PDF with the imported snapshot, and uploads a JSON discrepancy report. It does not approve teams automatically; independent secondary-source review remains mandatory.

- **Czechia / Czech Republic: 26/26.** FIFA page 15 and NBC Sports. FIFA uses “Czechia (CZE)”; the dataset uses “Czech Republic”, with the same code.
- **Australia: 26/26.** FIFA page 3 and NBC Sports.
- **Germany: 26/26.** FIFA page 20 and Bundesliga/DFB final-squad updates. The DFB replacement notice confirms Assan Ouédraogo replaced injured Lennart Karl; an older NBC list was stale.
- **France: 26/26.** FIFA page 19 and NBC Sports. FIFA position codes are retained where the secondary article groups players differently.
- **Argentina: 26/26.** FIFA page 2 and DFB data center. Nicolás González (#15) is FW in FIFA's final list; the upstream MF value was corrected to FW. Marcos Senesi (#2) is DF.
- **Brazil: 26/26.** FIFA page 7 and DFB data center. The CBF replacement notice confirms Éderson Silva replaced injured Wesley. Éderson Silva (#2, MF) and Ederson Moraes (#23, GK) are distinct players.
- **Algeria: 26/26.** FIFA page 1 and DFB data center.
- **Austria: 26/26.** FIFA page 4 and DFB data center.
- **Belgium: 26/26.** FIFA page 5 and DFB data center.
- **England: 26/26.** FIFA page 17 and DFB data center.
- **Japan: 26/26.** FIFA page 25 and DFB data center. The upstream snapshot incorrectly had Wataru Endo at #6; it was corrected to Shūto Machino.
- **Mexico: 26/26.** FIFA page 27 and DFB data center. FIFA's position codes are retained where the DFB groups players differently.
- **Spain: 26/26.** FIFA page 40 and DFB data center. FIFA's position codes are retained where the DFB groups players differently.
- **Portugal: 26/26.** FIFA page 34 and DFB data center. FIFA's position codes are retained where the DFB groups players differently.
- **Haiti: 26/26.** FIFA page 22 and DFB data center. The ledger records the differing FIFA/DFB player-name variants and the correction of #14 to Garven Metusala.
- **Curaçao: 26/26.** FIFA page 14 and DFB data center. Jürgen/ Juergen Locadia transliteration is treated as an alias.
- **Cape Verde: 26/26.** FIFA page 8 and DFB data center. FIFA/DFB display-name differences are recorded as aliases.
- **Jordan: 26/26.** FIFA page 26 and the Jordan Olympic Committee's final 26-player announcement.
- **Uzbekistan: 26/26.** FIFA page 48, Zamin.uz's final 26-player list and Yuz.uz's 16 June report confirming Ruslanbek Jiyanov replaced the injured Jaloliddin Masharipov.
- **Panama: 26/26.** FIFA page 33 and NBC Sports. FIFA position codes are retained where the secondary article groups players differently.

All three Daily tiers currently have at least three fully audited, non-excluded 2026 squads: Common 10, Niche 4 and Legendary 6. This is enough to publish three-team Daily schedules in every mode once the Supabase backend is deployed and synced. The other 28 teams remain unverified and must not be used in ranked modes.

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

The sync script and public build independently recheck the complete ledger before approving a team. They do not trust a boolean in the roster JSON.

## Daily exclusions and secure delivery

The fixed 50-squad exclusion list is stored in `data/daily-exclusions.json`. IDs refer to a specific country-and-tournament edition, not to the country globally. Migration `202611160001_daily_squad_exclusions.sql` copies those exact IDs to PostgreSQL, excludes them in the publisher, deletes old schedules containing them, and installs a database trigger that rejects future inserts or updates for excluded teams. Migration `202611160004_secure_public_rosters.sql` keeps verified Normal-mode answer names server-side until a correct guess or game completion. Migration `202611160005_independent_daily_tiers.sql` lets each ready Daily tier publish independently. Migration `202611160006_daily_rarity_reveals.sql` includes player rarity when missed Daily players are revealed.

The current V4 static build publishes all 240 local rosters in `dist/data/practice-rosters.json` so every squad can be played offline. This is intentionally unranked; answer names are inspectable in the browser. The private-answer protections in the Supabase migrations are reserved for a later online release and are not active in the current browser app.
