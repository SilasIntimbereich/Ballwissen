// Player rarity describes how difficult a player is to recall, not their quality.
// The same deterministic assignment is used by the browser and Supabase resolver.
export const RARITY_TIERS=["Common","Rare","Niche","Legendary","Ball Knowledge"];

export function rarityFromEvidence({caps=0,goals=0,majorAwards=0,globalRecognition=0,clubProfile=0}={}){
  const safe=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const profile=Math.min(100,safe(caps))*0.25+Math.min(5,safe(majorAwards))*5+
    Math.min(5,safe(globalRecognition))*5+Math.min(5,safe(clubProfile))*3+Math.min(30,safe(goals))*0.25;
  if(profile>=45)return "Common";
  if(profile>=32)return "Rare";
  if(profile>=20)return "Niche";
  if(profile>=9)return "Legendary";
  return "Ball Knowledge";
}

const normalise=value=>String(value||"")
  .replace(/[æÆ]/g,"ae").replace(/[œŒ]/g,"oe").replace(/[øØ]/g,"o")
  .replace(/[łŁ]/g,"l").replace(/[ßẞ]/g,"ss").replace(/[đĐðÐ]/g,"d")
  .replace(/[þÞ]/g,"th").replace(/[ıİ]/g,"i")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[’']/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");

const COMMON_NAMES=new Set(`
Kylian Mbappe|Lionel Messi|Cristiano Ronaldo|Neymar|Luka Modric|Antoine Griezmann|Paul Pogba|N Golo Kante|Olivier Giroud|Hugo Lloris|Raphael Varane|Ousmane Dembele|Eden Hazard|Kevin De Bruyne|Romelu Lukaku|Thibaut Courtois|Sergio Ramos|Gerard Pique|Andres Iniesta|Xavi|Iker Casillas|David Villa|Fernando Torres|Carles Puyol|Zinedine Zidane|Thierry Henry|Ronaldinho|Ronaldo Nazario|Rivaldo|Kaka|Roberto Carlos|Cafu|Pele|Maradona|Robert Lewandowski|Manuel Neuer|Thomas Muller|Toni Kroos|Mesut Ozil|Miroslav Klose|Bastian Schweinsteiger|Philipp Lahm|Mario Gotze|Wayne Rooney|David Beckham|Steven Gerrard|Frank Lampard|Harry Kane|Jude Bellingham|Mohamed Salah|Sadio Mane|Didier Drogba|Samuel Etoo|Yaya Toure|Michael Essien|Son Heung Min|Zlatan Ibrahimovic|Luis Suarez|Edinson Cavani|Diego Forlan|James Rodriguez|Radamel Falcao|Alexis Sanchez|Arturo Vidal|Ivan Rakitic|Ivan Perisic|Mario Mandzukic|Robin Van Persie|Arjen Robben|Wesley Sneijder|Gianluigi Buffon|Fabio Cannavaro|Andrea Pirlo|Francesco Totti|Alessandro Del Piero|Paolo Maldini|Gennaro Gattuso|Giorgio Chiellini|Dani Alves|Marcelo|Casemiro|Vinicius Junior|Alisson|Ederson|Thiago Silva|Marquinhos|Sergio Busquets|David Silva|Cesc Fabregas|Karim Benzema|Franck Ribery|Gareth Bale|Ryan Giggs|Tim Cahill|Harry Kewell|Hideo Nakata|Keisuke Honda|Shinji Kagawa|Landon Donovan|Clint Dempsey|Tim Howard|Carlos Valderrama|Rafael Marquez|Guillermo Ochoa|Cuauhtemoc Blanco|Pavel Nedved|Tomas Rosicky|Petr Cech|Hakan Sukur|Arda Turan|Adriano|Romario|Zico|Socrates|Bebeto|Johan Cruyff|Marco Van Basten|Frank Rijkaard|Ruud Gullit|Dennis Bergkamp|Roberto Baggio|Christian Vieri|Filippo Inzaghi|Daniele De Rossi|Mario Balotelli|Michael Ballack|Oliver Kahn|Jens Lehmann|Sami Khedira|Mats Hummels|Jerome Boateng|Ilkay Gundogan|Kai Havertz|Jamal Musiala|Florian Wirtz|David Alaba|Kalidou Koulibaly|Achraf Hakimi|Hakim Ziyech|Yassine Bounou|Mehdi Benatia|Riyad Mahrez|Islam Slimani|Vincent Aboubakar|George Weah|Asamoah Gyan|Nani|Ricardo Quaresma|Joao Moutinho|Pepe|Joao Felix|Bruno Fernandes|Bernardo Silva|Diego Costa|Pedro|Juan Mata|Sergio Aguero|Angel Di Maria|Gonzalo Higuain|Javier Mascherano|Javier Zanetti|Esteban Cambiasso|Juan Cuadrado|Park Ji Sung|Ali Karimi|Mehdi Mahdavikia|Luis Figo|Deco|Patrick Vieira|Claude Makelele|Xabi Alonso|Raul Gonzalez|Fernando Hierro|David Trezeguet|Koke|Marek Hamsik|Edin Dzeko|Miralem Pjanic|Keylor Navas|Javier Hernandez|Andres Guardado|Bryan Ruiz|Roger Milla|Jay Jay Okocha|Nwankwo Kanu|Emmanuel Adebayor|John Obi Mikel|Kolo Toure|Salomon Kalou|Shunsuke Nakamura|Yuto Nagatomo|Makoto Hasebe|Shinji Okazaki|Lukas Podolski|Claudio Marchisio|Antonio Di Natale|Gabriel Batistuta|Carlos Tevez|Juan Roman Riquelme|Hernan Crespo|Giovani Dos Santos|Gervinho|Sofiane Feghouli|Yacine Brahimi|Nemanja Vidic|Branislav Ivanovic|Darijo Srna|Dejan Stankovic|Goran Pandev
`.split("|").map(normalise));

function playerNames(player){
  return [player?.name,...(Array.isArray(player?.aliases)?player.aliases:[])]
    .filter(Boolean).map(normalise).filter(Boolean);
}

function isRecognised(player,appearances){
  return playerNames(player).some(name=>COMMON_NAMES.has(name)||(appearances.get(name)?.size||0)>=3);
}

function rarityPriority(player,appearances,thirdKeeper){
  const names=playerNames(player);
  const appearancesCount=Math.max(0,...names.map(name=>appearances.get(name)?.size||0));
  const number=Number(player.number)||0;
  // Higher score means a deeper-cut recall challenge. Shirt number is only a
  // tie-breaker; one-off tournament appearances and reserve keepers carry more weight.
  return (appearancesCount<=1?40:0)+(thirdKeeper?35:0)+(number>=23?Math.min(15,number-22):0);
}

export function assignRosterRarities(rosters,publicData){
  const teams=Array.isArray(rosters?.teams)?rosters.teams:[];
  const metadata=new Map((publicData?.teams||[]).map(team=>[team.id,team]));
  const appearances=new Map();

  for(const squad of teams){
    const year=metadata.get(squad.id)?.year;
    for(const player of squad.players||[]){
      for(const name of playerNames(player)){
        if(!appearances.has(name))appearances.set(name,new Set());
        if(Number.isFinite(Number(year)))appearances.get(name).add(Number(year));
      }
    }
  }

  for(const squad of teams){
    const difficulty=metadata.get(squad.id)?.teamDifficulty||"niche";
    const players=Array.isArray(squad.players)?squad.players:[];
    const keepers=players.filter(player=>String(player.position||"").toUpperCase()==="GK")
      .sort((a,b)=>(Number(a.number)||99)-(Number(b.number)||99));
    const thirdKeepers=new Set(keepers.slice(2).map(player=>player));

    const candidates=[];
    for(const [index,player] of players.entries()){
      const names=playerNames(player);
      const appearancesCount=Math.max(0,...names.map(name=>appearances.get(name)?.size||0));
      const recognised=isRecognised(player,appearances);
      const repeated=appearancesCount>=2;
      let rarity;

      if(recognised)rarity="Common";
      else if(difficulty==="common")rarity=(thirdKeepers.has(player)||Number(player.number)>=23)&&!repeated?"Rare":"Common";
      else if(difficulty==="niche")rarity=repeated?"Rare":"Niche";
      else rarity=repeated?"Rare":"Niche";

      player.rarity=rarity;
      if(difficulty==="legendary"&&!recognised){
        candidates.push({
          player,index,
          score:rarityPriority(player,appearances,thirdKeepers.has(player))
        });
      }
    }

    // Reserve elite labels for genuinely obscure players in Legendary squads.
    // Per-team quotas make the tier meaningful in every Daily Legendary round,
    // rather than allowing a handful of players worldwide to consume all labels.
    if(difficulty==="legendary"){
      candidates.sort((a,b)=>b.score-a.score||a.index-b.index);
      if(candidates[0])candidates[0].player.rarity="Ball Knowledge";
      candidates.slice(1,3).forEach(({player})=>{player.rarity="Legendary";});
    }
  }
  return rosters;
}
