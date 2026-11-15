# FOOTBALL ARCADE V4

Mobile-first retro World Cup squad quiz, built for iPhone and desktop.

## Current implementation
- Normal Easy and Hard modes with a 120-second timer, fuzzy name matching, duplicate protection, Give Up and reveal states.
- 2026 squad data loaded: 48 national teams and 1,248 registered-player records.
- Historical 2002–2022 squad importer with per-tournament roster checks, duplicate/name validation and a GitHub Actions workflow.
- Supabase migration and Edge Function foundations for Daily challenges, private server-side answer checking, real team statistics and weekly leaderboard.
- iPhone-oriented setup guide and source attribution.

## Important status
This is an active implementation, not yet a finished public launch. Historical club-at-tournament hints are not present in the upstream squads CSV and remain unavailable until a separate reliable, licensed source is integrated. Historical roster records are imported but deliberately marked unverified for online ranking until independently audited; the 2022 source contains 831 rather than 832 player rows. The 2026 data snapshot still needs a player-by-player audit against FIFA's official final squad lists. Daily and normal online gameplay, live score distributions, percentile results and the weekly top-ten/current-player leaderboard are wired to Supabase Edge Functions. They require backend deployment, data sync and testing before launch. Do not show fabricated results.

## Run the historical data import from iPhone
Open GitHub → Actions → **Import verified historical World Cup squads** → **Run workflow**. The workflow downloads the Fjelstul/DataHub dataset, checks all 32 teams per historical tournament, validates player names and roster sizes (including the 2022 Iran source roster), confirms the 2026 dataset, then commits the generated JSON only if all checks pass. Historical club fields remain null because the upstream squads CSV does not contain them.

## Documentation
- [iPhone setup and deployment](docs/SETUP.md)
- [Data sources and licensing](docs/DATA_SOURCES.md)
- [Implementation checklist](docs/ROADMAP.md)
- [Data attribution](data/ATTRIBUTION.txt)

## Data licensing
Historical squad data is adapted from the Fjelstul World Cup Database via DataHub under CC BY-SA 4.0. The 2026 squad snapshot is sourced from the repository documented in DATA_SOURCES.md and is cross-referenced to FIFA's official 1,248-player/48-team final squad announcement. Verify the full FIFA lists before production launch.

## Deploy
Frontend: Netlify. Backend: Supabase. Never expose the Supabase service-role key in browser code.
