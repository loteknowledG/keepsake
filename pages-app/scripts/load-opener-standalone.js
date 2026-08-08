/* Standalone load opener body — bundled with fflate UMD at build time. */
(function () {
  const MAX_EXPANDED_BYTES = 25 * 1024 * 1024;
  const MAX_ENTRY_BYTES = 10 * 1024 * 1024;
  const KEEPSEEK_URL = "https://keepseek-app.vercel.app/";

  const app = document.getElementById("app");
  const payloadElement = document.getElementById("muthur-load-payload");
  const unzipSync = globalThis.fflate.unzipSync;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function base64urlDecode(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function sha256(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function assertSafeEntries(entries) {
    let expanded = 0;
    for (const [path, bytes] of Object.entries(entries)) {
      if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
        throw new Error("Load contains an unsafe path.");
      }
      if (bytes.length > MAX_ENTRY_BYTES) throw new Error("A Load entry is too large.");
      expanded += bytes.length;
    }
    if (expanded > MAX_EXPANDED_BYTES) throw new Error("Load expands beyond the safety limit.");
  }

  function bookmarkImages(bookmark) {
    if (bookmark.images?.length) return bookmark.images;
    if (bookmark.image) return [bookmark.image];
    return [];
  }

  async function openEmbeddedLoad(bytes, fileName) {
    const entries = unzipSync(bytes);
    assertSafeEntries(entries);
    if (!entries["manifest.json"] || !entries["indexes/root.json"] || !entries["scraps/scrap.json"]) {
      throw new Error("Required Load entries are missing.");
    }

    const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
    if (manifest.format !== "muthurload" || manifest.version !== "0.1" || manifest.entrypoint !== "indexes/root.json") {
      throw new Error("Unsupported MUTHURLOAD format.");
    }

    const rootIndex = JSON.parse(new TextDecoder().decode(entries[manifest.entrypoint]));
    if (!Array.isArray(rootIndex.objects)) throw new Error("Load index is invalid.");

    for (const object of rootIndex.objects) {
      const objectBytes = entries[object.path];
      if (!objectBytes || objectBytes.length !== object.bytes || (await sha256(objectBytes)) !== object.sha256) {
        throw new Error("Load integrity check failed for " + object.path + ".");
      }
    }

    const sortedObjects = [...rootIndex.objects].sort((left, right) => left.path.localeCompare(right.path));
    const expectedRoot = await sha256(new TextEncoder().encode(JSON.stringify(sortedObjects.map(({ path, sha256: hash }) => ({ path, sha256: hash })), null, 2)));
    if (expectedRoot !== rootIndex.rootHash || expectedRoot !== manifest.hashing.root) {
      throw new Error("Load root hash does not match its contents.");
    }

    const scrap = JSON.parse(new TextDecoder().decode(entries["scraps/scrap.json"]));
    if (scrap.type !== "keepseek.scrap" || !scrap.bookmark?.title) {
      throw new Error("Load does not contain a valid Keepseek scrap.");
    }

    const contentObject = rootIndex.objects.find((object) => object.path.startsWith("content/"));
    return {
      manifest,
      bookmark: scrap.bookmark,
      content: contentObject ? new TextDecoder().decode(entries[contentObject.path]) : undefined,
      fileName,
    };
  }

  function renderLoad(opened, payload) {
    const images = bookmarkImages(opened.bookmark);
    const keepseekOrigin = (payload.keepseekOrigin || KEEPSEEK_URL).replace(/\/?$/, "/");

    app.innerHTML =
      '<main>' +
      '<p class="kicker">Verified MUTHURLOAD</p>' +
      "<h1>" + escapeHtml(opened.bookmark.title) + "</h1>" +
      '<p class="lede">' + escapeHtml(opened.bookmark.domain || "Keepseek Load") + " · self-contained package.</p>" +
      '<div class="proof"><div><small>Root hash</small><code>' + escapeHtml(opened.manifest.hashing.root.slice(0, 20)) + "…</code></div><span>SHA-256 ✓</span></div>" +
      (opened.bookmark.note ? '<p class="note">' + escapeHtml(opened.bookmark.note) + "</p>" : "") +
      (images.length ? '<div class="gallery">' + images.map((src) => '<img src="' + escapeHtml(src) + '" alt="">').join("") + "</div>" : "") +
      (opened.content ? '<pre class="note">' + escapeHtml(opened.content.slice(0, 1600)) + "</pre>" : "") +
      '<div class="actions"><button type="button" id="open-keepseek">Open in Keepseek</button>' +
      '<button type="button" class="secondary" id="download-load">Download .muthur.load</button></div></main>';

    document.getElementById("open-keepseek")?.addEventListener("click", () => {
      const receiver = window.open(keepseekOrigin + "view#receive-load&view=1", "_blank");
      if (!receiver) {
        window.alert("Allow pop-ups, then click Open in Keepseek again.");
        return;
      }
      const message = { type: "keepseek-shared-load", payload: payload };
      const send = () => {
        try {
          receiver.postMessage(message, keepseekOrigin.replace(/\/$/, ""));
        } catch {
          receiver.postMessage(message, "*");
        }
      };
      window.setTimeout(send, 300);
      window.setTimeout(send, 1000);
      window.setTimeout(send, 2500);
    });

    document.getElementById("download-load")?.addEventListener("click", () => {
      const bytes = base64urlDecode(payload.load);
      const blob = new Blob([bytes], { type: "application/vnd.keepseek.muthurload+zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = opened.fileName;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  function renderError(message) {
    app.innerHTML = '<main><div class="error"><p class="kicker">Load failed</p><p>' + escapeHtml(message) + "</p></div></main>";
  }

  async function boot() {
    if (!payloadElement) {
      renderError("This package is missing its embedded Load.");
      return;
    }

    try {
      const payload = JSON.parse(payloadElement.textContent);
      const bytes = base64urlDecode(payload.load);
      const opened = await openEmbeddedLoad(bytes, payload.fileName || "shared.muthur.load");
      if (payload.root && opened.manifest.hashing.root !== payload.root) {
        throw new Error("Embedded Load root hash does not match this package.");
      }
      renderLoad(opened, payload);
    } catch (error) {
      renderError(error instanceof Error ? error.message : "This package could not verify its Load.");
    }
  }

  void boot();
})();
