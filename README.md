# FOOTBALL ARCADE V4

A mobile-first World Cup squad memory game with a colourful, angular retro-football look. V4 is being prepared as a **local-first static release**. Online accounts, ranked scores, leaderboards and backend gameplay are intentionally disabled for this release.

## What is playable

- **Daily Common, Daily Niche and Daily Legendary:** three teams from the selected difficulty tier, with a stable daily selection on the device. The curated list of 50 excluded squad editions is never used.
- **Normal Easy and Hard:** choose any World Cup edition and national team. Easy shows position hints and club details where the source contains them; Hard hides the hints.
- **Practice:** the same complete squads with no timer.
- **World Cup Challenge:** choose a tournament and team.
- **Gameplay:** surname and compound-surname matching, accent-insensitive names, minor typo tolerance, duplicate and incorrect-guess feedback, shirt-number disambiguation for duplicate names, player rarity labels, a 120-second timer, Give Up, complete roster reveal, perfect-run results and final Daily results.
- **Local statistics and settings:** games played, players found, best accuracy, reset, compact layout and reduced motion. They are stored on the current device only.
- **Offline support:** the service worker caches the app and squad data after the first successful load.

All games are local and unranked. Because answers are bundled for offline play, player names are visible in the downloaded static data. Do not use this release for competitive or ranked play.

## Player rarity

Rarity represents recall difficulty, not player quality. The assignment is deterministic and shared by the browser and server-side resolver:

- **Common:** globally familiar names, repeated World Cup appearances, or the familiar core of a common-difficulty squad.
- **Rare:** less familiar reserve picks in common squads or players appearing in multiple tournaments.
- **Niche:** less familiar players in niche and legendary-difficulty squads.
- **Legendary:** the next two hardest eligible recall picks in each legendary-difficulty squad, after the Ball Knowledge pick.
- **Ball Knowledge:** the single hardest eligible recall pick in each legendary-difficulty squad.

Every squad with at least three eligible non-famous players receives one Ball Knowledge player and two Legendary players, selected as that squad's hardest-to-recall picks. The remaining players are assigned globally to the target distribution: 2,533 Common, 1,353 Rare, 1,153 Niche, 480 Legendary and 240 Ball Knowledge (5,759 players across 240 squads). The resolver uses curated recognition names, cross-tournament appearances, squad difficulty, goalkeeper depth and shirt number as a tie-breaker. It does not treat a high shirt number alone as proof that a player is obscure.

## Squad data

| Data | Coverage | Status |
|---|---:|---|
| Historical World Cups, 2002–2022 | 192 teams / 4,511 player records | The latest reproducible 2006–2022 audit records 70 of 160 teams as fully audited. The separate 2002 audit matched 19 of 32 squads by player identity, with two also passing the complete independent club-source check. Only squads with complete player-level identity, position, tournament-club and independent-source evidence are treated as fully verified; all others remain practice-only. |
| World Cup 2026 | 48 teams / 1,248 player records | All 48 teams have been reviewed against FIFA final squad lists and independent OpenFootball data; 26 players per team. |
| Daily exclusions | 50 squad editions | Checked against the squad IDs and excluded from all three Daily tiers. |

The 2022 Iran squad contains 25 players in the source data; this is not padded with an invented player. Historical squads and 2026 squads are not presented as independently verified where the audit has not been completed.

## Historical audit snapshot

The latest reproducible audit covers 160 teams across 2006, 2010, 2014, 2018 and 2022. It parsed 128 FIFA PDF pages for 2010, 2014, 2018 and 2022; the 32 teams from 2006 are carried forward from a previously complete verified ledger because the FIFA PDF host currently returns HTTP 522. A roster-clean result means every shirt-numbered player identity matches the source dataset; a fully audited result additionally passes the independent-source and club-evidence rules.

| Tournament | Teams roster-clean / ledger-verified | Fully audited teams | Remaining roster mismatches |
|---|---:|---:|---:|
| 2006 | 32 / 32 (ledger) | 32 | 0 |
| 2010 | 15 / 32 | 10 | 31 |
| 2014 | 11 / 32 | 1 | 61 |
| 2018 | 10 / 32 | 6 | 108 |
| 2022 | 32 / 32 | 21 | 0 |
| **Total** | **100 / 160** | **70 / 160** | **200** |

The 2014 and 2018 PDF layouts require different parsers; split club/country cells in the 2018 PDF are joined before comparison. Remaining mismatches are reported, not silently aliased or overwritten. FIFA positions remain authoritative when present.

The separate 2002 audit parsed all 32 squads against RSSSF: 19 teams matched fully by player identity, and two teams also achieved complete agreement across the independent club sources. A supplementary May 24, 2002 FIFA roster reproduction parsed 32 teams, but only four matched fully; because it predates late replacements, it is not treated as final-squad authority. The independent archive audit for 2010, 2014 and 2018 reviewed all 96 teams; seven passed complete player, club and position checks (four in 2010, none in 2014, three in 2018). The 2022 independent club audit resolves all 32 teams from GOAL's updated squad tables; Poland and Switzerland pass complete player-and-club comparison. Canada's table has no club column, so it is not counted as fully cross-checked. The supplementary cross-check and data-application pass approved 11 teams for new updates and changed 26 player rows; two later club-name spelling corrections were normalized. This count is distinct from the 70/160 fully audited total, which also includes previously verified ledger entries such as the 32 teams from 2006. Only complete, independently supported teams are applied to the verification ledger.

## Run and validate

Requirements: Node.js 20 or newer.

~~~sh
npm test
npm run build
~~~

The test command checks JavaScript syntax, source-data structure, all 5,759 player-name matches, public build contents, all 240 squad records, Daily exclusions and regression tests.

For a real browser smoke test:

~~~sh
npm install --no-save playwright
npx playwright install --with-deps chromium webkit
npm run test:browser
~~~

The browser suite runs on Chromium and WebKit. It checks the mobile layout, all tournament/team selectors, Easy, Hard, Practice, all Daily tiers, Give Up, timeout, results, local statistics, settings and a cold offline reload. GitHub Actions runs these checks on changes to main and the V4 branch.

## Build and publish

~~~sh
npm run build
~~~

The static site is written to dist/. Netlify is configured to publish that folder. No Supabase URL, anon key, service-role key or backend deployment is needed for local gameplay. The online backend code and migrations are retained for a later phase but are not loaded by the browser app.

Before enabling ranked play, the project needs independently audited squads, private server-side answer validation, deployed database migrations and Edge Functions, and a separate end-to-end online test suite.

## Sources and licensing

- Historical squads: [Fjelstul World Cup Database via DataHub](https://datahub.io/football/worldcup), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- 2026 squad snapshot: [Erick Alfaro's World Cup 2026 dataset](https://github.com/erickalfaro/world-cup-data-2026), based on [OpenFootball](https://github.com/openfootball/worldcup.json) squad data, which is public domain.
- The app footer also displays these sources and the current audit coverage.

