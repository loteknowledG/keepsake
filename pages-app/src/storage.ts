import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Bookmark } from "./Page";
import { adDestinationUrl, adDomainFromDestination, adPersistUrl } from "./ad-url";
import { backupKeepsakeData, loadKeepsakeBackup } from "./keepseek-backup";

export { backupKeepsakeData, loadKeepsakeBackup };

function parseImages(value: unknown): string[] | undefined {
  if (!value || typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function repairAdBookmark(bookmark: Bookmark): Bookmark {
  if (bookmark.kind !== "ad") return bookmark;
  const destination = adDestinationUrl(bookmark.url);
  return {
    ...bookmark,
    url: adPersistUrl(bookmark.id, destination),
    domain: adDomainFromDestination(destination),
  };
}

function prepareBookmarksForStorage(bookmarks: Bookmark[]): Bookmark[] {
  return bookmarks.map(repairAdBookmark);
}

function serializeImages(images: string[] | undefined): string | null {
  return images?.length ? JSON.stringify(images) : null;
}

export function flushKeepsakeData(): Promise<void> {
  return writeQueue;
}

export type StorageMode = "opfs" | "indexeddb";
type KeepsakeData = { bookmarks: Bookmark[]; collections: string[]; mode: StorageMode };

const IDB_NAME = "keepsake-sqlite";
const STORE_NAME = "database";
const DATABASE_KEY = "keepsake.db";

let fallbackDatabase: Database | null = null;
let storageMode: StorageMode = "indexeddb";
let sqliteEnabled = true;
let writeQueue: Promise<void> = Promise.resolve();
let requestId = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>();

const worker = new Worker(new URL("./sqlite-worker.ts", import.meta.url), { type: "module" });
worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
  const callback = pending.get(event.data.id);
  if (!callback) return;
  pending.delete(event.data.id);
  if (event.data.ok) callback.resolve(event.data.result);
  else callback.reject(new Error(event.data.error ?? "SQLite worker failed"));
};
worker.onerror = () => {
  for (const [id, callback] of pending.entries()) {
    callback.reject(new Error("SQLite worker crashed"));
    pending.delete(id);
  }
};

function callWorker<T>(type: "init" | "save", payload?: unknown, timeoutMs = type === "init" ? 8_000 : 20_000): Promise<T> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`SQLite worker timed out during ${type}`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value as T);
      },
      reject: (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    });
    worker.postMessage({ id, type, payload });
  });
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDatabaseBytes(): Promise<Uint8Array | null> {
  const idb = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const request = idb.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DATABASE_KEY);
    request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}

async function writeDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(bytes, DATABASE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function rows<T>(result: ReturnType<Database["exec"]>): T[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((value) => Object.fromEntries(columns.map((column, index) => [column, value[index]])) as T);
}

async function openIndexedDbFallback(): Promise<KeepsakeData> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await readDatabaseBytes();
  fallbackDatabase = bytes ? new SQL.Database(bytes) : new SQL.Database();
  fallbackDatabase.run(`
    CREATE TABLE IF NOT EXISTS collections (name TEXT PRIMARY KEY, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, title TEXT NOT NULL,
      note TEXT NOT NULL, collection TEXT NOT NULL, palette TEXT NOT NULL, mark TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0, image TEXT, kind TEXT NOT NULL DEFAULT 'bookmark'
    );
  `);
  try {
    fallbackDatabase.run("ALTER TABLE bookmarks ADD COLUMN kind TEXT NOT NULL DEFAULT 'bookmark'");
  } catch {
    // Column already exists.
  }
  try {
    fallbackDatabase.run("ALTER TABLE bookmarks ADD COLUMN images TEXT");
  } catch {
    // Column already exists.
  }
  return loadFallbackData();
}

function loadFallbackData(): KeepsakeData {
  if (!fallbackDatabase) return { bookmarks: [], collections: [], mode: "indexeddb" };
  const bookmarks = rows<Record<string, string | number | null>>(fallbackDatabase.exec("SELECT * FROM bookmarks ORDER BY id"))
    .map((row) => ({
      id: Number(row.id), url: String(row.url), domain: String(row.domain), title: String(row.title),
      note: String(row.note), collection: String(row.collection), palette: String(row.palette), mark: String(row.mark),
      kind: String(row.kind ?? ""),
      favorite: Boolean(row.favorite), image: row.image ? String(row.image) : undefined,
      images: parseImages(row.images),
    }))
    .map((row) => ({
      ...row,
      kind: row.kind === "bookmark" || row.kind === "playlist" || row.kind === "ad"
        ? row.kind
        : row.collection === "Playlists"
          ? "playlist"
          : row.collection === "Ads"
            ? "ad"
            : "bookmark",
    }))
    .map((row) => repairAdBookmark(row as Bookmark));
  const collections = rows<{ name: string }>(fallbackDatabase.exec("SELECT name FROM collections ORDER BY position")).map((row) => row.name);
  return { bookmarks, collections, mode: "indexeddb" };
}

export async function openKeepsakeDatabase(): Promise<KeepsakeData> {
  try {
    const data = await callWorker<Omit<KeepsakeData, "mode">>("init");
    storageMode = "opfs";
    return { ...data, mode: "opfs" };
  } catch (error) {
    console.warn("OPFS unavailable; using the IndexedDB SQLite fallback.", error);
    storageMode = "indexeddb";
    try {
      return await openIndexedDbFallback();
    } catch (fallbackError) {
      sqliteEnabled = false;
      console.warn("SQLite unavailable; using local backup only.", fallbackError);
      const backup = loadKeepsakeBackup();
      return {
        bookmarks: backup?.bookmarks ?? [],
        collections: backup?.collections ?? [],
        mode: "indexeddb" as const,
      };
    }
  }
}

export function saveKeepsakeData(bookmarks: Bookmark[], collections: string[]): Promise<void> {
  const normalizedBookmarks = prepareBookmarksForStorage(bookmarks);
  backupKeepsakeData(normalizedBookmarks, collections);
  if (!sqliteEnabled) return Promise.resolve();
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    if (storageMode === "opfs") {
      await callWorker("save", { bookmarks: normalizedBookmarks, collections });
      return;
    }
    if (!fallbackDatabase) return;
    fallbackDatabase.run("BEGIN");
    try {
      fallbackDatabase.run("DELETE FROM bookmarks");
      fallbackDatabase.run("DELETE FROM collections");
      collections.forEach((name, position) => fallbackDatabase!.run("INSERT INTO collections(name, position) VALUES (?, ?)", [name, position]));
      normalizedBookmarks.forEach((item) => fallbackDatabase!.run(
        "INSERT INTO bookmarks(id,url,domain,title,note,collection,palette,mark,favorite,image,images,kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [item.id, item.url, item.domain, item.title, item.note, item.collection, item.palette, item.mark, item.favorite ? 1 : 0, item.image ?? null, serializeImages(item.images), item.kind],
      ));
      fallbackDatabase.run("COMMIT");
      await writeDatabaseBytes(fallbackDatabase.export());
    } catch (error) {
      fallbackDatabase.run("ROLLBACK");
      throw error;
    }
  });
  return writeQueue;
}
