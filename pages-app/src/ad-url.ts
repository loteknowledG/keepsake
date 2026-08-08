export function isAdStorageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^keepseek:\/\/ad\/\d+$/i.test(trimmed)) return true;
  if (/^https?:\/\/keepseek(?::\/\/|\/+\/)ad\/\d+$/i.test(trimmed)) return true;
  return false;
}

export function adStorageUrl(id: number): string {
  return `keepseek://ad/${id}`;
}

export function adDestinationUrl(url: string): string {
  if (isAdStorageUrl(url)) return "";
  const trimmed = url.trim();
  if (/^keepseek:/i.test(trimmed)) return "";
  return trimmed;
}

export function adPersistUrl(id: number, destination: string): string {
  const trimmed = destination.trim();
  if (!trimmed || isAdStorageUrl(trimmed) || /^keepseek:/i.test(trimmed)) {
    return adStorageUrl(id);
  }
  return trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
}

export function adExternalLinkUrl(url: string): string | null {
  const destination = adDestinationUrl(url);
  if (!destination) return null;
  try {
    const normalized = destination.match(/^https?:\/\//) ? destination : `https://${destination}`;
    const parsed = new URL(normalized);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function adDomainFromDestination(destination: string): string {
  const trimmed = destination.trim();
  if (!trimmed) return "Ad";
  try {
    const normalized = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "Ad";
  }
}
