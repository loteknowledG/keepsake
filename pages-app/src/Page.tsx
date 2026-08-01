"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { openKeepsakeDatabase, saveKeepsakeData, type StorageMode } from "./storage";

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
  const rawName = domain.split(".")[0].replace(/[-_]+/g, " ");
  const siteName = /keepsake|keepseek/i.test(rawName)
    ? "Keepseek"
    : rawName.replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, 18);
  return { normalized, domain, title, mark: siteName };
}

export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(starterBookmarks);
  const [userCollections, setUserCollections] = useState<string[]>(defaultCollections);
  const [hydrated, setHydrated] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>("opfs");
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
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openKeepsakeDatabase().then(async (stored) => {
      const legacyBookmarks = window.localStorage.getItem("keepsake-bookmarks");
      const legacyCollections = window.localStorage.getItem("keepsake-collections");
      const nextBookmarks = stored.bookmarks.length ? stored.bookmarks : legacyBookmarks ? JSON.parse(legacyBookmarks) : starterBookmarks;
      const nextCollections = stored.collections.length ? stored.collections : legacyCollections ? JSON.parse(legacyCollections) : defaultCollections;
      setBookmarks(nextBookmarks);
      setUserCollections(nextCollections);
      setStorageMode(stored.mode);
      if (!stored.bookmarks.length) await saveKeepsakeData(nextBookmarks, nextCollections);
      if (legacyBookmarks || legacyCollections) {
        window.localStorage.removeItem("keepsake-bookmarks");
        window.localStorage.removeItem("keepsake-collections");
      }
      setStorageReady(true);
      setHydrated(true);
    }).catch(() => {
      setNotice("SQLite could not start in this browser. JSON export is still available.");
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !storageReady) return;
    saveKeepsakeData(bookmarks, userCollections).catch(() => setNotice("SQLite could not save that change. Export a JSON backup."));
  }, [bookmarks, userCollections, hydrated, storageReady]);

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

  function exportBookmarks() {
    const payload = JSON.stringify({
      app: "Keepseek",
      version: 2,
      exportedAt: new Date().toISOString(),
      collections: userCollections,
      bookmarks,
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `keepseek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    setNotice("Your Keepseek JSON is ready.");
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
      if (!Array.isArray(incoming)) throw new Error("Invalid Keepseek file");
      const valid = incoming.filter((item: Partial<Bookmark>) =>
        item && typeof item.url === "string" && typeof item.title === "string" && typeof item.domain === "string"
      ).map((item: Bookmark, index: number) => ({
        ...item,
        id: typeof item.id === "number" ? item.id : Date.now() + index,
        note: typeof item.note === "string" ? item.note : "Imported into Keepseek.",
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
      setNotice("That file isn’t a valid Keepseek or Keepsake JSON export.");
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
        <a className="brand" href="#top" aria-label="Keepseek home">Keepseek</a>
        <nav aria-label="Primary navigation"><a href="#scraps">Library</a><a href="#scraps">Collections</a><a href="#about">Highlights</a></nav>
        <button className="avatar" aria-label="Open profile">QL</button>
      </header>

      <section className="hero" id="top">
        <h1>Keep what matters,<br/>then <em>seek it again.</em></h1>
        <p className="intro">Keepseek automatically saves title, images, links, and metadata<br className="desktop-break"/> so you can find it again—and add your own notes.</p>
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
            <span className="local-pill"><i /> {storageReady ? storageMode === "opfs" ? "SQLite · OPFS file" : "SQLite · IndexedDB fallback" : "Starting SQLite…"}</span>
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
              <a href={bookmark.url} target="_blank" rel="noreferrer" className={`art ${bookmark.palette}`} style={bookmark.image ? { backgroundImage: `url(${bookmark.image})` } : undefined} aria-label={`Open ${bookmark.title}`}><span className={bookmark.image ? "visually-hidden" : ""}>{/keepsake|keepseek/i.test(bookmark.domain) ? "Keepseek" : bookmark.mark}</span></a>
              <div className="card-body">
                <div className="domain"><span>{bookmark.domain}</span><button onClick={() => toggleFavorite(bookmark.id)} aria-label={bookmark.favorite ? "Remove favorite" : "Add favorite"}>{bookmark.favorite ? "♥" : "♡"}</button></div>
                <h3><a href={bookmark.url} target="_blank" rel="noreferrer">{bookmark.title}</a></h3>
                <p className="note">“{bookmark.note}”</p>
                <span className="tag">{bookmark.collection}</span>
              </div>
            </article>
          ))}
          {visible.length === 0 && <div className="empty"><span>✦</span><h3>No scraps hiding here.</h3><p>Try another collection or save something new.</p></div>}
        </div>
      </section>

      <section className="how" id="about"><p className="kicker">THE QUIET MAGIC</p><h2>Paste. Pause. Remember.</h2><div className="steps"><div><b>01</b><h3>Drop a link</h3><p>Any article, product, video, or corner of the web.</p></div><div><b>02</b><h3>We gather the pieces</h3><p>Title, image, description, and source appear automatically.</p></div><div><b>03</b><h3>Add what matters</h3><p>Leave a thought in your own words and find it later.</p></div></div></section>

      <footer><span className="brand">Keepseek</span><p>Made for curious minds and gloriously open tabs.</p></footer>

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
    </main>
  );
}
