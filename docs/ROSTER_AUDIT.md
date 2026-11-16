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
| 2002 | RSSSF World Cup 2002 match details and squads: https://rsssf.org/tables/2002full.html | RSSSF national-team squad archives, e.g. Argentina: https://rsssf.org/miscellaneous/arg-squad-wc.html | RSSSF has club data for some national archives, not yet a complete 32-team verified club table |
| 2006 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf | RSSSF tournament archive | Official club column available; full row-by-row comparison still pending |
| 2010 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf | RSSSF tournament archive | Official club column available; full row-by-row comparison still pending |
| 2014 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2014/pdf/fwc_2014_squadlists.pdf | RSSSF tournament archive | Official club column available; full row-by-row comparison still pending |
| 2018 | FIFA Data squad-list PDF: https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf | BBC confirmed squads: https://www.bbc.co.uk/sport/football/44083365 | Official club column available; full row-by-row comparison still pending |
| 2022 | FIFA official squad announcement: https://www.fifa.com/en/articles/world-cup-qatar-2022-official-squad-announcement-32-teams | FIFA squad-list PDF mirror found at https://www.slideshare.net/slideshow/squadlistsenglish-fifa-world-cup-2022pdf/254264988 and RSSSF tournament archive | 831 players officially confirmed; use FIFA's official final list as primary source. A mirror is not treated as the authoritative source |
| 2026 | FIFA official squad-list PDF: https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf | Reuters final squad list: https://www.reuters.com/sports/soccer/world-cup-2026-list-26-man-squads-finals-2026-06-02/ | FIFA list contains player and club fields; independent full-row comparison still pending |

## Current repository data status (2026-11-16)

- Historical 2002–2022 source import is a discovery dataset, not an audited final dataset. Its upstream CSV does not contain club-at-tournament fields. Those club fields are intentionally null.
- The 2022 import has 831 source records; this matches FIFA's published total, but matching a total does not prove every individual player row.
- The 2026 JSON snapshot has 1,248 rows and 48 teams. FIFA confirms that overall total, but this does not prove the third-party snapshot's individual names, clubs, positions, or team assignments.
- No tournament is approved as fully independently audited yet. Keep `verified: false` until a player-level comparison is completed and recorded.
- Do not fill historical clubs from present-day player profiles. Use the club shown on the tournament's official squad-list snapshot.

## Audit output expected before launch

Produce a machine-readable audit file with one record per player:
`{ tournament, teamId, playerName, sourceName, position, clubAtTournament, primarySource, secondarySource, status, notes }`

Allowed statuses: `matched`, `corrected`, `unresolved`, `missing`, `extra`.

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

This scan is a structural check only. It does not constitute a player-by-player comparison, so no team has been promoted to verified. The historical dataset currently has no tournament-time club values at all. The 2026 dataset has club values, but still requires an individual comparison with FIFA's final PDF.\n\n## Daily exclusion enforcement\n\nThe 50 tournament-specific exclusions are stored in `data/daily-exclusions.json`. Migration `supabase/migrations/202611160001_daily_squad_exclusions.sql` copies the exact IDs into `public.daily_excluded_squads` and replaces `publish_daily_challenges` with a server-side `NOT EXISTS` exclusion. The migration deliberately has no foreign key because migrations are deployed before the roster sync. RLS is enabled and direct `anon`/`authenticated` access is revoked. `scripts/validate-data.mjs` now checks that every one of the 50 JSON IDs is present in the SQL migration and matches a real historical team name/year. This is a code-level check; the migration still needs to be applied to the actual Supabase project before the live backend is protected.
