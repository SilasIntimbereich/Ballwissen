# Data sources and licensing

## Historical men's World Cup squads (2002–2022)
Primary source: Fjelstul, Joshua C., *Fjelstul World Cup Database*, distributed through DataHub:
https://datahub.io/football/worldcup

Stable CSV sources:
- Squads: https://datahub.io/football/worldcup/_r/-/squads.csv
- Tournaments: https://datahub.io/football/worldcup/_r/-/tournaments.csv

The dataset documents one row per player per tournament squad, including team, player, shirt number and position. It does not contain tournament-time club fields. The importer filters men's tournaments for 2002, 2006, 2010, 2014, 2018 and 2022, then validates 32 teams and roster sizes before writing JSON. Historical club hints therefore remain blank until sourced independently.

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

The current imported snapshot matches FIFA's published overall total and team count. Complete 26-player audits have now been recorded for Czechia (the repository labels it Czech Republic) and Australia against FIFA's final PDF and NBC Sports' confirmed squad lists. Germany is also fully audited against FIFA's final PDF and the DFB's official 5 June replacement notice, which resolves the late Lennart Karl / Assan Ouédraogo change. France is also fully audited against FIFA's final PDF and NBC Sports' confirmed squad list. Argentina is audited against FIFA's final PDF and the DFB's historical tournament data center; the audit corrected Nicolás González's position to FW. A separate manual spot-check is recorded for Germany and France, plus selected rows for Australia and Brazil. The other 43 teams still require full audits. Before launch, compare every remaining player's name, team, position and club against the official final FIFA lists, including late replacements. The CSV is a third-party structured snapshot, not a direct FIFA export.

## Independent audit sources
- 2002: RSSSF squad archive https://www.rsssf.org/tables/2002full.html; FIFA-released roster transcription https://www.lacancha.com/Roster.html; contemporary club references for selected teams https://www.theguardian.com/football/2002/may/12/worldcupfootball2002.sport2
- 2006: FIFA Data squad-list PDF https://www.fifadata.com/document/fwc/2006/PDF/FWC_2006_SquadLists.pdf
- 2010: FIFA Data squad-list PDF https://www.fifadata.com/document/fwc/2010/PDF_BackUp_2010_06_13/FWC_2010_SquadLists.pdf
- 2014: FIFA Data squad-list PDF https://www.fifadata.com/document/FWC/2014/pdf/FWC_2014_SquadLists.pdf
- 2018: FIFA Data squad-list PDF https://www.fifadata.com/document/fwc/2018/pdf/FWC_2018_SQUADLISTS.pdf
- 2022: FIFA official final squad-list PDF https://fdp.fifa.org/assetspublic/ce44/pdf/SquadLists-English.pdf
- 2026: FIFA official final squad-list PDF https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf

For 2006–2018, the located FIFA Data PDFs are mirrored on the FIFA Data domain; verify provenance and use RSSSF or another independent source for cross-checks. For 2002, the sources located so far do not yet provide a complete, authoritative club-at-tournament table for all 32 teams.

## Tournament-era club names
Preserve clubs listed for the tournament snapshot. Do not substitute a player's current club. If club data is absent or unclear, leave the hint blank and record a verification note.

## Player-level audit gate
The player-level ledger is data/roster-audit.json. A team is marked verified only when every roster player has a matching audit row with shirt number, normalized name, position, tournament-time club, primary source and secondary source. scripts/validate-data.mjs and scripts/sync-supabase-data.mjs enforce this gate. A row count or a successful import is not an independent audit.

## Validation requirements
- Confirm tournament year and men's competition.
- Confirm actual qualified teams for that edition.
- Confirm final registered squad membership.
- Confirm player spelling, position and shirt number.
- Verify club at the tournament date separately.
- Store source URL, source snapshot date and verification notes.
- Do not mark a team complete until membership has been compared with an official final squad list and an independent secondary source.
