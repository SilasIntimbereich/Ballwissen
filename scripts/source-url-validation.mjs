const MULTI_LABEL_PUBLIC_SUFFIXES=new Set([
  "ac.uk","co.uk","gov.uk","ltd.uk","me.uk","net.uk","org.uk","plc.uk",
  "com.au","net.au","org.au","edu.au","gov.au",
  "co.nz","net.nz","org.nz","ac.nz","govt.nz",
  "co.jp","ne.jp","or.jp","ac.jp","go.jp",
  "com.br","net.br","org.br","com.mx","com.sg","com.hk","com.tw",
  "com.cn","net.cn","org.cn","com.tr","com.ar","com.pl","com.ua",
  "co.za","org.za","co.in","firm.in","net.in","org.in"
]);

const PUBLISHER_ALIASES=new Map([
  ["fifa.com","fifa"],
  ["fifa.org","fifa"],
  ["fifadata.com","fifa"]
]);

function registrableDomain(hostname){
  const labels=hostname.toLowerCase().replace(/^www\./i,"").split(".").filter(Boolean);
  if(labels.length<2)return null;
  const suffix=labels.slice(-2).join(".");
  const suffixLength=MULTI_LABEL_PUBLIC_SUFFIXES.has(suffix)?2:1;
  if(labels.length<=suffixLength)return null;
  return labels.slice(-(suffixLength+1)).join(".");
}

function archivedOriginalHost(url){
  if(!/(^|\.)web\.archive\.org$/i.test(url.hostname))return null;
  const match=url.pathname.match(/^\/web\/\d+(?:[a-z_]+)?\/(https?):\/\/([^/]+)/i);
  if(!match)return null;
  try{return new URL(match[1]+"://"+match[2]).hostname.toLowerCase();}catch{return null;}
}

export function normalizeHttpsHost(value){
  try{
    const url=new URL(value);
    if(url.protocol!=="https:"||!url.hostname)return null;
    const original=archivedOriginalHost(url);
    const domain=registrableDomain(original||url.hostname);
    if(!domain)return null;
    return PUBLISHER_ALIASES.get(domain)||domain;
  }catch{
    return null;
  }
}

export function isHttpsUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&Boolean(url.hostname);
  }catch{
    return false;
  }
}

export function hasIndependentHttpsSources(values){
  if(!Array.isArray(values)||values.length<2)return false;
  const publishers=values.map(normalizeHttpsHost);
  return publishers.every(Boolean)&&new Set(publishers).size>=2;
}
