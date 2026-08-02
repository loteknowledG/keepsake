import { zipSync, type Zippable } from "fflate";
import type { Bookmark } from "./page";

export const LOAD_MEDIA_TYPE = "application/vnd.keepseek.muthurload+zip";
export const MUTHUR_RENDERER_URL = "https://muthur-tawny.vercel.app/";
const encoder = new TextEncoder();
const MAX_EMBEDDED_LINK_BYTES = 128 * 1024;

type LoadObject = { path: string; mediaType: string; bytes: number; sha256: string };

function jsonBytes(value: unknown) {
  return encoder.encode(JSON.stringify(value, null, 2));
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeName(value: string) {
  return value.toLowerCase().replace(/\.md$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "keepseek";
}

function portableSourceUrl(url: string) {
  const github = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  return github ? `https://raw.githubusercontent.com/${github[1]}/${github[2]}/${github[3]}/${github[4]}` : url;
}

async function fetchPortableContent(bookmark: Bookmark) {
  const looksPortable = /\.md(?:$|[?#])/i.test(bookmark.url) || /github\.com\/.+\/blob\//i.test(bookmark.url);
  if (!looksPortable) return null;
  try {
    const response = await fetch(portableSourceUrl(bookmark.url), { headers: { Accept: "text/markdown,text/plain;q=0.9" } });
    if (!response.ok) return null;
    return { bytes: encoder.encode(await response.text()), mediaType: "text/markdown; charset=utf-8", path: `content/${safeName(bookmark.title)}.md` };
  } catch { return null; }
}

export async function createLoad(bookmark: Bookmark) {
  const capturedAt = new Date().toISOString();
  const scrapPath = "scraps/scrap.json";
  const scrapBytes = jsonBytes({ type: "keepseek.scrap", version: 1, provenance: { sourceUrl: bookmark.url, capturedAt }, bookmark });
  const entries: Zippable = { [scrapPath]: [scrapBytes, { level: 6 }] };
  const objects: LoadObject[] = [{ path: scrapPath, mediaType: "application/json", bytes: scrapBytes.length, sha256: await sha256(scrapBytes) }];
  const content = await fetchPortableContent(bookmark);
  if (content) {
    entries[content.path] = [content.bytes, { level: 6 }];
    objects.push({ path: content.path, mediaType: content.mediaType, bytes: content.bytes.length, sha256: await sha256(content.bytes) });
  }
  objects.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const rootHash = await sha256(jsonBytes(objects.map(({ path, sha256: hash }) => ({ path, sha256: hash }))));
  entries["indexes/root.json"] = [jsonBytes({ format: "muthurload-index", version: "0.1", rootHash, objects }), { level: 6 }];
  entries["manifest.json"] = [jsonBytes({
    format: "muthurload", version: "0.1", mediaType: LOAD_MEDIA_TYPE, createdAt: capturedAt, createdBy: "keepseek",
    compression: { container: "zip", method: "deflate", level: 6 }, hashing: { algorithm: "sha-256", root: rootHash }, entrypoint: "indexes/root.json",
  }), { level: 6 }];
  const archive = zipSync(entries, { level: 6 });
  const fileName = `${safeName(bookmark.title)}.muthur.load`;
  return { fileName, file: new File([archive as BlobPart], fileName, { type: LOAD_MEDIA_TYPE }) };
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createMuthurLink(bookmark: Bookmark, rendererUrl = MUTHUR_RENDERER_URL) {
  const created = await createLoad(bookmark);
  const bytes = new Uint8Array(await created.file.arrayBuffer());
  if (bytes.length > MAX_EMBEDDED_LINK_BYTES) throw new Error("This Load is too large for an embedded MUTHUR Link. Download and send the .muthur.load file instead.");
  const url = new URL(rendererUrl);
  url.hash = `load=${base64url(bytes)}&name=${encodeURIComponent(created.fileName)}`;
  return { ...created, url: url.toString(), bytes: bytes.length };
}

