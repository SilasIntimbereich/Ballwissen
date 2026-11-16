# FOOTBALL ARCADE V4: setup and deployment

## Current release: local-first and unranked

The current V4 browser app is deliberately offline-first. It does not load Supabase configuration or call online game endpoints. All 240 World Cup squads and their 5,759 player records are bundled for local play. Because the answer rosters are included in the public static build, every mode is unranked and the answer data is inspectable.

Coverage:
- 192 historical teams from 2002–2022, with 4,511 player records. The upstream source does not include tournament-time club values, so historical club hints are unavailable.
- 48 teams and 1,248 player records for 2026. Twenty teams have complete player-level review against FIFA documents; the remaining 28 are marked as practice data.
- Daily Common, Daily Niche and Daily Legendary use local squads, stable device-date selection and the 50-team exclusion list.
- Normal Easy, Normal Hard, Practice and World Cup Challenge work without an account. Practice has no timer.
- Local statistics and settings are stored only on the current device.

## 1. Validate and build

Requirements: Node.js 20 or newer.

~~~sh
npm test
npm run build
~~~

The test command validates source data, all 5,759 player names, the public build and the 240 local rosters. GitHub Actions also installs Chromium and runs the mobile browser smoke suite, including Give Up, timeout, all Daily tiers, settings, local stats and an offline reload.

For the browser suite locally:

~~~sh
npm install --no-save playwright
npx playwright install --with-deps chromium
npm run test:browser
~~~

## 2. Publish the static app when ready

The static site is written to dist/. Netlify is configured with:
- Build command: npm run build
- Publish directory: dist

No Supabase project, API key or backend deployment is needed for this local release. On iPhone, open the deployed site in Safari once, wait for the app and data to load, then use Share → Add to Home Screen if you want an app-like icon. The service worker caches the app and squad data for later offline play.

Do not enable ranked play with this build: all player names are present in the downloaded data by design.

## 3. Online features are deferred

The repository retains Supabase migrations and Edge Function source for a later online phase. They are not active in the current browser build. The previous frontend request wiring has been removed from the local release so an accidental Supabase configuration cannot switch Daily or Normal gameplay into online mode.

Before adding online features again:
1. Reintegrate the frontend API calls deliberately.
2. Deploy and test every migration and Edge Function in a real Supabase project.
3. Keep verified answer names server-side and return only safe hints before completion.
4. Sync only fully audited squads.
5. Test RLS, concurrency, timer boundaries, Daily attempt resume, result submission and mobile Safari.
6. Add a separate online end-to-end test suite before enabling ranked scores or leaderboards.

Never expose the Supabase service-role key in browser code, Netlify public environment variables or committed files.

## Data sources and licensing

- Historical squads: Fjelstul World Cup Database via DataHub, CC BY-SA 4.0. Adapted historical data must retain attribution and the same license.
- 2026 squad snapshot: Erick Alfaro's structured dataset, sourced from OpenFootball's public-domain squad data. Twenty teams have been independently reviewed against FIFA documents; 28 remain unverified.
- The app footer and data/ATTRIBUTION.txt contain source attribution and field limitations.
