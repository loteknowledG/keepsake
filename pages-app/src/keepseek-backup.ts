import type { Bookmark } from "./Page";

const BACKUP_KEY = "keepseek-backup";

function stripDataUrl(value?: string): string | undefined {
  return value?.startsWith("data:") ? undefined : value;
}

function slimBookmarkForBackup(bookmark: Bookmark): Bookmark {
  const images = bookmark.images?.map(stripDataUrl).filter((value): value is string => Boolean(value));
  return {
    ...bookmark,
    image: stripDataUrl(bookmark.image),
    images: images?.length ? images : undefined,
  };
}

export function backupKeepsakeData(bookmarks: Bookmark[], collections: string[]): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      bookmarks: bookmarks.map(slimBookmarkForBackup),
      collections,
      savedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("Keepseek local backup failed.", error);
  }
}

export function loadKeepsakeBackup(): { bookmarks: Bookmark[]; collections: string[] } | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { bookmarks?: Bookmark[]; collections?: string[] };
    if (!Array.isArray(data.bookmarks)) return null;
    return {
      bookmarks: data.bookmarks,
      collections: Array.isArray(data.collections) ? data.collections : [],
    };
  } catch {
    return null;
  }
}
