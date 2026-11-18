const normalize = value => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const teamAliases = {
  chinapr: "china",
  korearepublic: "southkorea",
  korea: "southkorea",
  usa: "unitedstates",
  ireland: "republicofireland"
};

function plainText(value) {
  return String(value || "")
    .replace(/<sup\b[^>]*>\s*(?:<a\b[^>]*>)?\[\d+\](?:<\/a>)?\s*<\/sup>/gi, "")
    .replace(/<span\b[^>]*class=["'][^"']*flagicon[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\[\d+\]$/g, "")
    .replace(/\s*\(c\)$/i, "")
    .replace(/\s*\[edit\]$/i, "")
    .trim();
}

export function parseWikipediaSquads(html, teams) {
  const expected = new Map(teams.map(team => [normalize(team.name), team]));
  // Wikipedia squad pages nest country headings (usually h4) under group headings (h3).
  // End a country's section at the next heading of the same or higher level.
  const sections = [...String(html).matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(match => ({ level: Number(match[1]), html: match[2], index: match.index, length: match[0].length }));
  const parsed = new Map();

  for (let i = 0; i < sections.length; i++) {
    const heading = plainText(sections[i].html);
    const key = normalize(heading);
    const team = expected.get(teamAliases[key] || key);
    if (!team) continue;

    const start = sections[i].index + sections[i].length;
    const nextBoundary = sections.slice(i + 1).find(section => section.level <= sections[i].level);
    const end = nextBoundary?.index ?? html.length;
    const section = html.slice(start, end);
    const table = section.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)?.[1];
    if (!table) {
      parsed.set(team.id, []);
      continue;
    }

    const rows = [];
    for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...match[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
        .map(cell => plainText(cell[1]));
      if (cells.length < 6 || !/^\d{1,2}$/.test(cells[0])) continue;
      const position = cells[1].match(/(GK|DF|MF|FW)/i)?.[1]?.toUpperCase() || null;
      const name = cells[2].replace(/\s*\(c\)$/i, "").trim();
      const club = cells[cells.length - 1].trim();
      if (!name) continue;
      rows.push({ number: Number(cells[0]), position, name, club });
    }
    parsed.set(team.id, rows);
  }

  return parsed;
}

export function normalizeHistoricalClub(value) {
  // Strip club abbreviations only as separate leading/trailing tokens.
  // A blind "as" prefix removal, for example, corrupts the real club Ascoli.
  const raw = String(value || "")
    .replace(/\s*\([A-Z]{3}\)\s*$/i, "")
    .trim()
    .replace(/^(?:AFC|FC|CF|AC|SC|AS|SS|US|CD|RC|RSC|BSC|VfL|SV|FK|NK|HNK|UC|UD|SD|TSG|OGC|KV|KAS|1\.?\s*FC|SL|SSC|VfB|USC)\s+/i, "")
    .replace(/\s+(?:FC|CF|SC|AFC|SFC|IF|BK|JK|VV|Calcio|HSC|OSC|SCO)$/i, "");
  const key = normalize(raw);
  const aliases = {
    bayernmunchen: "bayernmunich",
    bayer04leverkusen: "bayerleverkusen",
    intermilano: "internazionale",
    intermilan: "internazionale",
    schalke04: "schalke",
    herthabsc: "herthaberlin",
    herthabscberlin: "herthaberlin",
    mgladbach: "monchengladbach",
    hamburgersv: "hamburg",
    celtavigo: "celtadevigo",
    chonbukhyundai: "jeonbukhyundai",
    jeonbukhyundaimotors: "jeonbukhyundai",
    chunnamdragons: "jeonnamdragons",
    chonnamdragons: "jeonnamdragons",
    pusanicons: "busanipark",
    busanipark: "busanipark",
    suwonbluewings: "suwonsamsungbluewings",
    taejoncitizen: "daejeoncitizen",
    anyang: "anyanglgcheetahs",
    kyotopurplesanga: "kyotosanga",
    jefutdichihara: "jefunitedichihara",
    atleticodemadrid: "atleticomadrid",
    glasgowceltic: "celtic",
    glasgowrangers: "rangers",
    psveindhoven: "psv",
    inter: "internazionale",
    psg: "parissaintgermain",
    alhilal: "hilal",
    alhelal: "hilal",
    alnasser: "nassr",
    alnassr: "nassr",
    alahli: "ahli",
    alittihad: "ittihad",
    alshabab: "shabab",
    alwehdah: "wehda",
    alwehda: "wehda",
    parisstgermain: "parissaintgermain",
    girondinsbordeaux: "bordeaux",
    olympiquelyon: "lyon",
    olympiquemarseille: "marseille",
    athleticclub: "athleticbilbao",
    sportingcp: "sportinglisbon",
    deportivoalaves: "alaves",
    realzaragoza: "zaragoza",
    realbetis: "betis",
    realvalladolid: "valladolid",
    realmallorca: "mallorca",
    borussiadortmund: "dortmund",
    borussiamgladbach: "monchengladbach",
    borussiamonchengladbach: "monchengladbach",
    bmonchengladbach: "monchengladbach",
    fckoln: "cologne",
    koln: "cologne",
    manchesterutd: "manchesterunited",
    mancity: "manchestercity",
    azalkmaar: "az",
    fsvmainz05: "mainz05",
    chivas: "guadalajara",
    deportivosaprissa: "saprissa",
    alahlycairo: "alahly",
    nagoyagrampuseight: "nagoyagrampus",
    westbromwicha: "westbromwichalbion",
    urawareds: "urawareddiamonds",
    jeonbukmotors: "jeonbukhyundai",
    dynamokiev: "dynamokyiv",
    perspolis: "persepolis",
    aagent: "gent",
    agfaarhus: "agf",
    losangelesgalaxy: "lagalaxy",
    esteghlaltehran: "esteghlal",
    parissg: "parissaintgermain",
    clubleon: "leon",
    deportivotoluca: "toluca",
    tigresuanl: "tigres",
    atleticolon: "colon",
    nuremberg: "nurnberg",
    paokthessaloniki: "paok",
    "1899hoffenheim": "hoffenheim",
    olympiakos: "olympiacos",
    kawazakifrontale: "kawasakifrontale",
    racinggenk: "genk",
    aikstockholm: "aik",
    nyredbulls: "newyorkredbulls",
    olymarseille: "marseille",
    atalantabergamo: "atalanta",
    esperancetunis: "esperance",
    brightonha: "brightonhovealbion",
    kasmpasa: "kasimpasa",
    legiawarsaw: "legiawarszawa",
    legiawarzaw: "legiawarszawa",
    spalferrara: "spal",
    alnasr: "nassr",
    "1fcnuremberg": "nurnberg",
    ulsanhyundaihorangi: "ulsanhyundai",
    busanicons: "busanipark",
    sinttruidense: "sinttruiden",
    alkhalees: "alkhaleej",
    panahaiki: "panachaiki",
    qingdaoetsonghainiu: "qingdaohainiu",
    oficrete: "ofi",
    tsvmunich1860: "1860munich",
    sfklyn: "lyn",
    malmoff: "malmo",
    yokohamamarinos: "yokohamafmarinos",
    fcseville: "sevilla",
    unam: "pumasunam",
    goztepspor: "goztepe",
    realoviedo: "oviedo",
    khouribga: "olympiquekhouribga",
    basle: "basel",
    puchon: "bucheonsk",
    bizerte: "bizertin",
    newyorkmetrostars: "metrostars",
    washingtondcunited: "dcunited"
  };
  return aliases[key] || key;
}
