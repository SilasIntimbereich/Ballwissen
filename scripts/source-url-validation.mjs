export function normalizeHttpsHost(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname) return null;
    return url.hostname.toLowerCase().replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export function isHttpsUrl(value) {
  return normalizeHttpsHost(value) !== null;
}

export function hasIndependentHttpsSources(values) {
  if (!Array.isArray(values) || values.length < 2) return false;
  const hosts = values.map(normalizeHttpsHost);
  return hosts.every(Boolean) && new Set(hosts).size >= 2;
}
