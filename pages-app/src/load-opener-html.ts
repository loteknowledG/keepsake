import type { Bookmark } from "./Page";
import { createLoad } from "./load-format";
import { LOAD_OPENER_CSS, LOAD_OPENER_SCRIPT } from "./generated/load-opener-embedded";
import { shareFilesNatively } from "./native-share";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function openerBaseName(title: string) {
  return title.toLowerCase().replace(/\.md$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "keepseek";
}

export async function createLoadOpenerHtml(bookmark: Bookmark) {
  const created = await createLoad(bookmark);
  const bytes = new Uint8Array(await created.file.arrayBuffer());
  const payload = JSON.stringify({
    fileName: created.fileName,
    load: base64url(bytes),
    root: created.manifest.hashing.root,
  });
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(bookmark.title)} · MUTHUR Package</title>
  <style>${LOAD_OPENER_CSS}</style>
</head>
<body>
  <div id="app"><main><p class="kicker">MUTHUR Package</p><p class="lede">Verifying embedded Load…</p></main></div>
  <script type="application/json" id="muthur-load-payload">${payload}</script>
  <script>${LOAD_OPENER_SCRIPT}</script>
</body>
</html>`;
  const fileName = `${openerBaseName(bookmark.title)}.muthur.package.html`;
  return {
    fileName,
    file: new File([html], fileName, { type: "text/html" }),
    bytes: bytes.length,
    loadFileName: created.fileName,
    packageBytes: html.length,
  };
}

export async function shareLoadOpenerNatively(opener: { file: File; fileName: string }) {
  return shareFilesNatively(
    [opener.file],
    opener.fileName,
    "Open this self-contained HTML package in your browser to view the shared Keepseek Load.",
  );
}
