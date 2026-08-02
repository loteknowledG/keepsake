"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createLoad, createMuthurLink } from "./load-format";

export type Bookmark = {
  id: number;
  url: string;
  domain: string;
  title: string;
  note: string;
  collection: string;
  palette: string;
  mark: string;
  favorite?: boolean;
  image?: string;
};

const starterBookmarks: Bookmark[] = [
  { id: 1, url: "https://www.technologyreview.com", domain: "technologyreview.com", title: "The Future of Small Models", note: "Useful framing for local agents.", collection: "Research", palette: "violet", mark: "MIT", favorite: true, image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80" },
  { id: 2, url: "https://anniemiller.co/lisbon", domain: "anniemiller.co", title: "A quiet weekend in Lisbon", note: "For the fall trip.", collection: "Inspiration", palette: "coral", mark: "AM", image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800&q=80" },
  { id: 3, url: "https://www.are.na/editorial", domain: "are.na", title: "Designing with Memory", note: "Reference for Calyx.", collection: "Inspiration", palette: "sunset", mark: "A", image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80" },
  { id: 4, url: "https://sproutedkitchen.com", domain: "sproutedkitchen.com", title: "Lemon & Ricotta Pasta", note: "Weeknight favorite.", collection: "Reading", palette: "garden", mark: "SK", favorite: true, image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80" },
  { id: 5, url: "https://www.dezeen.com/interiors", domain: "dezeen.com", title: "Cabin Fever Interiors", note: "Materials + lighting inspiration.", collection: "Products", palette: "grid", mark: "D", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=80" },
];

const defaultCollections = ["Research", "Products", "Inspiration", "Reading"];

function metadataFor(rawUrl: string) {
  const normalized = rawUrl.match(/^https?:\/\//) ? rawUrl : `https://${rawUrl}`;
  const parsed = new URL(normalized);
  const domain = parsed.hostname.replace(/^www\./, "");
  const slug = parsed.pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ");
  const title = slug ? slug.replace(/\b\w/g, (c) => c.toUpperCase()) : `Something worth keeping from ${domain}`;
  return { normalized, domain, title, mark: domain.slice(0, 2).toUpperCase() };
}

export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(starterBookmarks);
  const [userCollections, setUserCollections] = useState<string[]>(defaultCollections);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState("All scraps");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"url" | "details">("url");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [collection, setCollection] = useState("Inspiration");
  const [captured, setCaptured] = useState<ReturnType<typeof metadataFor> | null>(null);
  const [notice, setNotice] = useState("");
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [shareTarget, setShareTarget] = useState<Bookmark | null>(null);
  const [sharing, setSharing] = useState<"load" | "link" | null>(null);
  const [shareLink, setShareLink] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("keepsake-bookmarks");
    if (stored) setBookmarks(JSON.parse(stored));
    const storedCollections = window.localStorage.getItem("keepsake-collections");
    if (storedCollections) setUserCollections(JSON.parse(storedCollections));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("keepsake-bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("keepsake-collections", JSON.stringify(userCollections));
  }, [userCollections, hydrated]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("keepsake-search")?.focus();
      }
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => bookmarks.filter((bookmark) => {
    const matchesCollection = active === "All scraps" || (active === "Favorites" ? bookmark.favorite : bookmark.collection === active);
    const haystack = `${bookmark.title} ${bookmark.note} ${bookmark.domain}`.toLowerCase();
    return matchesCollection && haystack.includes(query.toLowerCase());
  }), [active, bookmarks, query]);

  const collectionTabs = ["All scraps", "Favorites", ...userCollections];

  function startCapture(event: FormEvent) {
    event.preventDefault();
    try {
      setCaptured(metadataFor(url));
      setStep("details");
    } catch {
      setCaptured(null);
    }
  }

  function saveBookmark(event: FormEvent) {
    event.preventDefault();
    if (!captured) return;
    const palettes = ["sunset", "grid", "violet", "coral", "garden"];
    setBookmarks((items) => [{ id: Date.now(), url: captured.normalized, domain: captured.domain, title: captured.title, note: note || "Saved for later.", collection, palette: palettes[items.length % palettes.length], mark: captured.mark }, ...items]);
    closeModal();
  }

  function closeModal() {
    setOpen(false); setStep("url"); setUrl(""); setNote(""); setCaptured(null);
  }

  function toggleFavorite(id: number) {
    setBookmarks((items) => items.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));
  }

  async function downloadLoad(bookmark: Bookmark) {
    setSharing("load"); setNotice("Packing a verified MUTHURLOAD…");
    try {
      const created = await createLoad(bookmark);
      const downloadUrl = URL.createObjectURL(created.file);
      const link = document.createElement("a");
      link.href = downloadUrl; link.download = created.fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setNotice(`${created.fileName} is ready.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Keepseek could not create that Load."); }
    finally { setSharing(null); closeShare(); }
  }

  function closeShare() { setShareTarget(null); setShareLink(""); }

  async function prepareMuthurLink(bookmark: Bookmark) {
    setSharing("link"); setNotice("Building an embedded MUTHUR Link…");
    try {
      const created = await createMuthurLink(bookmark);
      setShareLink(created.url);
      setNotice(`MUTHUR Link ready. Anyone with it can read this ${created.bytes.toLocaleString()}-byte Load.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Keepseek could not create that MUTHUR Link."); }
    finally { setSharing(null); }
  }

  async function copyPreparedLink() {
    if (!shareLink) return;
    try {
      const clipboard = navigator.clipboard?.writeText(shareLink);
      if (!clipboard) throw new Error("Clipboard API unavailable");
      await Promise.race([clipboard, new Promise((_, reject) => window.setTimeout(() => reject(new Error("Clipboard timed out")), 1_500))]);
      setNotice("MUTHUR Link copied.");
    } catch {
      const field = document.createElement("textarea");
      field.value = shareLink; field.style.position = "fixed"; field.style.opacity = "0"; document.body.appendChild(field); field.select();
      const copied = document.execCommand("copy"); field.remove();
      setNotice(copied ? "MUTHUR Link copied." : "Copy was blocked. Open the link and copy it from the address bar.");
    }
  }

  function exportBookmarks() {
    const payload = JSON.stringify({
      app: "Keepsake",
      version: 1,
      exportedAt: new Date().toISOString(),
      collections: userCollections,
      bookmarks,
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `keepsake-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    setNotice("Your Keepsake JSON is ready.");
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
  }

  async function importBookmarks(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.bookmarks;
      if (!Array.isArray(incoming)) throw new Error("Invalid Keepsake file");
      const valid = incoming.filter((item: Partial<Bookmark>) =>
        item && typeof item.url === "string" && typeof item.title === "string" && typeof item.domain === "string"
      ).map((item: Bookmark, index: number) => ({
        ...item,
        id: typeof item.id === "number" ? item.id : Date.now() + index,
        note: typeof item.note === "string" ? item.note : "Imported into Keepsake.",
        collection: typeof item.collection === "string" ? item.collection : "Reading",
        palette: typeof item.palette === "string" ? item.palette : "sunset",
        mark: typeof item.mark === "string" ? item.mark : item.domain.slice(0, 2).toUpperCase(),
      }));
      if (!valid.length) throw new Error("No valid bookmarks");
      setBookmarks((current) => {
        const byUrl = new Map(current.map((item) => [item.url, item]));
        valid.forEach((item: Bookmark) => byUrl.set(item.url, item));
        return Array.from(byUrl.values());
      });
      if (Array.isArray(data.collections)) {
        setUserCollections((current) => Array.from(new Set([...current, ...data.collections.filter((item: unknown) => typeof item === "string" && item.trim())])));
      } else {
        setUserCollections((current) => Array.from(new Set([...current, ...valid.map((item: Bookmark) => item.collection)])));
      }
      setNotice(`Imported ${valid.length} ${valid.length === 1 ? "bookmark" : "bookmarks"}.`);
    } catch {
      setNotice("That file isn’t a valid Keepsake JSON export.");
    } finally {
      event.target.value = "";
    }
  }

  function createCollection(event: FormEvent) {
    event.preventDefault();
    const name = newCollection.trim();
    if (!name) return;
    const existing = userCollections.find((item) => item.toLowerCase() === name.toLowerCase());
    const finalName = existing ?? name;
    if (!existing) setUserCollections((items) => [...items, name]);
    setCollection(finalName);
    setActive(finalName);
    setNewCollection("");
    setCollectionOpen(false);
    setNotice(existing ? `${finalName} already exists.` : `${finalName} collection created.`);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Keepsake home">Keepsake</a>
        <nav aria-label="Primary navigation"><a href="#scraps">Library</a><a href="#scraps">Collections</a><a href="#about">Highlights</a></nav>
        <button className="avatar" aria-label="Open profile">QL</button>
      </header>

      <section className="hero" id="top">
        <h1>Keep the internet<br/>worth <em>remembering.</em></h1>
        <p className="intro">Keepsake automatically saves title, images, links, and metadata<br className="desktop-break"/> so you can find it again—and add your own notes.</p>
        <div className="capture-row">
          <button className="primary" onClick={() => setOpen(true)}><span>＋</span> Add a bookmark</button>
          <label className="search"><span>⌕</span><input id="keepsake-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your saved world" /><kbd>⌘ K</kbd></label>
        </div>
        <span className="scribble">Your vault.<br/>Automatically filled<br/>with context. ↙</span>
      </section>

      <section className="library" id="scraps">
        <div className="library-head">
          <div><h2>◷ &nbsp;Recently kept</h2></div>
          <div className="data-actions">
            <span className="local-pill"><i /> Stored in this browser</span>
            <button onClick={() => importRef.current?.click()}>⇧ Import JSON</button>
            <button onClick={exportBookmarks}>⇩ Export JSON</button>
            <input ref={importRef} onChange={importBookmarks} type="file" accept="application/json,.json" hidden />
            <span className="scrap-count">{visible.length} {visible.length === 1 ? "scrap" : "scraps"}</span>
          </div>
        </div>
        <div className="filters" role="tablist" aria-label="Bookmark collections">
          {collectionTabs.map((item) => <button role="tab" aria-selected={active === item} className={active === item ? "active" : ""} onClick={() => setActive(item)} key={item}>{item}</button>)}
          <button className="new-collection" onClick={() => setCollectionOpen(true)}>＋ New collection</button>
        </div>
        <div className="card-grid">
          {visible.map((bookmark, index) => (
            <article className={`bookmark-card tilt-${index % 4}`} key={bookmark.id}>
              <a href={bookmark.url} target="_blank" rel="noreferrer" className={`art ${bookmark.palette}`} style={bookmark.image ? { backgroundImage: `url(${bookmark.image})` } : undefined} aria-label={`Open ${bookmark.title}`}><span className={bookmark.image ? "visually-hidden" : ""}>{bookmark.mark}</span></a>
              <div className="card-body">
                <div className="domain"><span>{bookmark.domain}</span><button onClick={() => toggleFavorite(bookmark.id)} aria-label={bookmark.favorite ? "Remove favorite" : "Add favorite"}>{bookmark.favorite ? "♥" : "♡"}</button></div>
                <h3><a href={bookmark.url} target="_blank" rel="noreferrer">{bookmark.title}</a></h3>
                <p className="note">“{bookmark.note}”</p>
                <div className="card-footer"><span className="tag">{bookmark.collection}</span><button className="share-action" onClick={() => setShareTarget(bookmark)}>↗ Share</button></div>
              </div>
            </article>
          ))}
          {visible.length === 0 && <div className="empty"><span>✦</span><h3>No scraps hiding here.</h3><p>Try another collection or save something new.</p></div>}
        </div>
      </section>

      <section className="how" id="about"><p className="kicker">THE QUIET MAGIC</p><h2>Paste. Pause. Remember.</h2><div className="steps"><div><b>01</b><h3>Drop a link</h3><p>Any article, product, video, or corner of the web.</p></div><div><b>02</b><h3>We gather the pieces</h3><p>Title, image, description, and source appear automatically.</p></div><div><b>03</b><h3>Add what matters</h3><p>Leave a thought in your own words and find it later.</p></div></div></section>

      <footer><span className="brand">Keepsake</span><p>Made for curious minds and gloriously open tabs.</p></footer>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

      {open && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="close" onClick={closeModal} aria-label="Close">×</button>
          {step === "url" ? <form onSubmit={startCapture}>
            <span className="modal-icon">↗</span><p className="kicker">NEW SCRAP</p><h2 id="modal-title">What caught your eye?</h2><p>Paste the address. We’ll gather its picture and details.</p>
            <label>Website URL<input autoFocus type="text" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://something.wonderful" /></label>
            <button className="primary wide" type="submit">Gather this page <span>→</span></button>
          </form> : <form onSubmit={saveBookmark}>
            <p className="kicker">PAGE FOUND</p><h2 id="modal-title">Make it yours.</h2>
            <div className="captured-preview"><div className="mini-art">{captured?.mark}</div><div><small>{captured?.domain}</small><strong>{captured?.title}</strong></div><span>✓</span></div>
            <label>Your note<textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you keeping this?" /></label>
            <label>Collection<select value={collection} onChange={(e) => e.target.value === "__new" ? setCollectionOpen(true) : setCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}<option value="__new">＋ New collection…</option></select></label>
            <button className="primary wide" type="submit">Tuck it away <span>→</span></button>
          </form>}
        </div>
      </div>}

      {collectionOpen && <div className="modal-backdrop collection-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setCollectionOpen(false)}>
        <div className="modal collection-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title">
          <button className="close" onClick={() => setCollectionOpen(false)} aria-label="Close">×</button>
          <form onSubmit={createCollection}>
            <span className="modal-icon">✦</span><p className="kicker">NEW COLLECTION</p><h2 id="collection-title">Name your new corner.</h2><p>Make a home for a project, obsession, trip, or anything else.</p>
            <label>Collection name<input autoFocus value={newCollection} onChange={(e) => setNewCollection(e.target.value)} placeholder="e.g. Cyberdeck ideas" maxLength={40} required /></label>
            <button className="primary wide" type="submit">Create collection <span>→</span></button>
          </form>
        </div>
      </div>}

      {shareTarget && <div className="modal-backdrop share-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeShare()}>
        <div className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
          <button className="close" onClick={closeShare} aria-label="Close">×</button>
          <span className="modal-icon share-icon">↗</span><p className="kicker">SHARE KNOWLEDGE</p><h2 id="share-title">Send the Load.</h2><p>{shareTarget.title}</p>
          {!shareLink ? <div className="share-options">
            <button onClick={() => downloadLoad(shareTarget)} disabled={sharing !== null}><strong>{sharing === "load" ? "PACKING…" : "MUTHURLOAD"}</strong><span>Download the owned, offline `.muthur.load` file.</span></button>
            <button onClick={() => prepareMuthurLink(shareTarget)} disabled={sharing !== null}><strong>{sharing === "link" ? "LINKING…" : "MUTHUR LINK"}</strong><span>Create a zero-install browser link. Anyone with it can read this Load.</span></button>
          </div> : <div className="share-ready"><strong>MUTHUR LINK READY</strong><p>This public-by-possession link contains the complete verified Load.</p><a href={shareLink}>Open in MUTHUR <span>↗</span></a><button onClick={copyPreparedLink}>Copy Link</button></div>}
        </div>
      </div>}
    </main>
  );
}
