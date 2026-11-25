// Player rarity measures player recognition only. Shirt numbers, positions,
// national-team difficulty and squad quotas must never affect the result.
export const RARITY_TIERS = ["Common", "Rare", "Niche", "Legendary", "Ball Knowledge"];

const normalise = value => String(value || "")
  .replace(/[æÆ]/g, "ae").replace(/[œŒ]/g, "oe").replace(/[øØ]/g, "o")
  .replace(/[łŁ]/g, "l").replace(/[ßẞ]/g, "ss").replace(/[đĐðÐ]/g, "d")
  .replace(/[þÞ]/g, "th").replace(/[ıİ]/g, "i")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[’']/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const COMMON_NAMES = new Set(`
Kylian Mbappe|Lionel Messi|Cristiano Ronaldo|Neymar|Luka Modric|Antoine Griezmann|Paul Pogba|N Golo Kante|Olivier Giroud|Hugo Lloris|Raphael Varane|Ousmane Dembele|Eden Hazard|Kevin De Bruyne|Romelu Lukaku|Thibaut Courtois|Sergio Ramos|Gerard Pique|Andres Iniesta|Xavi|Iker Casillas|David Villa|Fernando Torres|Carles Puyol|Zinedine Zidane|Thierry Henry|Ronaldinho|Ronaldo Nazario|Rivaldo|Kaka|Roberto Carlos|Cafu|Pele|Maradona|Robert Lewandowski|Manuel Neuer|Thomas Muller|Toni Kroos|Mesut Ozil|Miroslav Klose|Bastian Schweinsteiger|Philipp Lahm|Mario Gotze|Wayne Rooney|David Beckham|Steven Gerrard|Frank Lampard|Harry Kane|Jude Bellingham|Mohamed Salah|Sadio Mane|Didier Drogba|Samuel Etoo|Yaya Toure|Michael Essien|Son Heung Min|Zlatan Ibrahimovic|Luis Suarez|Edinson Cavani|Diego Forlan|James Rodriguez|Radamel Falcao|Alexis Sanchez|Arturo Vidal|Ivan Rakitic|Ivan Perisic|Mario Mandzukic|Robin Van Persie|Arjen Robben|Wesley Sneijder|Gianluigi Buffon|Fabio Cannavaro|Andrea Pirlo|Francesco Totti|Alessandro Del Piero|Paolo Maldini|Gennaro Gattuso|Giorgio Chiellini|Dani Alves|Marcelo|Casemiro|Vinicius Junior|Alisson|Ederson|Thiago Silva|Marquinhos|Sergio Busquets|David Silva|Cesc Fabregas|Karim Benzema|Franck Ribery|Gareth Bale|Ryan Giggs|Tim Cahill|Harry Kewell|Hideo Nakata|Keisuke Honda|Shinji Kagawa|Landon Donovan|Clint Dempsey|Tim Howard|Carlos Valderrama|Rafael Marquez|Guillermo Ochoa|Cuauhtemoc Blanco|Pavel Nedved|Tomas Rosicky|Petr Cech|Hakan Sukur|Arda Turan|Adriano|Romario|Zico|Socrates|Bebeto|Johan Cruyff|Marco Van Basten|Frank Rijkaard|Ruud Gullit|Dennis Bergkamp|Roberto Baggio|Christian Vieri|Filippo Inzaghi|Daniele De Rossi|Mario Balotelli|Michael Ballack|Oliver Kahn|Jens Lehmann|Sami Khedira|Mats Hummels|Jerome Boateng|Ilkay Gundogan|Kai Havertz|Jamal Musiala|Florian Wirtz|David Alaba|Kalidou Koulibaly|Achraf Hakimi|Hakim Ziyech|Yassine Bounou|Mehdi Benatia|Riyad Mahrez|Islam Slimani|Vincent Aboubakar|George Weah|Asamoah Gyan|Nani|Ricardo Quaresma|Joao Moutinho|Pepe|Joao Felix|Bruno Fernandes|Bernardo Silva|Diego Costa|Pedro|Juan Mata|Sergio Aguero|Angel Di Maria|Gonzalo Higuain|Javier Mascherano|Javier Zanetti|Esteban Cambiasso|Juan Cuadrado|Park Ji Sung|Ali Karimi|Mehdi Mahdavikia|Luis Figo|Deco|Patrick Vieira|Claude Makelele|Xabi Alonso|Raul Gonzalez|Fernando Hierro|David Trezeguet|Koke|Marek Hamsik|Edin Dzeko|Miralem Pjanic|Keylor Navas|Javier Hernandez|Andres Guardado|Bryan Ruiz|Roger Milla|Jay Jay Okocha|Nwankwo Kanu|Emmanuel Adebayor|John Obi Mikel|Kolo Toure|Salomon Kalou|Shunsuke Nakamura|Yuto Nagatomo|Makoto Hasebe|Shinji Okazaki|Lukas Podolski|Claudio Marchisio|Antonio Di Natale|Gabriel Batistuta|Carlos Tevez|Juan Roman Riquelme|Hernan Crespo|Giovani Dos Santos|Gervinho|Sofiane Feghouli|Yacine Brahimi|Nemanja Vidic|Branislav Ivanovic|Darijo Srna|Dejan Stankovic|Goran Pandev
`.split("|").map(normalise));

// These lists are deliberately explicit. Add a player only when there is
// evidence for their worldwide recognition level, not to fill a quota.
const LEGENDARY_NAMES = new Set([]);
const BALL_KNOWLEDGE_NAMES = new Set([]);

export function rarityFromEvidence({ globalRecognition = 0 } = {}) {
  const score = Number.isFinite(Number(globalRecognition))
    ? Math.max(0, Math.min(5, Number(globalRecognition))) : 0;
  if (score >= 5) return "Common";
  if (score >= 4) return "Rare";
  if (score >= 3) return "Niche";
  if (score >= 2) return "Legendary";
  return "Ball Knowledge";
}

const playerNames = player => [player?.name, ...(Array.isArray(player?.aliases) ? player.aliases : [])]
  .filter(Boolean).map(normalise).filter(Boolean);

export function assignRosterRarities(rosters, publicData) {
  const teams = Array.isArray(rosters?.teams) ? rosters.teams : [];
  const metadata = new Map((publicData?.teams || []).map(team => [team.id, team]));
  const verifiedTeams = teams.filter(team => metadata.get(team.id)?.verified === true);
  const appearances = new Map();

  // Only independently verified tournament appearances count as popularity evidence.
  for (const squad of verifiedTeams) {
    const year = Number(metadata.get(squad.id)?.year);
    for (const player of squad.players || []) {
      for (const name of playerNames(player)) {
        if (!appearances.has(name)) appearances.set(name, new Set());
        if (Number.isFinite(year)) appearances.get(name).add(year);
      }
    }
  }

  for (const squad of verifiedTeams) {
    for (const player of squad.players || []) {
      const names = playerNames(player);
      const key = names[0];
      const count = Math.max(0, ...names.map(name => appearances.get(name)?.size || 0));
      let rarity;
      if (names.some(name => COMMON_NAMES.has(name)) || count >= 3) rarity = "Common";
      else if (names.some(name => LEGENDARY_NAMES.has(name))) rarity = "Legendary";
      else if (names.some(name => BALL_KNOWLEDGE_NAMES.has(name))) rarity = "Ball Knowledge";
      else if (count >= 2) rarity = "Rare";
      else rarity = "Niche";
      player.rarity = rarity;
    }
  }

  return rosters;
}
