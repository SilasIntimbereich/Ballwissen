# V4 implementation checklist

## Implemented in repository
- [x] Responsive stadium-inspired mobile frontend and English UI
- [x] Five mode entry points (three Daily modes, Normal Easy and Normal Hard)
- [x] Normal local practice: 120-second timer, fuzzy matching, duplicate protection, give-up and reveal states
- [x] Historical import for men's World Cups 2002–2022; latest GitHub Actions run #7 completed successfully
- [x] Imported historical data: 192 teams and 4,511 source-listed player rows
- [x] 2026 snapshot: 48 teams and 1,248 player rows
- [x] Separate team-difficulty map, now covering all imported historical and 2026 teams
- [x] Supabase migration and Edge Function source files for private answers, Daily attempts, normal sessions and leaderboard/statistics
- [x] Frontend request wiring for Supabase-backed features
- [x] iPhone setup and deployment documentation

## Still required before public release
- [ ] Audit historical player names and completeness against authoritative tournament squad lists (2022 source currently has 831 rows, not 832)
- [ ] Source and audit historical club-at-tournament data; current historical source does not include clubs
- [ ] Audit all 1,248 2026 players against FIFA's final squad PDF
- [ ] Curate player rarity tiers with evidence; player rarity values are currently unassigned
- [ ] Independently review team-difficulty tiers after playtesting
- [ ] Deploy Supabase migration and Edge Functions to a real project
- [ ] Sync team metadata and private answer rosters to Supabase
- [ ] Add at least three independently verified teams to each Daily tier before publishing Daily schedules
- [ ] Fix/verify Daily attempt resume behavior after reload and server/browser timer boundaries
- [ ] Run end-to-end tests for RLS, attempt uniqueness, concurrency, timer boundaries, scoring and mobile Safari
- [ ] Configure public Supabase URL and anon key in the frontend
- [ ] Deploy to Netlify and verify the production site on iPhone

## Safety and release rules
- Historical and 2026 datasets remain available for local practice but are marked unverified for online ranking until their audits are complete.
- Historical club hints are shown only when a reliable source supplies them; missing clubs must never display as the string "null".
- Never expose Supabase service-role credentials in frontend code.
- Never show fake global statistics, leaderboard entries, or Daily availability without a published schedule.
