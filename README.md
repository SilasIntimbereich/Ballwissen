# FOOTBALL ARCADE V4

A mobile-first, English-language retro pixel-art World Cup squad quiz.

## Current build status

The first playable frontend foundation is committed. It currently contains a normal-mode demo round using a France 2018 sample roster. This is **not yet the complete V4 release**: full tournament data, rarity curation, Daily backend, global statistics and weekly leaderboard remain in progress.

## Implemented foundation

- Responsive stadium-inspired pixel-art interface
- Five requested mode entry points: Daily Common, Daily Niche, Daily Legendary, Normal Easy and Normal Hard
- Tournament selector for 2002, 2006, 2010, 2014, 2018, 2022 and 2026
- 120-second normal-mode demo, tolerant name matching and duplicate protection
- Found/missed reveal states and Give Up
- Initial Supabase schema with Row Level Security
- Netlify static deployment configuration

## Product requirements

Historical men's World Cup squads for 2002–2026, actual participating teams per edition, tournament-era clubs, five player rarity tiers, three-team Daily challenges, one attempt per day, real score distributions and a rolling seven-day Daily Common leaderboard.

Online features must remain disabled until secure server-side challenge assignment, result validation and privacy-safe aggregate queries are implemented. Never display fake statistics or leaderboard data.

## Documentation

- [Setup guide](docs/SETUP.md)
- [Data sources and licensing](docs/DATA_SOURCES.md)
- [V4 implementation checklist](docs/ROADMAP.md)
- [Roster data schema example](data/schema.example.json)
- [Data attribution](data/ATTRIBUTION.txt)

## Historical data

Historical squad data is planned to be adapted from the Fjelstul World Cup Database via DataHub, licensed CC BY-SA 4.0. The 2026 squads require separate verification against final official squad lists. See the data-source document for attribution and validation rules.

## Deployment

The intended deployment is Netlify with Supabase. Follow the setup guide. Do not place Supabase service-role credentials in browser code.
