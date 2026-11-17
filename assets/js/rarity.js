// Rarity policy: do not assign tiers randomly. This is a scoring rubric to apply
// after collecting verifiable evidence. Scores are editorial metadata and must be reviewed.
export const RARITY_TIERS=["Common","Rare","Niche","Legendary","Ball Knowledge"];
export function rarityFromEvidence({caps=0,goals=0,majorAwards=0,globalRecognition=0,clubProfile=0}={}){
  // Evidence scales: caps 0-100+, awards 0-5, recognition/profile 0-5.
  // High international profile and awards make a player easier to recall.
  const profile=Math.min(100,caps)*0.25+Math.min(5,majorAwards)*5+
    Math.min(5,globalRecognition)*5+Math.min(5,clubProfile)*3+Math.min(30,goals)*0.25;
  if(profile>=45)return "Common";
  if(profile>=32)return "Rare";
  if(profile>=20)return "Niche";
  if(profile>=9)return "Legendary";
  return "Ball Knowledge";
}
// This rubric is a starting point, not an automatic truth machine. Curate and record evidence.export function assignRosterRarities(rosters, publicData) {
  const metadata = new Map((publicData?.teams || []).map(team => [team.id, team]));
  const appearances = new Map();

  for (const squad of rosters?.teams || []) {
    const year = metadata.get(squad.id)?.year;
    for (const player of squad.players || []) {
      const key = normalise(player.name);
      if (!appearances.has(key)) appearances.set(key, new Set());
      appearances.get(key).add(year);
    }
  }

  const exceptionalCandidates = [];

  for (const squad of rosters?.teams || []) {
    const team = metadata.get(squad.id) || {};
    const difficulty = team.teamDifficulty || "niche";
    const players = squad.players || [];
    const keepers = players
      .filter(player => String(player.position || "").toUpperCase() === "GK")
      .sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));
    const thirdKeepers = new Set(keepers.slice(2).map(player => normalise(player.name)));

    for (const [index, player] of players.entries()) {
      const name = normalise(player.name);
      const number = Number(player.number) || index + 1;
      const repeatCount = appearances.get(name)?.size || 0;
      const recognised = COMMON_NAMES.has(name) || repeatCount >= 3;
      const repeated = repeatCount >= 2;
      const thirdKeeper = thirdKeepers.has(name);

      if (recognised) {
        player.rarity = "Common";
        continue;
      }

      if (difficulty === "common") {
        player.rarity = number >= 22 ? "Rare" : "Common";
        continue;
      }

      if (difficulty === "niche") {
        player.rarity = repeated ? "Rare" : number >= 20 ? "Niche" : "Rare";
        continue;
      }

      player.rarity = repeated ? "Rare" : "Niche";

      if (difficulty === "legendary") {
        exceptionalCandidates.push({
          player,
          teamId: squad.id,
          score: (thirdKeeper ? 100 : 0) + number * 2 + (repeatCount === 0 ? 10 : 0)
        });
      }
    }
  }

  const bestPerTeam = new Map();
  exceptionalCandidates
    .sort((a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId))
    .forEach(candidate => {
      if (!bestPerTeam.has(candidate.teamId)) bestPerTeam.set(candidate.teamId, candidate);
    });

  const elite = [...bestPerTeam.values()].sort(
    (a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId)
  );

  elite.slice(0, 4).forEach(({ player }) => { player.rarity = "Ball Knowledge"; });
  elite.slice(4, 14).forEach(({ player }) => { player.rarity = "Legendary"; });

  return rosters;
}
