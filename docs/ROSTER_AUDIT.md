# Roster and club-data audit

## Release rule

A roster is eligible for public Daily challenges and online leaderboards only after:
1. Every player name has been checked against an independent source.
2. The team membership and tournament year match.
3. The position is checked where the source provides it.
4. The club is the player's registered club on the official squad-list snapshot for that tournament, not their current club.
5. Every discrepancy is resolved or explicitly marked unresolved.
6. The audit record stores the source URL, access date, and reviewer/status.

Do not set `verified: true` merely because the row count looks plausible or because two datasets copied from the same upstream agree.

## Independent source hierarchy

Use official FIFA squad-list documents as the primary source for final player lists and tournament-time clubs. Use RSSSF as an independent secondary check for historical squad membership and, where present, club details. A third-party database can be used for discovery and normalization, but not as the sole verification source.

| Tournament | Primary independent source located | Secondary source located | Club coverage/status |
|---|---|---|---|
| 2002 | RSSSF World Cup 2002 squads: https://www.rsssf.org/tables/2002full.html; FIFA-released roster transcription (names, shirt numbers, positions): https://www.lacancha.com/Roster.html | Contemporary Guardian squad preview with club references for selected teams: https://www.theguardian.com/football/2002/may/12/worldcupfootball2002.sport2; 2002 squad table with clubs dated 31 May 2002: https://en.wikipedia.org/wiki/2002_FIFA_World_Cup_squads | Candidate sources located, but a complete independent club audit for all 32 teams is still outstanding |
| 2006 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf | RSSSF tournament archive | Official club column available; full row-by-row comparison still pending |
| 2010 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf | RSSSF tournament archive | Official club column available; full row-by-row comparison still pending |
| 2014 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2014/pdf/fwc_2014_squadlists.pdf | RSSSF tournament archive | Official club column available; full row-by-row comparison still pending |
| 2018 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf | BBC confirmed squads: https://www.bbc.co.uk/sport/football/44083365 | Official club column available; full row-by-row comparison still pending |
| 2022 | FIFA official final squad-list PDF: https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf; FIFA announcement: https://www.fifa.com/en/articles/fifa-world-cup-qatar-2022-official-squad-announcement-32-teams | RSSSF tournament archive | Official 32-page PDF includes player name, position and tournament-time club fields; full row-by-row comparison with the imported JSON is still pending |
| 2026 | FIFA official squad-list PDF: https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf | NBC Sports confirmed squads: https://www.nbcsports.com/soccer/news/2026-world-cup-squads-confirmed-rosters-for-all-48-teams; Reuters final squad list: https://www.reuters.com/sports/soccer/world-cup-2026-list-26-man-squads-finals-2026-06-02/ | FIFA list contains player and club fields; Czechia verified player-by-player; remaining 47 teams pending |

## 2026 FIFA PDF spot-check (not a full audit)

The official FIFA final squad PDF is https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf. It contains 48 team pages and player, position and club fields. FIFA's announcement confirms 48 teams, 1,248 players and 449 represented clubs: https://www.fifa.com/en/articles/fifa-world-cup-2026-squads-confirmed. A manual spot-check of the repository snapshot against the official PDF found matching player names, positions and club identities in the reviewed rows for Germany and France, and the opening portion of the Australia and Brazil lists. Examples include Germany's Manuel Neuer / FC Bayern München and France's Brice Samba / Stade Rennais FC. This is only a spot-check: it does not verify all 1,248 player records, all club strings, or every team's completeness. Keep each remaining 2026 team unverified until a complete machine-assisted and discrepancy-reviewed comparison exists; Czechia, Australia, Germany, France and Brazil are the only teams currently marked verified.

## Current repository data status (2026-11-16)

- Historical 2002–2022 source import is a discovery dataset, not an audited final dataset. Its upstream CSV does not contain club-at-tournament fields. Those club fields are intentionally null.
- The 2022 import has 831 source records; this matches FIFA's published total, but matching a total does not prove every individual player row.
- The 2026 JSON snapshot has 1,248 rows and 48 teams. FIFA confirms that overall total, but this does not prove the third-party snapshot's individual names, clubs, positions, or team assignments.
- No tournament is approved as fully independently audited yet. Keep `verified: false` until a player-level comparison is completed and recorded.
- Do not fill historical clubs from present-day player profiles. Use the club shown on the tournament's official squad-list snapshot.

## Audit output expected before launch

The machine-readable ledger is `data/roster-audit.json`. A team may use `status: verified` only when every player has a corresponding row and all checks below pass. The sync script rechecks the ledger before writing `arcade_teams.verified=true`; it does not trust a bare boolean in the roster JSON.

Produce a machine-readable audit file with one record per player:
`{ tournament, teamId, playerName, sourceName, number, position, clubAtTournament, primarySource, secondarySource, status, notes }`

Allowed statuses: `matched`, `corrected`, `unresolved`, `missing`, `extra`. A verified team needs exactly one audit row per roster player, a matching shirt number and normalized player name, identical position and club fields, and both primary and secondary HTTPS source URLs.

The audit process must fail closed: unresolved or missing records keep the team unverified and excluded from Daily/online ranked modes. Keep the full source attribution and any applicable license notices.


## Additional structural checks performed 2026-11-16

A fresh structural scan of the current repository JSON found:

| Tournament | Teams | Player rows | Club fields missing | Verified teams |
|---|---:|---:|---:|---:|
| 2002 | 32 | 736 | 736 | 0 |
| 2006 | 32 | 736 | 736 | 0 |
| 2010 | 32 | 736 | 736 | 0 |
| 2014 | 32 | 736 | 736 | 0 |
| 2018 | 32 | 736 | 736 | 0 |
| 2022 | 32 | 831 | 831 | 0 |

The scan also flagged a repeated romanized display name in Korea DPR 2010: “Nam-Chol Pak” appears at shirt numbers 4 and 14. This is **not** automatically a duplicate player: FIFA's 2010 list identifies two distinct people with the same display name and different dates of birth (2 July 1985 and 3 October 1988), positions (midfielder/defender), and clubs (April 25/Amrokgang). Keep both records; do not deduplicate on display name alone. Source: https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf (Korea DPR section).

This scan is a structural check only. It does not constitute a player-by-player comparison of the entire historical dataset. The historical dataset currently has no tournament-time club values at all. The 2026 dataset has club values, but most teams still require an individual comparison with FIFA's final PDF.

## Resolved cross-source discrepancy: Germany 2026

The FIFA final PDF (page 20) lists Assan Ouédraogo as player 25 and does not list Lennart Karl. NBC Sports' 11 June article still lists Karl, so it is stale for the final squad. The DFB's official 5 June announcement confirms that Karl was injured and Ouédraogo replaced him. Germany is now verified against FIFA's final PDF and the DFB replacement notice. This discrepancy was resolved before promotion.

## Independently verified teams

**Czechia / Czech Republic (2026): 26 of 26 players verified.** Each player was checked by shirt number, player identity, position and tournament-time club against FIFA's final squad PDF (page 15) and NBC Sports' confirmed squad list. FIFA labels the team “Czechia (CZE)”; the source snapshot uses “Czech Republic”, with the same FIFA code. **Brazil (2026): 26 of 26 players verified.** All names, shirt numbers, FIFA positions and tournament-time clubs match FIFA's final PDF (page 7). The CBF's 7 June notice confirms Éderson Silva replaced injured Wesley. This resolves earlier preliminary lists that still showed Wesley. The two different players Éderson Silva (#2, MF) and Ederson Moraes (#23, GK) are both present and correctly distinguished.

The player-level records are stored in `data/roster-audit.json`. This verifies one team, not the entire 2026 tournament.

## Daily exclusion enforcement

The 50 tournament-specific exclusions are stored in `data/daily-exclusions.json`. Migration `supabase/migrations/202611160001_daily_squad_exclusions.sql` copies the exact IDs into `public.daily_excluded_squads`, replaces `publish_daily_challenges` with a server-side `NOT EXISTS` exclusion, and installs a database trigger that rejects any insert/update attempting to schedule an excluded squad. The migration deliberately has no foreign key because migrations are deployed before the roster sync. RLS is enabled and direct `anon`/`authenticated` access is revoked. `scripts/validate-data.mjs` now checks that every one of the 50 JSON IDs is present in the SQL migration and matches a real historical team name/year. This is a code-level check; the migration still needs to be applied to the actual Supabase project before the live backend is protected.
