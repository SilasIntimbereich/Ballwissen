# FOOTBALL ARCADE V4

A mobile-first, retro pixel-art World Cup squad quiz.

## Project status

The repository is being built in stages. This README records the product contract so implementation stays consistent. A feature is not considered complete until it is implemented and tested.

## Game requirements

- World Cup men's squads for 2002, 2006, 2010, 2014, 2018, 2022 and 2026.
- Tournament selector lists only teams that participated in that tournament.
- Squad rosters are historical and must not be replaced with current club/national-team rosters.
- Easy mode shows player name targets with position, nation and tournament-era club hints.
- Hard mode hides hints.
- 120-second rounds; correct guesses reveal the player; duplicates never score twice.
- Accept reasonable spelling variants, accents and minor typos without unsafe short-name matches.
- At timeout or Give Up, missed players are revealed in red and found players in green.
- English game interface; no starting XI or formation, only the full squad list.
- iPhone-first responsive layout and lightweight animated pixel-art stadium menu.

## Modes

1. Daily Common
2. Daily Niche
3. Daily Legendary
4. Normal Easy
5. Normal Hard

Each Daily mode consists of three teams and is limited to one attempt per player per day. Daily assignment and attempt enforcement must be server-side. Common and Niche provide club/position hints; Legendary does not.

## Rarity and difficulty

Player rarity is independent of team difficulty. Player rarity levels: Common, Rare, Niche, Legendary, Ball Knowledge. Team difficulty is used only for selecting Daily challenges. Rarity assignments must be documented and evidence-based, not random.

## Backend requirements

Use Supabase for persistence and server-side validation. Never expose the Supabase service-role key in client code. Enable Row Level Security and use server-side functions for daily assignment, attempt enforcement, result submission, aggregate score distributions and weekly leaderboard calculations.

Statistics must be real aggregate data. Do not display fabricated global percentages or leaderboard entries. If backend configuration is absent, explain that online features are unavailable while local normal play remains usable.

## Planned structure

- `index.html`
- `assets/css/`
- `assets/js/`
- `data/` for validated tournament and squad data
- `database/` for schema, policies and functions
- `netlify/functions/` for secure server endpoints
- `scripts/` for data validation/import helpers
- `.env.example`
- `netlify.toml`

## Data provenance

Roster data must include source attribution and license information. The project must not claim full tournament coverage until every included team and squad has been validated. No invented players or silently substituted rosters.

## Deployment

The intended deployment is Netlify with Supabase. See the setup guide (to be added) before configuring production secrets.
