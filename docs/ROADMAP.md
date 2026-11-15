# V4 implementation checklist

## Implemented in repository
- [x] Responsive stadium-inspired mobile frontend
- [x] English UI and five requested mode entry points
- [x] Normal Easy/Hard round, timer, fuzzy matching, duplicate protection and reveal states
- [x] All 48 teams and 1,248 players from the 2026 squad snapshot loaded into the normal selector
- [x] Historical squad import script for men's 2002–2022 tournaments with hard validation
- [x] GitHub Actions workflow to run the historical import from iPhone Safari
- [x] Supabase schema for private answer rosters, daily attempts, team results and leaderboard aggregates
- [x] Edge Function foundations for daily challenge start, server-side guess checking, daily team submission, normal result submission, team stats and weekly leaderboard
- [x] Deterministic daily challenge publisher that requires curated verified team tiers
- [x] iPhone deployment and backend setup guide
- [x] Source and license attribution

## Still required before public release
- [ ] Run the historical import workflow and inspect its validation output
- [ ] Audit every 2026 player against FIFA's final squad lists, including late replacements
- [ ] Audit historical clubs as they appear at each tournament date
- [ ] Curate team difficulty tiers (Common, Niche, Legendary) across all imported teams
- [ ] Curate player rarity tiers with evidence, not guesses
- [ ] Deploy Supabase migration and Edge Functions to a real project
- [ ] Sync all verified team metadata and private answer rosters to Supabase
- [ ] Publish the daily challenge schedule after team tiers are curated
- [ ] Wire the frontend to Supabase Auth and the Edge Functions
- [ ] Implement the three-team Daily UI, one-attempt-per-day messaging and combined results
- [ ] Implement live score-distribution chart and outscored percentile in the result UI
- [ ] Implement live weekly top-10 leaderboard and current user's rank
- [ ] Add automated end-to-end tests for timer boundaries, attempt uniqueness, concurrency, RLS and mobile Safari
- [ ] Deploy and verify production website

## Release rule
Never show fake global statistics, fake leaderboard entries, unverified team difficulty, or Daily availability without a published challenge schedule. Keep online features disabled until the backend is deployed and tested.
