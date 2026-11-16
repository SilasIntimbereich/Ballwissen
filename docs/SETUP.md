# FOOTBALL ARCADE V4: setup on iPhone

## What is in the repository
- Responsive English-language game UI.
- A 2026 squad snapshot with 48 teams and 1,248 player records.
- A historical-data importer for men's World Cups 2002, 2006, 2010, 2014, 2018 and 2022.
- Supabase migrations and Edge Functions for daily challenges, guess validation, result aggregation, team statistics and the weekly leaderboard.

The 2026 CSV snapshot is from the public repository documented in DATA_SOURCES.md. FIFA independently confirms the 48-team, 1,248-player final squad total. Twenty 2026 teams have passed full checks; the remaining 28 teams are still unverified. All three Daily difficulty tiers currently have at least three verified squads. The weekly FIFA PDF audit workflow generates a row-by-row discrepancy report, but only teams with a complete independent secondary-source review are approved. The player-level audit ledger is `data/roster-audit.json`; only complete, independently sourced team audits can unlock ranked play.

## 1. Import historical squads
This repository includes a GitHub Actions workflow so no computer or terminal is needed.

1. Open the repository in Safari.
2. Tap **Actions**.
3. Select **Import historical World Cup squads (structural checks)**.
4. Tap **Run workflow**, then the green confirmation button.
5. Wait for the workflow to finish. It validates that every selected men's tournament has 32 teams and plausible roster sizes. If validation fails, it stops rather than committing partial data.
6. Return to the Code tab and confirm that `data/historical-squads.json` now contains the imported tournaments.

The source is the Fjelstul World Cup Database via DataHub, licensed CC BY-SA 4.0. Attribution is required. The imported historical dataset is share-alike.

## 2. Deploy the frontend
1. Create a Netlify account.
2. Choose **Add new site → Import an existing project**.
3. Connect GitHub and select `SilasIntimbereich/Ballwissen`.
4. Build command: `npm run build:public`. Publish directory: `dist`. The build excludes full answer rosters for every verified team.
5. Deploy. Netlify will redeploy when the GitHub repository changes.

## 3. Create Supabase backend
1. Create a Supabase project.
2. Apply every repository migration in order using the **Deploy Supabase backend** GitHub Actions workflow. In particular, `202611160001_daily_squad_exclusions.sql` enforces the 50 excluded squad IDs in PostgreSQL; `202611160004_secure_public_rosters.sql` keeps verified answer names server-side during Normal games; and `202611160005_independent_daily_tiers.sql` lets ready Daily modes publish while an unready tier remains locked. Do not deploy only the first migration.
3. Enable Anonymous Sign-Ins under Authentication → Providers.
4. In GitHub → Settings → Secrets and variables → Actions, add these repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Never paste the service-role key into a normal repository file.
5. Open GitHub → Actions → **Deploy Supabase backend** → **Run workflow**. This applies migrations, sets server-side secrets and deploys the Edge Functions.
6. Open GitHub → Actions → **Sync roster data to Supabase (audit-gated)** → **Run workflow**. This uploads team metadata and private answer rosters using the service-role key from GitHub Secrets. Only teams with a complete player-by-player audit in `data/roster-audit.json` are marked verified. Twenty 2026 teams currently pass this gate. Common, Niche and Legendary each have at least three verified, non-excluded squads, so all three Daily modes can be published after the backend is deployed and synced.
7. Review the curated team difficulty mapping in `data/team-difficulty.json`. It is separate from player rarity and can be adjusted before daily challenges are published.
8. Run `select public.publish_daily_challenges(current_date);` in Supabase SQL Editor. It publishes any tier with at least three verified, non-excluded squads and skips tiers that are not ready. Each Daily mode becomes available once its own tier has at least three verified, non-excluded squads. To schedule it daily at 00:05 UTC, enable the `pg_cron` extension and run `select cron.schedule('football-arcade-daily','5 0 * * *','select public.publish_daily_challenges(current_date);');`.

The daily and normal-mode frontends are wired to the Edge Functions, but this is not yet a production-tested service. The functions are intended to keep answer rosters server-side; verify RLS and timer behavior in a real Supabase project before launch.

## 4. Configure the online frontend
Edit `assets/js/config.js` and enter your Supabase project URL and anon key. The anon key is public by design; the service-role key is not. The weekly leaderboard, Daily modes, normal online sessions, result distributions and percentile display are wired to the deployed endpoints. They remain unavailable until the project is configured, data is synced and the backend is tested.

## Security and release checks
- Never expose the Supabase service-role key in GitHub files, Netlify environment variables used by browser code, or client JavaScript.
- Do not publish a Daily challenge until three eligible, verified, non-excluded teams exist for each difficulty tier. The publisher now excludes all 50 configured squad IDs server-side; the JSON list alone is not the security boundary.
- Do not present statistics or leaderboard rows as real until results are being submitted and verified.
- Test one-attempt-per-day, time boundaries, duplicate guesses, wrong guesses, mobile Safari and network failures before public launch.
- The game UI is wired to the API, but online modes are not production-ready until the backend is deployed, the rosters are audited and synced, Daily tiers are populated, and end-to-end tests pass.


## Deploy to Netlify from an iPhone using GitHub Actions

The repository includes `.github/workflows/deploy-netlify.yml`. To use it without editing source files:

1. Create a Netlify site and connect it to this GitHub repository, or create an empty site in Netlify.
2. In Netlify, open **Site configuration → General → Site details** and copy the Site ID.
3. Create a Netlify personal access token in **User settings → Applications**.
4. In GitHub, open **Repository → Settings → Secrets and variables → Actions**.
5. Add repository secrets named `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
6. Open **Actions → Deploy FOOTBALL ARCADE to Netlify → Run workflow**.

The workflow runs `npm test` first and only deploys if syntax, dataset and player-matching tests pass. The deploy action builds and publishes only `dist`, as configured in `netlify.toml`. Verified player names are not included in that public directory.

For online modes, Supabase still needs its own project and the separate Supabase secrets/workflow described above. Never add a Supabase service-role key to frontend files.
