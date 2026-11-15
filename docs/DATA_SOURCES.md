# Data sources and licensing

## Historical men's World Cup squads (2002–2022)
Primary dataset candidate: Fjelstul, Joshua C., *Fjelstul World Cup Database*, distributed through DataHub's FIFA World Cup dataset. DataHub lists the dataset as CC BY-SA 4.0, updated 14 May 2026, and documents one row per player per tournament squad with team, player, shirt number and position. Dataset landing page: https://datahub.io/football/worldcup

Stable source files:
- squads.csv: https://datahub.io/football/worldcup/_r/-/squads.csv
- players.csv: https://datahub.io/football/worldcup/_r/-/players.csv
- teams.csv: https://datahub.io/football/worldcup/_r/-/teams.csv
- tournaments.csv: https://datahub.io/football/worldcup/_r/-/tournaments.csv

License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). Any redistributed adapted squad data must retain attribution and the same share-alike licensing requirements. Review the source license before commercial use.

Suggested attribution:
"Squad data adapted from Fjelstul, Joshua C., Fjelstul World Cup Database, via DataHub (https://datahub.io/football/worldcup), licensed CC BY-SA 4.0."

## 2026 men's World Cup
The historical Fjelstul/DataHub dataset currently covers men's tournaments through 2022. The 2026 tournament must be handled separately using final official squad lists and cross-checked against federation announcements. FIFA's official squad-list PDF is a verification source: https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf

## Tournament-era club names
The Fjelstul squads table provides positions and squad membership. Club information must be verified separately against contemporary tournament squad lists or reliable federation/club records. Never substitute a player's current club for their club at the tournament date.

## Validation requirements
- Confirm tournament ID and year.
- Confirm team qualified for that edition.
- Confirm player appears in the final registered squad, not merely a qualifier or matchday roster.
- Confirm name spelling, position and (where shown) shirt number.
- Verify tournament-era club separately.
- Store source URL and verification note for each tournament/team import.
- Record dataset version and import date.
- Do not mark a team complete until its roster count and membership have been checked against the source.

## Important
The repository currently contains only a France 2018 demonstration roster in the playable data module. It is not yet the complete tournament dataset. The demo list and its tournament-era clubs still require a final audit before public launch.
