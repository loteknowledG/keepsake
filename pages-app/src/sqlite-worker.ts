/// <reference lib="webworker" />

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { Bookmark } from "./Page";

type WorkerRequest = { id: number; type: "init" | "save"; payload?: { bookmarks: Bookmark[]; collections: string[] } };
type SqliteDatabase = {
  exec: (options: string | { sql: string; bind?: unknown[]; rowMode?: string; returnValue?: string }) => unknown;
  transaction: (callback: (database: SqliteDatabase) => void) => void;
};

let database: SqliteDatabase | null = null;

function query<T>(sql: string): T[] {
  if (!database) return [];
  return database.exec({ sql, rowMode: "object", returnValue: "resultRows" }) as T[];
}

function loadData() {
  const bookmarks = query<Record<string, string | number | null>>("SELECT * FROM bookmarks ORDER BY id").map((row) => ({
    id: Number(row.id), url: String(row.url), domain: String(row.domain), title: String(row.title),
    note: String(row.note), collection: String(row.collection), palette: String(row.palette), mark: String(row.mark),
    favorite: Boolean(row.favorite), image: row.image ? String(row.image) : undefined,
  }));
  const collections = query<{ name: string }>("SELECT name FROM collections ORDER BY position").map((row) => row.name);
  return { bookmarks, collections };
}

async function initialize() {
  const sqlite3 = await sqlite3InitModule();
  if (!sqlite3.oo1.OpfsDb) throw new Error("This browser does not provide SQLite OPFS support.");
  database = new sqlite3.oo1.OpfsDb("/keepseek.sqlite3", "c") as unknown as SqliteDatabase;
  database.exec(`
    CREATE TABLE IF NOT EXISTS collections (name TEXT PRIMARY KEY, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, title TEXT NOT NULL,
      note TEXT NOT NULL, collection TEXT NOT NULL, palette TEXT NOT NULL, mark TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0, image TEXT
    );
  `);
  return loadData();
}

function save(payload: { bookmarks: Bookmark[]; collections: string[] }) {
  if (!database) throw new Error("SQLite OPFS is not initialized.");
  database.transaction((db) => {
    db.exec("DELETE FROM bookmarks");
    db.exec("DELETE FROM collections");
    payload.collections.forEach((name, position) => db.exec({ sql: "INSERT INTO collections(name, position) VALUES (?, ?)", bind: [name, position] }));
    payload.bookmarks.forEach((item) => db.exec({
      sql: "INSERT INTO bookmarks(id,url,domain,title,note,collection,palette,mark,favorite,image) VALUES (?,?,?,?,?,?,?,?,?,?)",
      bind: [item.id, item.url, item.domain, item.title, item.note, item.collection, item.palette, item.mark, item.favorite ? 1 : 0, item.image ?? null],
    }));
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;
  try {
    const result = type === "init" ? await initialize() : save(payload!);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
