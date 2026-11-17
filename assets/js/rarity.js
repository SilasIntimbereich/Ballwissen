// Player rarity is based on recall difficulty, not player quality.
export const RARITY_TIERS=["Common","Rare","Niche","Legendary","Ball Knowledge"];

export function rarityFromEvidence({caps=0,goals=0,majorAwards=0,globalRecognition=0,clubProfile=0}={}){
  const profile=Math.min(100,caps)*0.25+Math.min(5,majorAwards)*5+
    Math.min(5,globalRecognition)*5+Math.min(5,clubProfile)*3+Math.min(30,goals)*0.25;
  if(profile>=45)return "Common";
  if(profile>=32)return "Rare";
  if(profile>=20)return "Niche";
  if(profile>=9)return "Legendary";
  return "Ball Knowledge";
}

const normalise=value=>String(value||"")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[’']/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");

const COMMON_NAMES=new Set(`
Kylian Mbappe|Lionel Messi|Cristiano Ronaldo|Neymar|Luka Modric|Antoine Griezmann|Paul Pogba|N Golo Kante|Olivier Giroud|Hugo Lloris|Raphael Varane|Ousmane Dembele|Eden Hazard|Kevin De Bruyne|Romelu Lukaku|Thibaut Courtois|Sergio Ramos|Gerard Pique|Andres Iniesta|Xavi|Iker Casillas|David Villa|Fernando Torres|Carles Puyol|Zinedine Zidane|Thierry Henry|Ronaldinho|Ronaldo Nazario|Rivaldo|Kaka|Roberto Carlos|Cafu|Pele|Maradona|Robert Lewandowski|Manuel Neuer|Thomas Muller|Toni Kroos|Mesut Ozil|Miroslav Klose|Bastian Schweinsteiger|Philipp Lahm|Mario Gotze|Wayne Rooney|David Beckham|Steven Gerrard|Frank Lampard|Harry Kane|Jude Bellingham|Mohamed Salah|Sadio Mane|Didier Drogba|Samuel Etoo|Yaya Toure|Michael Essien|Son Heung Min|Zlatan Ibrahimovic|Luis Suarez|Edinson Cavani|Diego Forlan|James Rodriguez|Radamel Falcao|Alexis Sanchez|Arturo Vidal|Ivan Rakitic|Ivan Perisic|Mario Mandzukic|Robin Van Persie|Arjen Robben|Wesley Sneijder|Gianluigi Buffon|Fabio Cannavaro|Andrea Pirlo|Francesco Totti|Alessandro Del Piero|Paolo Maldini|Gennaro Gattuso|Giorgio Chiellini|Dani Alves|Marcelo|Casemiro|Vinicius Junior|Alisson|Ederson|Thiago Silva|Marquinhos|Sergio Busquets|David Silva|Cesc Fabregas|Karim Benzema|Franck Ribery|Gareth Bale|Ryan Giggs|Tim Cahill|Harry Kewell|Hideo Nakata|Keisuke Honda|Shinji Kagawa|Landon Donovan|Clint Dempsey|Tim Howard|Carlos Valderrama|Rafael Marquez|Guillermo Ochoa|Cuauhtemoc Blanco|Pavel Nedved|Tomas Rosicky|Petr Cech|Hakan Sukur|Arda Turan|Adriano|Romario|Zico|Socrates|Bebeto|Johan Cruyff|Marco Van Basten|Frank Rijkaard|Ruud Gullit|Dennis Bergkamp|Roberto Baggio|Christian Vieri|Filippo Inzaghi|Daniele De Rossi|Mario Balotelli|Michael Ballack|Oliver Kahn|Jens Lehmann|Sami Khedira|Mats Hummels|Jerome Boateng|Ilkay Gundogan|Kai Havertz|Jamal Musiala|Florian Wirtz|David Alaba|Kalidou Koulibaly|Achraf Hakimi|Hakim Ziyech|Yassine Bounou|Mehdi Benatia|Riyad Mahrez|Islam Slimani|Vincent Aboubakar|George Weah|Asamoah Gyan|Nani|Ricardo Quaresma|Joao Moutinho|Pepe|Joao Felix|Bruno Fernandes|Bernardo Silva|Diego Costa|Pedro|Juan Mata|Sergio Aguero|Angel Di Maria|Gonzalo Higuain|Javier Mascherano|Javier Zanetti|Esteban Cambiasso|Juan Cuadrado|Park Ji Sung|Ali Karimi|Mehdi Mahdavikia|Luis Figo|Deco|Patrick Vieira|Claude Makelele|Xabi Alonso|Raul Gonzalez|Fernando Hierro|David Trezeguet|Koke|Xabi Alonso|Marek Hamsik|Robert Lewandowski|Edin Dzeko|Miralem Pjanic|Keylor Navas|Javier Hernandez|Andres Guardado|Bryan Ruiz|George Weah|Roger Milla|Jay Jay Okocha|Nwankwo Kanu|Emmanuel Adebayor|John Obi Mikel|Kolo Toure|Salomon Kalou|Marek Hamsik|Pavel Nedved|Tomas Rosicky|Shunsuke Nakamura|Yuto Nagatomo|Makoto Hasebe|Shinji Okazaki|Lukas Podolski|Claudio Marchisio|Antonio Di Natale|Gabriel Batistuta|Carlos Tevez|Juan Roman Riquelme|Hernan Crespo|Cuauhtemoc Blanco|Giovani Dos Santos|Gervinho|Sofiane Feghouli|Yacine Brahimi|Sami Khedira|Nemanja Vidic|Branislav Ivanovic|Darijo Srna|Dejan Stankovic|Goran Pandev
`.split("|").map(normalise));

export function assignRosterRarities(rosters,publicData){
  const metadata=new Map((publicData?.teams||[]).map(team=>[team.id,team]));
  const appearances=new Map();
  for(const squad of rosters?.teams||[]){
    const year=metadata.get(squad.id)?.year;
    for(const player of squad.players||[]){
      const key=normalise(player.name);
      if(!appearances.has(key))appearances.set(key,new Set());
      appearances.get(key).add(year);
    }
  }

  const exceptional=[];
  for(const squad of rosters?.teams||[]){
    const difficulty=metadata.get(squad.id)?.teamDifficulty||"niche";
    const players=squad.players||[];
    const keepers=players.filter(player=>String(player.position||"").toUpperCase()==="GK")
      .sort((a,b)=>(Number(a.number)||99)-(Number(b.number)||99));
    const thirdKeepers=new Set(keepers.slice(2).map(player=>normalise(player.name)));

    for(const [index,player] of players.entries()){
      const key=normalise(player.name);
      const number=Number(player.number)||index+1;
      const appearancesCount=appearances.get(key)?.size||0;
      const recognised=COMMON_NAMES.has(key)||appearancesCount>=3;
      const repeat=appearancesCount>=2;
      const thirdKeeper=thirdKeepers.has(key);

      if(recognised){player.rarity="Common";continue;}
      if(difficulty==="common"){
        player.rarity=number>=22?"Rare":"Common";
        continue;
      }
      if(difficulty==="niche"){
        player.rarity=repeat?"Rare":number>=20?"Niche":"Rare";
        continue;
      }

      player.rarity=repeat?"Rare":"Niche";
      if(difficulty==="legendary")exceptional.push({
        player,teamId:squad.id,
        score:(thirdKeeper?100:0)+number*2+(appearancesCount===0?10:0)
      });
    }
  }

  const bestPerTeam=new Map();
  exceptional.sort((a,b)=>b.score-a.score||a.teamId.localeCompare(b.teamId))
    .forEach(candidate=>{if(!bestPerTeam.has(candidate.teamId))bestPerTeam.set(candidate.teamId,candidate);});
  const elite=[...bestPerTeam.values()].sort((a,b)=>b.score-a.score||a.teamId.localeCompare(b.teamId));
  elite.slice(0,4).forEach(({player})=>{player.rarity="Ball Knowledge";});
  elite.slice(4,14).forEach(({player})=>{player.rarity="Legendary";});
  return rosters;
}
