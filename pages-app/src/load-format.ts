import { unzipSync, zipSync, type Zippable } from "fflate";
import type { Bookmark } from "./Page";

export const LOAD_MEDIA_TYPE = "application/vnd.keepseek.muthurload+zip";
export const MUTHUR_RENDERER_URL = "https://muthur-tawny.vercel.app/";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_EXPANDED_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_BYTES = 10 * 1024 * 1024;
export const MAX_EMBEDDED_LINK_BYTES = 128 * 1024;

type LoadObject = {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
};

export type LoadManifest = {
  format: "muthurload";
  version: "0.1";
  mediaType: typeof LOAD_MEDIA_TYPE;
  createdAt: string;
  createdBy: "keepseek";
  compression: { container: "zip"; method: "deflate"; level: 6 };
  hashing: { algorithm: "sha-256"; root: string };
  entrypoint: "indexes/root.json";
};

export type OpenedLoad = {
  manifest: LoadManifest;
  bookmark: Bookmark;
  content?: string;
  contentMediaType?: string;
  fileName: string;
};

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
  if (github) return `https://raw.githubusercontent.com/${github[1]}/${github[2]}/${github[3]}/${github[4]}`;
  return url;
}

async function fetchPortableContent(bookmark: Bookmark): Promise<{ bytes: Uint8Array; mediaType: string; path: string } | null> {
  const looksPortable = /\.md(?:$|[?#])/i.test(bookmark.url) || /github\.com\/.+\/blob\//i.test(bookmark.url);
  if (!looksPortable) return null;
  try {
    const response = await fetch(portableSourceUrl(bookmark.url), { headers: { Accept: "text/markdown,text/plain;q=0.9" } });
    if (!response.ok) return null;
    const text = await response.text();
    return { bytes: encoder.encode(text), mediaType: "text/markdown; charset=utf-8", path: `content/${safeName(bookmark.title)}.md` };
  } catch {
    return null;
  }
}

export async function createLoad(bookmark: Bookmark) {
  const scrapPath = "scraps/scrap.json";
  const scrapBytes = jsonBytes({
    type: "keepseek.scrap",
    version: 1,
    provenance: { sourceUrl: bookmark.url, capturedAt: new Date().toISOString() },
    bookmark,
  });
  const entries: Zippable = {};
  const objects: LoadObject[] = [{ path: scrapPath, mediaType: "application/json", bytes: scrapBytes.length, sha256: await sha256(scrapBytes) }];
  entries[scrapPath] = [scrapBytes, { level: 6 }];

  const content = await fetchPortableContent(bookmark);
  if (content) {
    objects.push({ path: content.path, mediaType: content.mediaType, bytes: content.bytes.length, sha256: await sha256(content.bytes) });
    entries[content.path] = [content.bytes, { level: 6 }];
  }

  objects.sort((left, right) => left.path.localeCompare(right.path));
  const rootHash = await sha256(jsonBytes(objects.map(({ path, sha256: hash }) => ({ path, sha256: hash }))));
  const rootIndex = { format: "muthurload-index", version: "0.1", rootHash, objects };
  const manifest: LoadManifest = {
    format: "muthurload",
    version: "0.1",
    mediaType: LOAD_MEDIA_TYPE,
    createdAt: new Date().toISOString(),
    createdBy: "keepseek",
    compression: { container: "zip", method: "deflate", level: 6 },
    hashing: { algorithm: "sha-256", root: rootHash },
    entrypoint: "indexes/root.json",
  };
  entries["indexes/root.json"] = [jsonBytes(rootIndex), { level: 6 }];
  entries["manifest.json"] = [jsonBytes(manifest), { level: 6 }];

  const archive = zipSync(entries, { level: 6 });
  const fileName = `${safeName(bookmark.title)}.muthur.load`;
  return { fileName, manifest, file: new File([archive as BlobPart], fileName, { type: LOAD_MEDIA_TYPE }) };
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function buildKeepseekOpenLink(options: {
  origin: string;
  fileName: string;
  embeddedBytes?: Uint8Array;
  rootHash?: string;
}) {
  const url = new URL(options.origin.endsWith("/") ? options.origin : `${options.origin}/`);
  if (options.embeddedBytes) {
    url.hash = `load=${base64url(options.embeddedBytes)}&name=${encodeURIComponent(options.fileName)}`;
    return url.toString();
  }
  if (options.rootHash) {
    url.hash = `await-load=1&name=${encodeURIComponent(options.fileName)}&root=${options.rootHash}`;
    return url.toString();
  }
  throw new Error("Keepseek needs embedded bytes or a root hash to build an open link.");
}

export async function openLoadFromBytes(bytes: Uint8Array, fileName: string) {
  return openLoad(new File([bytes as BlobPart], fileName, { type: LOAD_MEDIA_TYPE }));
}

export async function fetchLoadFromUrl(sourceUrl: string, fileName: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("Could not fetch the shared Load.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  return openLoadFromBytes(bytes, fileName);
}

export function parseKeepseekLoadLocation(location: Pick<Location, "hash" | "search">) {
  const hashParams = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);
  const embedded = hashParams.get("load");
  const hashName = hashParams.get("name");
  if (embedded) {
    return { kind: "embedded" as const, bytes: base64urlDecode(embedded), fileName: hashName ?? "shared.muthur.load" };
  }
  if (hashParams.has("await-load")) {
    const rootHash = hashParams.get("root");
    if (!rootHash) return null;
    return {
      kind: "companion" as const,
      fileName: hashName ?? "shared.muthur.load",
      rootHash,
    };
  }
  const params = new URLSearchParams(location.search);
  const remote = params.get("load");
  const remoteName = params.get("name");
  if (remote && /^https?:\/\//i.test(remote)) {
    return { kind: "remote" as const, url: remote, fileName: remoteName ?? "shared.muthur.load" };
  }
  return null;
}

export async function createMuthurLink(bookmark: Bookmark, rendererUrl = MUTHUR_RENDERER_URL) {
  const created = await createLoad(bookmark);
  const bytes = new Uint8Array(await created.file.arrayBuffer());
  if (bytes.length > MAX_EMBEDDED_LINK_BYTES) {
    throw new Error("This Load is too large for an embedded MUTHUR Link. Use Load + link instead.");
  }
  const url = new URL(rendererUrl);
  url.hash = `load=${base64url(bytes)}&name=${encodeURIComponent(created.fileName)}`;
  return { ...created, url: url.toString(), bytes: bytes.length };
}

export async function createKeepseekLoadBundleLink(bookmark: Bookmark, origin = typeof window === "undefined" ? "https://keepseek-app.vercel.app" : window.location.origin) {
  const created = await createLoad(bookmark);
  const bytes = new Uint8Array(await created.file.arrayBuffer());
  if (bytes.length <= MAX_EMBEDDED_LINK_BYTES) {
    return {
      ...created,
      bytes: bytes.length,
      linkKind: "embedded" as const,
      openLink: buildKeepseekOpenLink({ origin, fileName: created.fileName, embeddedBytes: bytes }),
    };
  }
  return {
    ...created,
    bytes: bytes.length,
    linkKind: "companion" as const,
    openLink: buildKeepseekOpenLink({
      origin,
      fileName: created.fileName,
      rootHash: created.manifest.hashing.root,
    }),
  };
}

export async function shareLoadBundleNatively(bundle: { file: File; openLink: string; fileName: string }) {
  if (!navigator.share) return false;
  const payload: ShareData & { files?: File[] } = {
    files: [bundle.file],
    title: bundle.fileName,
    text: `Open in Keepseek: ${bundle.openLink}`,
  };
  if (navigator.canShare && !navigator.canShare(payload)) return false;
  await navigator.share(payload);
  return true;
}

function assertSafeEntries(entries: Record<string, Uint8Array>) {
  let expanded = 0;
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) throw new Error("Load contains an unsafe path.");
    if (bytes.length > MAX_ENTRY_BYTES) throw new Error("A Load entry is too large.");
    expanded += bytes.length;
  }
  if (expanded > MAX_EXPANDED_BYTES) throw new Error("Load expands beyond the v0.1 safety limit.");
}

export async function openLoad(file: File): Promise<OpenedLoad> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  assertSafeEntries(entries);
  if (!entries["manifest.json"] || !entries["indexes/root.json"] || !entries["scraps/scrap.json"]) throw new Error("Required Load entries are missing.");

  const manifest = JSON.parse(decoder.decode(entries["manifest.json"])) as LoadManifest;
  if (manifest.format !== "muthurload" || manifest.version !== "0.1" || manifest.entrypoint !== "indexes/root.json") throw new Error("Unsupported MUTHURLOAD format.");
  const rootIndex = JSON.parse(decoder.decode(entries[manifest.entrypoint])) as { rootHash: string; objects: LoadObject[] };
  if (!Array.isArray(rootIndex.objects)) throw new Error("Load index is invalid.");

  for (const object of rootIndex.objects) {
    const bytes = entries[object.path];
    if (!bytes || bytes.length !== object.bytes || await sha256(bytes) !== object.sha256) throw new Error(`Load integrity check failed for ${object.path}.`);
  }
  const expectedRoot = await sha256(jsonBytes([...rootIndex.objects].sort((a, b) => a.path.localeCompare(b.path)).map(({ path, sha256: hash }) => ({ path, sha256: hash }))));
  if (expectedRoot !== rootIndex.rootHash || expectedRoot !== manifest.hashing.root) throw new Error("Load root hash does not match its contents.");

  const scrap = JSON.parse(decoder.decode(entries["scraps/scrap.json"])) as { type: string; bookmark: Bookmark };
  if (scrap.type !== "keepseek.scrap" || !scrap.bookmark?.url || !scrap.bookmark?.title) throw new Error("Load does not contain a valid Keepseek scrap.");
  const contentObject = rootIndex.objects.find((object) => object.path.startsWith("content/"));
  return {
    manifest,
    bookmark: scrap.bookmark,
    content: contentObject ? decoder.decode(entries[contentObject.path]) : undefined,
    contentMediaType: contentObject?.mediaType,
    fileName: file.name,
  };
}
