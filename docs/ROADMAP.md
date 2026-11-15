# V4 implementation checklist

## Implemented foundation
- [x] Responsive pixel-art stadium shell and English UI
- [x] Main menu with five requested mode entry points
- [x] Normal Easy and Hard demo round
- [x] 120-second timer, fuzzy matching, duplicate protection, Give Up and reveal states
- [x] Tournament selector years 2002–2026
- [x] Initial Supabase schema with RLS and no client-side result insert
- [x] Netlify static-site configuration and iPhone setup guide

## Still required before the product can be called complete
- [ ] Import and validate all 32-team squads for 2002, 2006, 2010, 2014, 2018 and 2022
- [ ] Import and independently verify all 48 final squads for 2026
- [ ] Validate tournament-era club hints
- [ ] Create evidence-based player rarity metadata (Common, Rare, Niche, Legendary, Ball Knowledge)
- [ ] Define and test separate team-difficulty tiers for Daily selection
- [ ] Build deterministic daily assignment for three teams per daily mode
- [ ] Enforce one attempt per user per day on the server
- [ ] Implement secure result submission and anti-cheat checks
- [ ] Implement real team score distributions and percentile calculations
- [ ] Implement weekly leaderboard from rolling seven days of Daily Common results
- [ ] Add authentication/profile lifecycle and privacy-safe display names
- [ ] Add rarity reveal animations that never block typing or timer
- [ ] Add automated roster, matching, daily-boundary and security tests
- [ ] Test on iPhone Safari and desktop browsers
- [ ] Deploy and verify production build

## Release rule
Do not display fabricated global statistics, leaderboard rows, daily availability or full tournament coverage. Keep online features disabled until the backend functions and database policies are implemented and tested.
