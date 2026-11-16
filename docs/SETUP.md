# FOOTBALL ARCADE V4: setup on iPhone

## What is in the repository
- Responsive English-language game UI.
- A 2026 squad snapshot with 48 teams and 1,248 player records.
- A historical-data importer for men's World Cups 2002, 2006, 2010, 2014, 2018 and 2022.
- Supabase migrations and Edge Functions for daily challenges, guess validation, result aggregation, team statistics and the weekly leaderboard.

The 2026 CSV snapshot is from the public repository documented in DATA_SOURCES.md. FIFA independently confirms the 48-team, 1,248-player final squad total. Seven 2026 teams have passed full checks; the remaining 41 teams still require a name-by-name audit against FIFA's PDF. The player-level audit ledger is `data/roster-audit.json`; only complete, independently sourced team audits can unlock ranked play.

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
4. Build command: leave blank. Publish directory: `.`.
5. Deploy. Netlify will redeploy when the GitHub repository changes.

## 3. Create Supabase backend
1. Create a Supabase project.
2. Apply all repository migrations in order using the **Deploy Supabase backend** GitHub Actions workflow. The newer `202611160001_daily_squad_exclusions.sql` migration is required: it installs the exact 50 excluded squad IDs in PostgreSQL, filters them in the Daily publisher, and adds a database trigger that rejects excluded teams even if another insert path is used. Do not deploy only the first migration.
3. Enable Anonymous Sign-Ins under Authentication → Providers.
4. In GitHub → Settings → Secrets and variables → Actions, add these repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Never paste the service-role key into a normal repository file.
5. Open GitHub → Actions → **Deploy Supabase backend** → **Run workflow**. This applies migrations, sets server-side secrets and deploys the Edge Functions.
6. Open GitHub → Actions → **Sync roster data to Supabase (audit-gated)** → **Run workflow**. This uploads team metadata and private answer rosters using the service-role key from GitHub Secrets. Only teams with a complete player-by-player audit in `data/roster-audit.json` are marked verified. Seven 2026 teams currently pass this gate; Daily publishing still waits for at least three verified teams in each difficulty tier.
7. Review the curated team difficulty mapping in `data/team-difficulty.json`. It is separate from player rarity and can be adjusted before daily challenges are published.
8. Run `select public.publish_daily_challenges(current_date);` in Supabase SQL Editor after at least three verified teams exist in each tier. To schedule it daily at 00:05 UTC, enable the `pg_cron` extension and run `select cron.schedule('football-arcade-daily','5 0 * * *','select public.publish_daily_challenges(current_date);');`.

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

The workflow runs `npm test` first and only deploys if syntax, dataset and player-matching tests pass. The deploy action publishes the repository root, as configured in `netlify.toml`.

For online modes, Supabase still needs its own project and the separate Supabase secrets/workflow described above. Never add a Supabase service-role key to frontend files.
