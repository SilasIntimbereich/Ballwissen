# Setup guide (iPhone-friendly)

## Current state
The repository contains a responsive game shell and a France 2018 demonstration roster. The full tournament dataset, verified rarity metadata, secure Daily endpoints, global statistics and weekly leaderboard are not yet complete. Do not publish this as a finished full game.

## Preview
The site is static. Deploy the repository to Netlify or use GitHub Pages for a temporary preview. The normal demo round works without Supabase.

## Netlify
1. Create/sign in to Netlify.
2. Add a new site and import the private GitHub repository `SilasIntimbereich/Ballwissen`.
3. Build command: leave empty. Publish directory: `.`.
4. Deploy.

## Supabase (not active yet)
1. Create a Supabase project.
2. Open SQL Editor and run `database/schema.sql`.
3. Keep the service-role key server-side only. Never paste it into `assets/js`.
4. Do not enable Daily modes, leaderboard or public statistics until server-side challenge selection, one-attempt enforcement, result validation and privacy-safe aggregate queries have been implemented and tested.

## Data integrity
Only add a team after checking the final tournament squad list. Preserve tournament-era clubs and positions. Record source and license attribution. The current France 2018 list is a demonstration fixture and should be cross-checked before public release.
