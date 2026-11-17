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

## Player rarity

Rarity represents recall difficulty, not player quality. The assignment is deterministic and shared by the browser and server-side resolver:

- **Common:** globally familiar names, repeated World Cup appearances, or the familiar core of a common-difficulty squad.
- **Rare:** less familiar reserve picks in common squads or players appearing in multiple tournaments.
- **Niche:** less familiar players in niche and legendary-difficulty squads.
- **Legendary:** the two hardest eligible recall picks in each legendary-difficulty squad.
- **Ball Knowledge:** the single hardest eligible recall pick in each legendary-difficulty squad.

The resolver uses curated recognition names, cross-tournament appearances, squad difficulty, goalkeeper depth and shirt number as a tie-breaker. It does not treat a high shirt number alone as proof that a player is obscure.

## Squad data

| Data | Coverage | Status |
|---|---:|---|
| Historical World Cups, 2002–2022 | 192 teams / 4,511 player records | Imported from the Fjelstul World Cup Database; position and shirt number are present. The upstream source does not provide tournament-time club values. |
| World Cup 2026 | 48 teams / 1,248 player records | 26 players per team. 20 teams have been independently reviewed against FIFA squad documents; the remaining 28 are labelled practice data. Club hints are included where supplied. |
| Daily exclusions | 50 squad editions | Checked against the squad IDs and excluded from all three Daily tiers. |

The 2022 Iran squad contains 25 players in the source data; this is not padded with an invented player. Historical squads and 2026 squads are not presented as independently verified where the audit has not been completed.

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
npx playwright install --with-deps chromium
npm run test:browser
~~~

The browser suite checks the mobile layout, all tournament/team selectors, Easy, Hard, Practice, all Daily tiers, Give Up, timeout, results, local statistics, settings and a cold offline reload. GitHub Actions runs these checks on changes to main and the V4 branch.

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

