export function isAdStorageUrl(url: string): boolean {
  return /^keepseek:\/\/ad\/\d+$/i.test(url.trim());
}

export function adStorageUrl(id: number): string {
  return `keepseek://ad/${id}`;
}

export function adDestinationUrl(url: string): string {
  if (isAdStorageUrl(url)) return "";
  return url.trim();
}

export function adPersistUrl(id: number, destination: string): string {
  const trimmed = destination.trim();
  if (!trimmed) return adStorageUrl(id);
  return trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
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
