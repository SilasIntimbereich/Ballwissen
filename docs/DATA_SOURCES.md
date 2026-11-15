# Data sources and licensing

## Historical men's World Cup squads (2002–2022)
Primary source: Fjelstul, Joshua C., *Fjelstul World Cup Database*, distributed through DataHub:
https://datahub.io/football/worldcup

Stable CSV sources:
- Squads: https://datahub.io/football/worldcup/_r/-/squads.csv
- Tournaments: https://datahub.io/football/worldcup/_r/-/tournaments.csv

The dataset documents one row per player per tournament squad, including team, player, shirt number, position and club. The importer filters men's tournaments for 2002, 2006, 2010, 2014, 2018 and 2022, then validates 32 teams and roster sizes before writing JSON.

License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). Adapted historical data must retain attribution and share-alike licensing.

Attribution:
"Squad data adapted from Fjelstul, Joshua C., Fjelstul World Cup Database, via DataHub (https://datahub.io/football/worldcup), licensed CC BY-SA 4.0."

## 2026 men's World Cup
The repository includes a 1,248-row, 48-team squad CSV snapshot adapted from:
https://github.com/erickalfaro/world-cup-data-2026

The source README describes the file as the registered 26-player squad dataset and documents the source/provenance and 2026-07-03 snapshot date:
https://github.com/erickalfaro/world-cup-data-2026/blob/main/data/README.md

FIFA independently confirmed that final squad lists comprised 1,248 players from 48 nations:
https://inside.fifa.com/organisation/media-releases/world-cup-2026-48-squads-confirmed

Official name-by-name verification source:
https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf

The current imported snapshot matches FIFA's published overall total and team count. Before launch, compare each player's name, team and club against the official final FIFA lists, including late replacements. The CSV is a third-party structured snapshot, not a direct FIFA export.

## Tournament-era club names
Preserve clubs listed for the tournament snapshot. Do not substitute a player's current club. If club data is absent or unclear, leave the hint blank and record a verification note.

## Validation requirements
- Confirm tournament year and men's competition.
- Confirm actual qualified teams for that edition.
- Confirm final registered squad membership.
- Confirm player spelling, position and shirt number.
- Verify club at the tournament date separately.
- Store source URL, source snapshot date and verification notes.
- Do not mark a team complete until membership has been compared with an official final squad list.

## Important
The France 2018 fallback roster is a demonstration fixture and is not treated as a complete verified historical data import. The 2026 CSV is loaded in the game, but final name-by-name audit remains a release check.
