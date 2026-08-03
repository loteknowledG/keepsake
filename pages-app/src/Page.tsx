"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { openKeepsakeDatabase, saveKeepsakeData, type StorageMode } from "./storage";
import { createLoad, createMuthurLink, openLoad, type OpenedLoad } from "./load-format";
import { VscEditCompact } from "react-icons/vsc";
import { AiTwotoneDelete } from "react-icons/ai";
import { IoShareSocialOutline } from "react-icons/io5";
import { parsePlaylistInput, getMediaEmbed, type MediaEmbed } from "./media-input";
import MediaPlayer from "./MediaPlayer";

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

const defaultCollections = ["Research", "Products", "Inspiration", "Reading", "Playlists"];

type AddKind = "bookmark" | "playlist";

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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [addKind, setAddKind] = useState<AddKind>("bookmark");
  const [step, setStep] = useState<"url" | "player" | "details">("url");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [collection, setCollection] = useState("Inspiration");
  const [captured, setCaptured] = useState<ReturnType<typeof metadataFor> | null>(null);
  const [capturedEmbed, setCapturedEmbed] = useState<MediaEmbed | null>(null);
  const [captureError, setCaptureError] = useState("");
  const [playerTarget, setPlayerTarget] = useState<Bookmark | null>(null);
  const [notice, setNotice] = useState("");
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [loadPreview, setLoadPreview] = useState<OpenedLoad | null>(null);
  const [creatingLoad, setCreatingLoad] = useState<number | null>(null);
  const [shareTarget, setShareTarget] = useState<Bookmark | null>(null);
  const [sharing, setSharing] = useState<"load" | "link" | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [editTarget, setEditTarget] = useState<Bookmark | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCollection, setEditCollection] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Bookmark | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const loadRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

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
      if (event.key === "Escape") {
        setAddMenuOpen(false);
        setPlayerTarget(null);
        closeModal();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [addMenuOpen]);

  const visible = useMemo(() => bookmarks.filter((bookmark) => {
    const matchesCollection = active === "All scraps" || (active === "Favorites" ? bookmark.favorite : bookmark.collection === active);
    const haystack = `${bookmark.title} ${bookmark.note} ${bookmark.domain}`.toLowerCase();
    return matchesCollection && haystack.includes(query.toLowerCase());
  }), [active, bookmarks, query]);

  const collectionTabs = ["All scraps", "Favorites", ...userCollections];

  function startCapture(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    setCaptureError("");
    try {
      if (addKind === "playlist") {
        const metadata = parsePlaylistInput(trimmed);
        const embed = getMediaEmbed(trimmed);
        if (!embed) throw new Error("Could not build a player for that link. Try a YouTube, Spotify, or Vimeo URL.");
        setCaptured(metadata);
        setCapturedEmbed(embed);
        setStep("player");
        return;
      }
      setCaptured(metadataFor(trimmed));
      setStep("details");
    } catch (error) {
      setCaptured(null);
      setCapturedEmbed(null);
      setCaptureError(error instanceof Error ? error.message : "Enter a valid link or embed code.");
    }
  }

  function saveBookmark(event: FormEvent) {
    event.preventDefault();
    if (!captured) return;
    const palettes = ["sunset", "grid", "violet", "coral", "garden"];
    const finalCollection = addKind === "playlist" ? (collection || "Playlists") : collection;
    if (!userCollections.includes(finalCollection)) {
      setUserCollections((items) => [...items, finalCollection]);
    }
    const newId = Date.now();
    const saved = {
      id: newId,
      url: captured.normalized,
      domain: captured.domain,
      title: captured.title,
      note: note || (addKind === "playlist" ? "Saved playlist." : "Saved for later."),
      collection: finalCollection,
      palette: palettes[bookmarks.length % palettes.length],
      mark: captured.mark,
    };
    setBookmarks((items) => [saved, ...items]);
    if (addKind === "playlist" && capturedEmbed) {
      setActive(finalCollection);
      setPlayerTarget(saved);
    }
    closeModal();
  }

  function openPlayer(bookmark: Bookmark) {
    if (!getMediaEmbed(bookmark.url)) return;
    setPlayerTarget(bookmark);
  }

  function openAdd(kind: AddKind) {
    setAddKind(kind);
    setCollection(kind === "playlist" ? "Playlists" : "Inspiration");
    setOpen(true);
    setAddMenuOpen(false);
  }

  function closeModal() {
    setOpen(false);
    setStep("url");
    setUrl("");
    setNote("");
    setCaptured(null);
    setCapturedEmbed(null);
    setCaptureError("");
    setAddKind("bookmark");
  }

  function toggleFavorite(id: number) {
    setBookmarks((items) => items.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));
  }

  function startEdit(bookmark: Bookmark) {
    setEditTarget(bookmark);
    setEditUrl(bookmark.url);
    setEditTitle(bookmark.title);
    setEditNote(bookmark.note);
    setEditCollection(bookmark.collection);
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    try {
      const metadata = metadataFor(editUrl);
      const title = editTitle.trim();
      if (!title) return;
      setBookmarks((items) => items.map((item) => item.id === editTarget.id ? {
        ...item,
        url: metadata.normalized,
        domain: metadata.domain,
        mark: metadata.mark,
        title,
        note: editNote.trim() || "Saved for later.",
        collection: editCollection,
      } : item));
      setEditTarget(null);
      setNotice(`Updated ${title}.`);
    } catch {
      setNotice("Enter a valid website address.");
    }
  }

  function deleteBookmark() {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    setBookmarks((items) => items.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    setNotice(`Deleted ${title}.`);
  }

  async function shareLoad(bookmark: Bookmark) {
    setSharing("load");
    setCreatingLoad(bookmark.id);
    setNotice("Building a verified Load…");
    try {
      const created = await createLoad(bookmark);
      const downloadUrl = URL.createObjectURL(created.file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = created.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setNotice(`${created.fileName} is ready to swap.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Keepseek could not create that Load.");
    } finally {
      setCreatingLoad(null);
      setSharing(null);
      closeShare();
    }
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

  async function inspectLoad(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setNotice("Verifying Load integrity…");
      setLoadPreview(await openLoad(file));
      setNotice("Load verified. Preview before taking it.");
    } catch (error) {
      setLoadPreview(null);
      setNotice(error instanceof Error ? error.message : "That file is not a valid Load.");
    } finally {
      event.target.value = "";
    }
  }

  function takeLoad() {
    if (!loadPreview) return;
    const incoming = { ...loadPreview.bookmark, id: Date.now() };
    setBookmarks((current) => {
      const byUrl = new Map(current.map((item) => [item.url, item]));
      byUrl.set(incoming.url, incoming);
      return Array.from(byUrl.values());
    });
    setUserCollections((current) => current.includes(incoming.collection) ? current : [...current, incoming.collection]);
    setActive(incoming.collection);
    setLoadPreview(null);
    setNotice(`Took ${loadPreview.fileName} into Keepseek.`);
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
          <div className="add-menu" ref={addMenuRef}>
            <button
              className="primary add-trigger"
              type="button"
              aria-expanded={addMenuOpen}
              aria-haspopup="menu"
              onClick={() => setAddMenuOpen((value) => !value)}
            >
              <span>＋</span> Add <span className="add-chevron" aria-hidden="true">{addMenuOpen ? "▴" : "▾"}</span>
            </button>
            {addMenuOpen && (
              <div className="add-menu-panel" role="menu" aria-label="Add options">
                <button type="button" role="menuitem" onClick={() => openAdd("bookmark")}>
                  <strong>Bookmark</strong>
                  <span>Save a page, article, or link.</span>
                </button>
                <button type="button" role="menuitem" onClick={() => openAdd("playlist")}>
                  <strong>Playlist</strong>
                  <span>Keep playlists, videos, or embeds together.</span>
                </button>
              </div>
            )}
          </div>
          <label className="search"><span>⌕</span><input id="keepsake-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your saved world" /><kbd>⌘ K</kbd></label>
        </div>
        <span className="scribble">Your vault.<br/>Automatically filled<br/>with context. ↙</span>
      </section>

      <section className="library" id="scraps">
        <div className="library-head">
          <div><h2>◷ &nbsp;Recently kept</h2></div>
          <div className="data-actions">
            <span className="local-pill"><i /> {storageReady ? storageMode === "opfs" ? "SQLite · OPFS file" : "SQLite · IndexedDB fallback" : "Starting SQLite…"}</span>
            <button className="open-load" onClick={() => loadRef.current?.click()}>⌁ Open Load</button>
            <button onClick={() => importRef.current?.click()}>⇧ Import JSON</button>
            <button onClick={exportBookmarks}>⇩ Export JSON</button>
            <input ref={importRef} onChange={importBookmarks} type="file" accept="application/json,.json" hidden />
            <input ref={loadRef} onChange={inspectLoad} type="file" accept=".load,application/zip,application/vnd.keepseek.muthurload+zip" hidden />
            <span className="scrap-count">{visible.length} {visible.length === 1 ? "scrap" : "scraps"}</span>
          </div>
        </div>
        <div className="filters" role="tablist" aria-label="Bookmark collections">
          {collectionTabs.map((item) => <button role="tab" aria-selected={active === item} className={active === item ? "active" : ""} onClick={() => setActive(item)} key={item}>{item}</button>)}
          <button className="new-collection" onClick={() => setCollectionOpen(true)}>＋ New collection</button>
        </div>
        <div className="card-grid">
          {visible.map((bookmark, index) => {
            const playable = Boolean(getMediaEmbed(bookmark.url));
            return (
            <article className={`bookmark-card tilt-${index % 4}${playable ? " playable" : ""}`} key={bookmark.id}>
              {playable ? (
                <button type="button" className={`art ${bookmark.palette} play-art`} style={bookmark.image ? { backgroundImage: `url(${bookmark.image})` } : undefined} onClick={() => openPlayer(bookmark)} aria-label={`Play ${bookmark.title}`}>
                  <span className="play-badge">▶</span>
                  <span className={bookmark.image ? "visually-hidden" : ""}>{/keepsake|keepseek/i.test(bookmark.domain) ? "Keepseek" : bookmark.mark}</span>
                </button>
              ) : (
                <a href={bookmark.url} target="_blank" rel="noreferrer" className={`art ${bookmark.palette}`} style={bookmark.image ? { backgroundImage: `url(${bookmark.image})` } : undefined} aria-label={`Open ${bookmark.title}`}><span className={bookmark.image ? "visually-hidden" : ""}>{/keepsake|keepseek/i.test(bookmark.domain) ? "Keepseek" : bookmark.mark}</span></a>
              )}
              <div className="card-body">
                <div className="domain"><span>{bookmark.domain}</span><button onClick={() => toggleFavorite(bookmark.id)} aria-label={bookmark.favorite ? "Remove favorite" : "Add favorite"}>{bookmark.favorite ? "♥" : "♡"}</button></div>
                <h3>{playable ? <button type="button" className="title-play" onClick={() => openPlayer(bookmark)}>{bookmark.title}</button> : <a href={bookmark.url} target="_blank" rel="noreferrer">{bookmark.title}</a>}</h3>
                <p className="note">“{bookmark.note}”</p>
                <div className="card-footer"><span className="tag">{bookmark.collection}</span><div className="card-actions">{playable && <button className="load-action play-action" onClick={() => openPlayer(bookmark)}>▶ Play</button>}<button type="button" className={`icon-btn edit-icon-btn edit-${bookmark.palette}`} onClick={() => startEdit(bookmark)} aria-label={`Edit ${bookmark.title}`}><VscEditCompact aria-hidden="true" /></button><button type="button" className={`icon-btn delete-icon-btn delete-${bookmark.palette}`} onClick={() => setDeleteTarget(bookmark)} aria-label={`Delete ${bookmark.title}`}><AiTwotoneDelete aria-hidden="true" /></button><button type="button" className={`icon-btn share-icon-btn share-${bookmark.palette}`} onClick={() => setShareTarget(bookmark)} aria-label={`Share ${bookmark.title}`}><IoShareSocialOutline aria-hidden="true" /></button></div></div>
              </div>
            </article>
          );})}
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
            <span className="modal-icon">{addKind === "playlist" ? "♫" : "↗"}</span>
            <p className="kicker">{addKind === "playlist" ? "NEW PLAYLIST" : "NEW SCRAP"}</p>
            <h2 id="modal-title">{addKind === "playlist" ? "What are you keeping?" : "What caught your eye?"}</h2>
            <p>{addKind === "playlist" ? "Paste a playlist link, video URL, or embed code. We’ll gather its title and source." : "Paste the address. We’ll gather its picture and details."}</p>
            <label>{addKind === "playlist" ? "Playlist, video, or embed" : "Website URL"}
              {addKind === "playlist"
                ? <textarea autoFocus required value={url} onChange={(e) => { setUrl(e.target.value); setCaptureError(""); }} placeholder={"https://open.spotify.com/playlist/...\nhttps://youtube.com/watch?v=...\n<iframe src=\"https://www.youtube.com/embed/...\"></iframe>"} rows={4} />
                : <input autoFocus type="text" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://something.wonderful" />}
            </label>
            {captureError && <p className="form-error" role="alert">{captureError}</p>}
            <button className="primary wide" type="submit">{addKind === "playlist" ? "Open player" : "Gather this page"} <span>→</span></button>
          </form> : step === "player" && captured && capturedEmbed ? <form onSubmit={saveBookmark}>
            <p className="kicker">NOW PLAYING</p><h2 id="modal-title">Preview your playlist.</h2>
            <MediaPlayer title={captured.title} domain={captured.domain} embed={capturedEmbed} />
            <label>Your note<textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you keeping this playlist?" /></label>
            <label>Collection<select value={collection} onChange={(e) => e.target.value === "__new" ? setCollectionOpen(true) : setCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}<option value="__new">＋ New collection…</option></select></label>
            <button className="primary wide" type="submit">Save playlist <span>→</span></button>
          </form> : <form onSubmit={saveBookmark}>
            <p className="kicker">{addKind === "playlist" ? "PLAYLIST FOUND" : "PAGE FOUND"}</p><h2 id="modal-title">Make it yours.</h2>
            <div className="captured-preview"><div className="mini-art">{captured?.mark}</div><div><small>{captured?.domain}</small><strong>{captured?.title}</strong></div><span>✓</span></div>
            <label>Your note<textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={addKind === "playlist" ? "Why are you keeping this playlist?" : "Why are you keeping this?"} /></label>
            <label>Collection<select value={collection} onChange={(e) => e.target.value === "__new" ? setCollectionOpen(true) : setCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}<option value="__new">＋ New collection…</option></select></label>
            <button className="primary wide" type="submit">{addKind === "playlist" ? "Save playlist" : "Tuck it away"} <span>→</span></button>
          </form>}
        </div>
      </div>}

      {playerTarget && getMediaEmbed(playerTarget.url) && <div className="modal-backdrop player-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPlayerTarget(null)}>
        <div className="modal player-modal" role="dialog" aria-modal="true" aria-labelledby="player-title">
          <button className="close" onClick={() => setPlayerTarget(null)} aria-label="Close">×</button>
          <span className="modal-icon">♫</span>
          <p className="kicker">PLAYLIST</p>
          <h2 id="player-title">{playerTarget.title}</h2>
          <MediaPlayer title={playerTarget.title} domain={playerTarget.domain} embed={getMediaEmbed(playerTarget.url)!} />
          {playerTarget.note && <p className="player-note">“{playerTarget.note}”</p>}
          <div className="player-actions">
            <a href={playerTarget.url} target="_blank" rel="noreferrer">Open source <span>↗</span></a>
            <button type="button" onClick={() => setPlayerTarget(null)}>Close player</button>
          </div>
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

      {loadPreview && <div className="modal-backdrop load-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setLoadPreview(null)}>
        <div className="modal load-modal" role="dialog" aria-modal="true" aria-labelledby="load-title">
          <button className="close" onClick={() => setLoadPreview(null)} aria-label="Close">×</button>
          <span className="modal-icon load-icon">◉</span><p className="kicker">VERIFIED MUTHURLOAD</p><h2 id="load-title">{loadPreview.bookmark.title}</h2>
          <p>Open without importing, inspect its lineage, then decide whether to Take Load.</p>
          <div className="load-proof"><div><small>ROOT HASH</small><code>{loadPreview.manifest.hashing.root.slice(0, 20)}…</code></div><span>SHA-256 ✓</span></div>
          <dl className="load-meta"><div><dt>Source</dt><dd>{loadPreview.bookmark.domain}</dd></div><div><dt>Format</dt><dd>MUTHURLOAD {loadPreview.manifest.version}</dd></div><div><dt>Compression</dt><dd>ZIP · Deflate 6</dd></div></dl>
          {loadPreview.content && <pre className="load-content">{loadPreview.content.slice(0, 1_600)}</pre>}
          <button className="primary wide" onClick={takeLoad}>Take Load <span>→</span></button>
        </div>
      </div>}

      {shareTarget && <div className="modal-backdrop share-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeShare()}>
        <div className="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
          <button className="close" onClick={closeShare} aria-label="Close">×</button>
          <span className="modal-icon share-icon">↗</span><p className="kicker">SHARE KNOWLEDGE</p><h2 id="share-title">Send the Load.</h2><p>{shareTarget.title}</p>
          {!shareLink ? <div className="share-options">
            <button onClick={() => shareLoad(shareTarget)} disabled={sharing !== null}><strong>{sharing === "load" ? "PACKING…" : "MUTHURLOAD"}</strong><span>Download the owned, offline `.muthur.load` file.</span></button>
            <button onClick={() => prepareMuthurLink(shareTarget)} disabled={sharing !== null}><strong>{sharing === "link" ? "LINKING…" : "MUTHUR LINK"}</strong><span>Create a zero-install browser link. Anyone with it can read this Load.</span></button>
          </div> : <div className="share-ready"><strong>MUTHUR LINK READY</strong><p>This public-by-possession link contains the complete verified Load.</p><a href={shareLink}>Open in MUTHUR <span>↗</span></a><button onClick={copyPreparedLink}>Copy Link</button></div>}
        </div>
      </div>}

      {editTarget && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditTarget(null)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
          <button className="close" onClick={() => setEditTarget(null)} aria-label="Close">×</button>
          <form onSubmit={saveEdit}>
            <span className="modal-icon">✎</span><p className="kicker">EDIT SCRAP</p><h2 id="edit-title">Tune what you kept.</h2>
            <label>Website URL<input autoFocus type="text" required value={editUrl} onChange={(e) => setEditUrl(e.target.value)} /></label>
            <label>Title<input type="text" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={160} /></label>
            <label>Your note<textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} /></label>
            <label>Collection<select value={editCollection} onChange={(e) => setEditCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="primary wide" type="submit">Save changes <span>→</span></button>
          </form>
        </div>
      </div>}

      {deleteTarget && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
        <div className="modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
          <button className="close" onClick={() => setDeleteTarget(null)} aria-label="Close">×</button>
          <span className="modal-icon delete-icon">×</span><p className="kicker">DELETE SCRAP</p><h2 id="delete-title">Let this one go?</h2>
          <p id="delete-description"><strong>{deleteTarget.title}</strong> will be removed from this device. Exported Loads and JSON backups are not affected.</p>
          <div className="delete-buttons"><button onClick={() => setDeleteTarget(null)}>Keep bookmark</button><button className="danger" onClick={deleteBookmark}>Delete bookmark</button></div>
        </div>
      </div>}
    </main>
  );
}
