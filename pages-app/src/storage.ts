import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Bookmark } from "./Page";

const IDB_NAME = "keepsake-sqlite";
const STORE_NAME = "database";
const DATABASE_KEY = "keepsake.db";

let database: Database | null = null;
let writeQueue: Promise<void> = Promise.resolve();

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

export async function openKeepsakeDatabase() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await readDatabaseBytes();
  database = bytes ? new SQL.Database(bytes) : new SQL.Database();
  database.run(`
    CREATE TABLE IF NOT EXISTS collections (
      name TEXT PRIMARY KEY,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL,
      collection TEXT NOT NULL,
      palette TEXT NOT NULL,
      mark TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0,
      image TEXT
    );
  `);
  return loadKeepsakeData();
}

export function loadKeepsakeData(): { bookmarks: Bookmark[]; collections: string[] } {
  if (!database) return { bookmarks: [], collections: [] };
  const bookmarks = rows<Record<string, string | number | null>>(database.exec("SELECT * FROM bookmarks ORDER BY id"))
    .map((row) => ({
      id: Number(row.id), url: String(row.url), domain: String(row.domain), title: String(row.title),
      note: String(row.note), collection: String(row.collection), palette: String(row.palette), mark: String(row.mark),
      favorite: Boolean(row.favorite), image: row.image ? String(row.image) : undefined,
    }));
  const collections = rows<{ name: string }>(database.exec("SELECT name FROM collections ORDER BY position")).map((row) => row.name);
  return { bookmarks, collections };
}

export function saveKeepsakeData(bookmarks: Bookmark[], collections: string[]): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    if (!database) return;
    database.run("BEGIN");
    try {
      database.run("DELETE FROM bookmarks");
      database.run("DELETE FROM collections");
      collections.forEach((name, position) => database!.run("INSERT INTO collections(name, position) VALUES (?, ?)", [name, position]));
      bookmarks.forEach((item) => database!.run(
        "INSERT INTO bookmarks(id,url,domain,title,note,collection,palette,mark,favorite,image) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [item.id, item.url, item.domain, item.title, item.note, item.collection, item.palette, item.mark, item.favorite ? 1 : 0, item.image ?? null],
      ));
      database.run("COMMIT");
      await writeDatabaseBytes(database.export());
    } catch (error) {
      database.run("ROLLBACK");
      throw error;
    }
  });
  return writeQueue;
}
