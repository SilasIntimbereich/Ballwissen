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
// This rubric is a starting point, not an automatic truth machine. Curate and record evidence.
