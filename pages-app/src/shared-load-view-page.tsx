import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { Bookmark, ScrapKind } from "./Page";
import {
  fetchLoadFromUrl,
  openLoad,
  openLoadFromBytes,
  openLoadFromSharedPayload,
  parseKeepseekLoadLocation,
  type OpenedLoad,
} from "./load-format";
import { adDestinationUrl, adDomainFromDestination, adExternalLinkUrl, adPersistUrl } from "./ad-url";
import AdImageGallery from "./ad-image-gallery";
import PlaylistPlayerFrame from "./playlist-player-frame";
import { canPlayMedia, resolvePlaylistPlayback } from "./video-utils";

function bookmarkImages(bookmark: Pick<Bookmark, "image" | "images">): string[] {
  if (bookmark.images?.length) return bookmark.images;
  if (bookmark.image) return [bookmark.image];
  return [];
}

function normalizeScrapKind(kind: unknown, collection?: string): ScrapKind {
  if (kind === "bookmark" || kind === "playlist" || kind === "ad") return kind;
  if (collection === "Playlists") return "playlist";
  if (collection === "Ads") return "ad";
  return "bookmark";
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

function bookmarkFromOpened(opened: OpenedLoad): Bookmark {
  return repairAdBookmark({
    ...opened.bookmark,
    kind: normalizeScrapKind(opened.bookmark.kind, opened.bookmark.collection),
  });
}

export default function SharedLoadViewPage() {
  const [opened, setOpened] = useState<OpenedLoad | null>(null);
  const [localBookmark, setLocalBookmark] = useState<Bookmark | null>(null);
  const [status, setStatus] = useState("Verifying shared Load…");
  const [error, setError] = useState("");
  const [gallery, setGallery] = useState<{ images: string[]; index: number; title: string } | null>(null);
  const [pendingCompanion, setPendingCompanion] = useState<{ fileName: string; rootHash: string } | null>(null);
  const booted = useRef(false);
  const receivedMessage = useRef(false);
  const loadRef = useRef<HTMLInputElement>(null);

  function clearHash() {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  async function presentOpenedLoad(preview: OpenedLoad) {
    setOpened(preview);
    setError("");
    setStatus("");
  }

  async function loadFromTarget(target: NonNullable<ReturnType<typeof parseKeepseekLoadLocation>>) {
    if (target.kind === "companion") {
      setPendingCompanion({ fileName: target.fileName, rootHash: target.rootHash });
      setStatus(`Choose ${target.fileName} to open this shared Load.`);
      window.setTimeout(() => loadRef.current?.click(), 0);
      return;
    }
    if (target.kind === "receive") {
      setStatus("Waiting for shared Load from package…");
      return;
    }
    setStatus("Opening shared Load…");
    const preview = target.kind === "embedded"
      ? await openLoadFromBytes(target.bytes, target.fileName)
      : await fetchLoadFromUrl(target.url, target.fileName);
    await presentOpenedLoad(preview);
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
    if (hashParams.has("local")) {
      clearHash();
      const raw = sessionStorage.getItem("keepseek-local-view");
      sessionStorage.removeItem("keepseek-local-view");
      if (!raw) {
        setError("No ad was found to view.");
        setStatus("");
        return;
      }
      try {
        const payload = JSON.parse(raw) as { bookmark?: Bookmark };
        if (!payload.bookmark) throw new Error("Missing ad data.");
        setLocalBookmark(repairAdBookmark(payload.bookmark));
        setStatus("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That ad could not be opened.");
        setStatus("");
      }
      return;
    }
    const target = parseKeepseekLoadLocation(window.location);
    if (!target) {
      setError("No shared Load was found on this page.");
      setStatus("");
      return;
    }
    clearHash();
    void loadFromTarget(target).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "That shared Load could not be opened.");
      setStatus("");
    });
  }, []);

  useEffect(() => {
    async function acceptPayload(payload: { load?: string; fileName?: string; root?: string }) {
      if (!payload?.load || receivedMessage.current) return;
      receivedMessage.current = true;
      try {
        setStatus("Opening shared Load…");
        await presentOpenedLoad(await openLoadFromSharedPayload({
          load: payload.load,
          fileName: payload.fileName,
          root: payload.root,
        }));
      } catch (cause) {
        receivedMessage.current = false;
        setError(cause instanceof Error ? cause.message : "That shared Load could not be opened.");
        setStatus("");
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "keepseek-shared-load") return;
      const trustedOrigin = event.origin === window.location.origin || event.origin === "null" || event.origin.startsWith("file:");
      if (!trustedOrigin) return;
      void acceptPayload(event.data.payload);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function inspectLoad(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const expected = pendingCompanion;
    try {
      setStatus("Verifying Load integrity…");
      const preview = await openLoad(file);
      if (expected && preview.manifest.hashing.root !== expected.rootHash) {
        throw new Error("This file does not match the shared Load link.");
      }
      setPendingCompanion(null);
      await presentOpenedLoad(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file is not a valid Load.");
      setStatus("");
    } finally {
      event.target.value = "";
    }
  }

  const bookmark = localBookmark ?? (opened ? bookmarkFromOpened(opened) : null);
  const adLink = bookmark ? adExternalLinkUrl(bookmark.url) : null;
  const images = bookmark ? bookmarkImages(bookmark) : [];
  const playback = bookmark && bookmark.kind === "playlist" && canPlayMedia(bookmark.url)
    ? resolvePlaylistPlayback(bookmark.url, window.location.origin)
    : null;

  return (
    <main className="view-page">
      <header className="view-page-header">
        <a className="view-page-brand" href="/">Keepseek</a>
        <span className="view-page-label">{localBookmark ? "Ad" : "Shared Load"}</span>
      </header>

      {status && !error && !bookmark && (
        <section className="view-page-status">
          <p className="kicker">MUTHURLOAD</p>
          <p>{status}</p>
        </section>
      )}

      {error && (
        <section className="view-page-error">
          <p className="kicker">Load failed</p>
          <p>{error}</p>
          <a className="view-page-action" href="/">Back to Keepseek</a>
        </section>
      )}

      {bookmark && (opened || localBookmark) && (
        <article className="view-page-content">
          {opened && (
            <div className="load-proof">
              <div>
                <small>ROOT HASH</small>
                <code>{opened.manifest.hashing.root.slice(0, 20)}…</code>
              </div>
              <span>SHA-256 ✓</span>
            </div>
          )}

          {bookmark.kind === "ad" ? (
            <>
              <p className="kicker">{localBookmark ? "AD" : "SHARED AD"}</p>
              <p className="ad-view-domain">{bookmark.domain}</p>
              <h1>{bookmark.title}</h1>
              <div className="ad-view-copy">{bookmark.note}</div>
              {images.length > 0 ? (
                <div className="ad-view-gallery">
                  {images.map((src, imageIndex) => (
                    <button
                      key={`${imageIndex}-${src.slice(0, 48)}`}
                      type="button"
                      className="ad-view-gallery-item"
                      onClick={() => setGallery({ images, index: imageIndex, title: bookmark.title })}
                      aria-label={`Open image ${imageIndex + 1} in gallery`}
                    >
                      <img src={src} alt={`${bookmark.title} creative ${imageIndex + 1}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`ad-view-placeholder art ${bookmark.palette}`} aria-hidden="true"><span>{bookmark.mark}</span></div>
              )}
            </>
          ) : bookmark.kind === "playlist" && playback ? (
            <>
              <p className="kicker">SHARED PLAYLIST</p>
              <h1>{bookmark.title}</h1>
              <p className="view-page-note">{bookmark.note}</p>
              <PlaylistPlayerFrame playback={playback} title={bookmark.title} sourceUrl={bookmark.url} />
            </>
          ) : (
            <>
              <p className="kicker">SHARED SCRAP</p>
              <p className="ad-view-domain">{bookmark.domain}</p>
              <h1>{bookmark.title}</h1>
              <p className="view-page-note">{bookmark.note}</p>
              {opened?.content && <pre className="load-content">{opened.content.slice(0, 2400)}</pre>}
            </>
          )}

          <div className="view-page-actions">
            {adLink && <a className="view-page-action primary" href={adLink} target="_blank" rel="noreferrer">Open link <span>↗</span></a>}
            {bookmark.kind === "playlist" && /^https?:\/\//i.test(bookmark.url) && (
              <a className="view-page-action" href={bookmark.url} target="_blank" rel="noreferrer">Open source <span>↗</span></a>
            )}
            <a className="view-page-action secondary" href="/">Back to library</a>
          </div>
        </article>
      )}

      <input ref={loadRef} onChange={inspectLoad} type="file" accept=".load,.muthur.load,application/zip,application/vnd.keepseek.muthurload+zip" hidden />

      {gallery && (
        <AdImageGallery
          images={gallery.images}
          index={gallery.index}
          title={gallery.title}
          onClose={() => setGallery(null)}
          onIndexChange={(index) => setGallery((current) => current ? { ...current, index } : current)}
        />
      )}
    </main>
  );
}
