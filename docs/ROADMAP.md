# V4 implementation checklist

## Local-first release

- [x] Responsive retro-football interface with flat colours and mobile layout
- [x] Daily Common, Daily Niche and Daily Legendary local challenges
- [x] Normal Easy and Hard modes with tournament/team selection
- [x] Practice mode without a timer
- [x] World Cup Challenge selection
- [x] Shared gameplay engine for correct, wrong, duplicate and empty guesses
- [x] Accent-insensitive, surname, compound-surname and minor-typo matching
- [x] 120-second timer, perfect-run handling, Give Up and timeout reveal
- [x] Daily team results, final challenge results and stable daily selection
- [x] Shirt numbers, player rarity labels and position/club hints where source data exists
- [x] Local statistics, reset, compact interface and reduced-motion settings
- [x] Offline service-worker cache for app shell and all local squad data
- [x] Historical data: 192 teams / 4,511 player records (2002–2022)
- [x] 2026 data: 48 teams / 1,248 player records
- [x] All 240 teams bundled for local, unranked gameplay
- [x] 50 squad-edition Daily exclusions applied to all local Daily tiers
- [x] Automated name matching across all 5,759 player records
- [x] Mobile browser smoke suite covering all modes, timer, results, local stats, settings and offline reload
- [x] Source attribution and license notes displayed in the app and documented
- [x] GitHub Actions runs syntax, data, matching, build, browser and Edge Function type checks

## Data limitations that remain visible

- Historical club-at-tournament data is not present in the upstream DataHub squads CSV. Historical Easy mode therefore shows positions, not invented club hints.
- The 2026 snapshot has 20 fully reviewed teams and 28 unverified practice teams.
- All local games are unranked because the answer rosters are shipped to the browser for offline play.
- The 50-team exclusion list is curated and should be reviewed after actual gameplay feedback.

## Deferred online phase

- [ ] Reintegrate frontend API calls for online game sessions
- [ ] Deploy Supabase migrations and Edge Functions to a real project
- [ ] Sync only fully audited squads and keep answer names server-side
- [ ] Test RLS, attempt uniqueness, concurrency, timer boundaries and Daily resume
- [ ] Implement and test ranked Daily and Normal results
- [ ] Implement weekly leaderboard, score distributions and percentiles
- [ ] Add online end-to-end tests before enabling any ranked mode
- [ ] Deploy and verify the online version on iPhone Safari

## Release rules

- Never label unreviewed squads as verified.
- Never invent historical clubs or substitute a player's current club for their tournament-time club.
- Never expose a Supabase service-role key in frontend code.
- Never show fake global statistics, leaderboard entries or ranked Daily availability.
- The local-first build is safe for unranked play only; it is not a secure competitive build.
