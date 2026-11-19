# FOOTBALL ARCADE V4

A mobile-first World Cup squad memory game with a colourful, angular retro-football look. V4 is being prepared as a **local-first static release**. Online accounts, ranked scores, leaderboards and backend gameplay are intentionally disabled for this release.

## What is playable

- **Daily Common, Daily Niche and Daily Legendary:** three teams from the selected difficulty tier, with a stable daily selection on the device. The curated list of 50 excluded squad editions is never used.
- **Normal Easy and Hard:** choose any World Cup edition and national team. Easy shows position hints and club details where the source contains them; Hard hides the hints.
- **Practice:** the same complete squads with no timer.
- **World Cup Challenge:** choose a tournament and team.
- **Gameplay:** surname and compound-surname matching, accent-insensitive names, minor typo tolerance, duplicate and incorrect-guess feedback, shirt numbers, player rarity labels, a 120-second timer, Give Up, complete roster reveal, perfect-run results and final Daily results.
- **Local statistics and settings:** games played, players found, best accuracy, reset, compact layout and reduced motion. They are stored on the current device only.
- **Offline support:** the service worker caches the app and squad data after the first successful load.

All games are local and unranked. Because answers are bundled for offline play, player names are visible in the downloaded static data. Do not use this release for competitive or ranked play.

## Squad data

| Data | Coverage | Status |
|---|---:|---|
| Historical World Cups, 2002–2022 | 192 teams / 4,511 player records | Imported from the Fjelstul World Cup Database; position and shirt number are present. The upstream source does not provide tournament-time club values. |
| World Cup 2026 | 48 teams / 1,248 player records | 26 players per team. 20 teams have been independently reviewed against FIFA squad documents; the remaining 28 are labelled practice data. Club hints are included where supplied. |
| Daily exclusions | 50 squad editions | Checked against the squad IDs and excluded from all three Daily tiers. |

The 2022 Iran squad contains 25 players in the source data; this is not padded with an invented player. Historical squads and 2026 squads are not presented as independently verified where the audit has not been completed.

## Historical audit snapshot

The latest reproducible audit covers 160 teams across 2006, 2010, 2014, 2018 and 2022. It parsed 128 FIFA PDF pages for 2010, 2014, 2018 and 2022; the 32 teams from 2006 are carried forward from a previously complete verified ledger because the FIFA PDF host currently returns HTTP 522. A roster-clean result means every shirt-numbered player identity matches the source dataset; a fully audited result additionally passes the independent-source and club-evidence rules.

| Tournament | Teams roster-clean / ledger-verified | Fully audited teams | Remaining roster mismatches |
|---|---:|---:|---:|
| 2006 | 32 / 32 (ledger) | 32 | 0 |
| 2010 | 15 / 32 | 9 | 31 |
| 2014 | 11 / 32 | 1 | 61 |
| 2018 | 10 / 32 | 6 | 108 |
| 2022 | 32 / 32 | 21 | 0 |
| **Total** | **100 / 160** | **69 / 160** | **200** |

The 2014 and 2018 PDF layouts require different parsers; split club/country cells in the 2018 PDF are joined before comparison. Remaining mismatches are reported, not silently aliased or overwritten. FIFA positions remain authoritative when present.

The separate 2002 audit parsed all 32 squads against RSSSF: 19 teams matched fully by player identity, and two teams also achieved complete agreement across the independent club sources. The 2022 independent club audit resolves all 32 teams from GOAL's updated squad tables; Poland and Switzerland pass complete player-and-club comparison. Canada's table has no club column, so it is not counted as fully cross-checked. Only complete, independently supported teams are applied to the verification ledger.

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

