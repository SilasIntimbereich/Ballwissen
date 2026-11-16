# V4 implementation checklist

## Implemented in repository
- [x] Responsive stadium-inspired mobile frontend and English UI
- [x] Five mode entry points (three Daily modes, Normal Easy and Normal Hard)
- [x] Normal local practice: 120-second timer, fuzzy matching, duplicate protection, give-up and reveal states
- [x] Historical import workflow for men's World Cups 2002–2022 with structural validation
- [x] Imported historical data: 192 teams and 4,511 source-listed player rows
- [x] 2026 snapshot: 48 teams and 1,248 player rows
- [x] Separate team-difficulty map, now covering all imported historical and 2026 teams
- [x] Fixed 50-squad exclusion list for all Daily modes; excluded editions remain playable in Normal modes
- [x] Database-side Daily publisher excludes all 50 squad IDs
- [x] Database trigger rejects any insert/update that attempts to schedule an excluded squad
- [x] Daily attempts can resume after reload with found players and remaining server time restored
- [x] Expired Daily teams are finalized from server time after the user returns
- [x] Historical importer strips source placeholder tokens from player names; current imported file cleaned
- [x] Data validation checks exactly 50 unique exclusion IDs, team names and years against imported historical squads and the SQL migration
- [x] Player-level audit ledger added; browser eligibility and Supabase sync are fail-closed until every player, position and tournament-time club has primary/secondary sources
- [x] Safe DOM rendering for roster hints; untrusted club text is not injected as HTML
- [x] Atomic database operations serialize Daily guesses/completions and normal guesses/results to prevent race conditions and duplicate result submissions
- [x] Score distribution buckets are ordered numerically; peer percentile excludes the current attempt from its denominator
- [x] Supabase migration and Edge Function source files for private answers, Daily attempts, normal sessions and leaderboard/statistics
- [x] Frontend request wiring for Supabase-backed features
- [x] iPhone setup and deployment documentation

## Still required before public release
- [ ] Audit historical player names and completeness against authoritative tournament squad lists (2022 source currently has 831 rows, not 832)
- [ ] Confirm GitHub Actions syntax/data/Edge Function checks pass after the latest commits; the connected GitHub tools do not expose the push-run status in this session
- [ ] Source and audit historical club-at-tournament data; current historical source does not include clubs. FIFA PDFs have been located for 2006–2022, but no row-by-row import has been completed
- [ ] Audit all 1,248 2026 players against FIFA's final squad PDF
- [ ] Curate player rarity tiers with evidence; player rarity values are currently unassigned
- [ ] Playtest and review the provisional 50-squad Daily exclusion list before release
- [ ] Expand and playtest the Daily Legendary pool: only 6 non-excluded team-year candidates currently remain, so three-team daily sets would repeat quickly
- [ ] Independently review team-difficulty tiers after playtesting
- [ ] Deploy Supabase migration and Edge Functions to a real project
- [ ] Sync team metadata and private answer rosters to Supabase
- [ ] Add at least three independently verified teams to each Daily tier before publishing Daily schedules
- [ ] End-to-end test Daily attempt resume and server/browser timer boundaries against a deployed Supabase project
- [ ] Run end-to-end tests for RLS, attempt uniqueness, concurrency, timer boundaries, scoring and mobile Safari
- [ ] Configure public Supabase URL and anon key in the frontend
- [ ] Deploy to Netlify and verify the production site on iPhone

## Safety and release rules
- Historical and 2026 datasets remain available for local practice but are marked unverified for online ranking until their audits are complete.
- Historical club hints are shown only when a reliable source supplies them; missing clubs must never display as the string "null".
- Never expose Supabase service-role credentials in frontend code.
- Never show fake global statistics, leaderboard entries, or Daily availability without a published schedule.
