export function createRound(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new TypeError("A round needs at least one player.");
  }
  return { players: [...players], found: new Set(), ended: false };
}

export function submitGuess(round, guess, matcher) {
  if (!round || round.ended) return { status: "ended" };
  const value = String(guess ?? "").trim();
  if (!value) return { status: "empty" };
  const index = round.players.findIndex((player, i) =>
    !round.found.has(i) && matcher(value, player, round.players)
  );
  if (index < 0) {
    const duplicate = round.players.some((player, i) =>
      round.found.has(i) && matcher(value, player, round.players)
    );
    return { status: duplicate ? "duplicate" : "incorrect" };
  }
  round.found.add(index);
  const complete = round.found.size === round.players.length;
  if (complete) round.ended = true;
  return {
    status: "correct",
    index,
    player: round.players[index],
    score: round.found.size,
    total: round.players.length,
    complete
  };
}

export function revealRound(round) {
  if (!round) return { score: 0, total: 0, missed: [] };
  round.ended = true;
  const missed = round.players
    .map((player, index) => ({ player, index }))
    .filter(item => !round.found.has(item.index));
  return { score: round.found.size, total: round.players.length, missed };
}
