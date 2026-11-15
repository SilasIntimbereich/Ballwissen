# FOOTBALL ARCADE V4: setup on iPhone

## What is in the repository
- Responsive English-language game UI.
- A 2026 squad snapshot with 48 teams and 1,248 player records.
- A historical-data importer for men's World Cups 2002, 2006, 2010, 2014, 2018 and 2022.
- Supabase migrations and Edge Functions for daily challenges, guess validation, result aggregation, team statistics and the weekly leaderboard.

The 2026 CSV snapshot is from the public repository documented in DATA_SOURCES.md. FIFA independently confirms the 48-team, 1,248-player final squad total. A final name-by-name audit against FIFA's PDF remains a release check.

## 1. Import historical squads
This repository includes a GitHub Actions workflow so no computer or terminal is needed.

1. Open the repository in Safari.
2. Tap **Actions**.
3. Select **Import verified historical World Cup squads**.
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
2. In the Supabase SQL Editor, run the existing initial schema at `database/schema.sql`.
3. Then run `supabase/migrations/202611150001_v4_online_features.sql`.
4. Enable Anonymous Sign-Ins under Authentication → Providers.
5. Deploy the Edge Functions in `supabase/functions/` using the Supabase CLI or the Supabase Dashboard.
6. Set server-side secrets for each function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never be placed in frontend files.
7. Sync the roster data using `scripts/sync-supabase-data.mjs` from a trusted Node environment with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
8. Curate team difficulty values for at least three verified teams in each tier (common, niche, legendary).
9. Run `select public.publish_daily_challenges(current_date);` using a privileged SQL session after the team tiers have been curated.

The daily functions intentionally return no answer rosters to the browser. The private answer table has no public RLS policy.

## 4. Configure the online frontend
The online endpoints are present but are not yet wired into the game UI. Add the public Supabase project URL and anon key to a dedicated frontend config module before enabling online UI. The anon key is public by design; the service-role key is not.

## Security and release checks
- Never expose the Supabase service-role key in GitHub files, Netlify environment variables used by browser code, or client JavaScript.
- Do not publish a Daily challenge until three teams exist for each difficulty tier.
- Do not present statistics or leaderboard rows as real until results are being submitted and verified.
- Test one-attempt-per-day, time boundaries, duplicate guesses, wrong guesses, mobile Safari and network failures before public launch.
- The current daily API is a backend foundation; the game UI still needs wiring and end-to-end tests before online modes are production-ready.
