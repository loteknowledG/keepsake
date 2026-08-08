"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { openKeepsakeDatabase, saveKeepsakeData, flushKeepsakeData, backupKeepsakeData, loadKeepsakeBackup, type StorageMode } from "./storage";
import { adDestinationUrl, adDomainFromDestination, adPersistUrl, isAdStorageUrl } from "./ad-url";
import { createLoad, createMuthurLink, openLoad, type OpenedLoad } from "./load-format";
import { VscEditCompact } from "react-icons/vsc";
import { AiTwotoneDelete } from "react-icons/ai";
import { IoShareSocialOutline } from "react-icons/io5";
import { canPlayMedia, resolvePlaylistPlayback, type PlaylistPlayback } from "./video-utils";
import PlaylistPlayerFrame from "./playlist-player-frame";
import AdCreativeField from "./ad-creative-field";

export type ScrapKind = "bookmark" | "playlist" | "ad";

export type Bookmark = {
  id: number;
  url: string;
  domain: string;
  title: string;
  note: string;
  collection: string;
  palette: string;
  mark: string;
  kind: ScrapKind;
  favorite?: boolean;
  image?: string;
  images?: string[];
};

function bookmarkImages(bookmark: Pick<Bookmark, "image" | "images">): string[] {
  if (bookmark.images?.length) return bookmark.images;
  if (bookmark.image) return [bookmark.image];
  return [];
}

function primaryImage(bookmark: Pick<Bookmark, "image" | "images">): string | undefined {
  return bookmarkImages(bookmark)[0];
}

function normalizeScrapKind(kind: unknown, collection?: string): ScrapKind {
  if (kind === "bookmark" || kind === "playlist" || kind === "ad") return kind;
  if (collection === "Playlists") return "playlist";
  if (collection === "Ads") return "ad";
  return "bookmark";
}

const starterBookmarks: Bookmark[] = [
  { id: 1, kind: "bookmark", url: "https://www.technologyreview.com", domain: "technologyreview.com", title: "The Future of Small Models", note: "Useful framing for local agents.", collection: "Research", palette: "violet", mark: "MIT", favorite: true, image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80" },
  { id: 2, kind: "bookmark", url: "https://anniemiller.co/lisbon", domain: "anniemiller.co", title: "A quiet weekend in Lisbon", note: "For the fall trip.", collection: "Inspiration", palette: "coral", mark: "AM", image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800&q=80" },
  { id: 3, kind: "bookmark", url: "https://www.are.na/editorial", domain: "are.na", title: "Designing with Memory", note: "Reference for Calyx.", collection: "Inspiration", palette: "sunset", mark: "A", image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80" },
  { id: 4, kind: "bookmark", url: "https://sproutedkitchen.com", domain: "sproutedkitchen.com", title: "Lemon & Ricotta Pasta", note: "Weeknight favorite.", collection: "Reading", palette: "garden", mark: "SK", favorite: true, image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80" },
  { id: 5, kind: "bookmark", url: "https://www.dezeen.com/interiors", domain: "dezeen.com", title: "Cabin Fever Interiors", note: "Materials + lighting inspiration.", collection: "Products", palette: "grid", mark: "D", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=80" },
];

const defaultCollections = ["Research", "Products", "Inspiration", "Reading", "Playlists", "Ads"];

type AddKind = ScrapKind;

function defaultCollectionFor(kind: AddKind): string {
  switch (kind) {
    case "playlist":
      return "Playlists";
    case "ad":
      return "Ads";
    case "bookmark":
      return "Inspiration";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function emptyUrlMessage(kind: AddKind): string {
  switch (kind) {
    case "playlist":
      return "Enter a playlist link, video URL, or embed code.";
    case "ad":
      return "Enter an ad link or landing page URL.";
    case "bookmark":
      return "Enter a website URL.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function defaultNoteFor(kind: AddKind): string {
  switch (kind) {
    case "playlist":
      return "Saved playlist.";
    case "ad":
      return "";
    case "bookmark":
      return "Saved for later.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function brandMark(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "Ad";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function adDomainLabel(destination: string): string {
  return adDomainFromDestination(destination);
}

function normalizeDestinationUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
}

function scrapHasLink(bookmark: Bookmark): boolean {
  if (isAdStorageUrl(bookmark.url)) return false;
  return /^https?:\/\//i.test(bookmark.url.trim());
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

function metadataFor(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const normalized = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [userCollections, setUserCollections] = useState<string[]>(defaultCollections);
  const [hydrated, setHydrated] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>("opfs");
  const [active, setActive] = useState("All scraps");
  const [query, setQuery] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [addKind, setAddKind] = useState<AddKind>("bookmark");
  const [step, setStep] = useState<"url" | "player" | "details" | "compose">("url");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [adHeadline, setAdHeadline] = useState("");
  const [adImages, setAdImages] = useState<string[]>([]);
  const [collection, setCollection] = useState("Inspiration");
  const [captured, setCaptured] = useState<ReturnType<typeof metadataFor> | null>(null);
  const [capturedPlayback, setCapturedPlayback] = useState<PlaylistPlayback | null>(null);
  const [captureError, setCaptureError] = useState("");
  const [playerTarget, setPlayerTarget] = useState<Bookmark | null>(null);
  const [adTarget, setAdTarget] = useState<Bookmark | null>(null);
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
      const backup = loadKeepsakeBackup();
      const nextBookmarks = (stored.bookmarks.length
        ? stored.bookmarks
        : backup?.bookmarks.length
          ? backup.bookmarks
          : legacyBookmarks
            ? JSON.parse(legacyBookmarks)
            : starterBookmarks)
        .map((item: Bookmark) => ({
          ...item,
          kind: normalizeScrapKind(item.kind, item.collection),
        }))
        .map(repairAdBookmark);
      const nextCollections = stored.collections.length
        ? stored.collections
        : backup?.collections.length
          ? backup.collections
          : legacyCollections
            ? JSON.parse(legacyCollections)
            : defaultCollections;
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
      const backup = loadKeepsakeBackup();
      const nextBookmarks = (backup?.bookmarks.length ? backup.bookmarks : starterBookmarks)
        .map((item: Bookmark) => ({
          ...item,
          kind: normalizeScrapKind(item.kind, item.collection),
        }))
        .map(repairAdBookmark);
      const nextCollections = backup?.collections.length ? backup.collections : defaultCollections;
      setBookmarks(nextBookmarks);
      setUserCollections(nextCollections);
      setStorageReady(true);
      setHydrated(true);
      setNotice("SQLite could not start. Changes are saved to this browser's local backup.");
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !storageReady) return;
    saveKeepsakeData(bookmarks, userCollections).catch(() => setNotice("SQLite could not save that change. Export a JSON backup."));
  }, [bookmarks, userCollections, hydrated, storageReady]);

  useEffect(() => {
    function onPageHide() {
      backupKeepsakeData(bookmarks, userCollections);
      void flushKeepsakeData();
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [bookmarks, userCollections]);

  function persistNow(nextBookmarks: Bookmark[], nextCollections: string[] = userCollections) {
    if (!hydrated || !storageReady) return;
    void saveKeepsakeData(nextBookmarks, nextCollections).catch(() => {
      setNotice("Could not save to SQLite. A local browser backup was kept.");
    });
  }

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

  function playbackFor(raw: string): PlaylistPlayback | null {
    try {
      return resolvePlaylistPlayback(raw, window.location.origin);
    } catch {
      return null;
    }
  }

  const playerPlayback = useMemo(
    () => (playerTarget ? playbackFor(playerTarget.url) : null),
    [playerTarget],
  );

  function startCapture(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    setCaptureError("");
    if (!trimmed) {
      const message = emptyUrlMessage(addKind);
      setCaptureError(message);
      setNotice(message);
      return;
    }
    try {
      if (addKind === "playlist") {
        const playback = resolvePlaylistPlayback(trimmed, window.location.origin);
        setCaptured(playback.metadata);
        setCapturedPlayback(playback);
        setStep("player");
        return;
      }
      setCaptured(metadataFor(trimmed));
      setStep("details");
    } catch (error) {
      setCaptured(null);
      setCapturedPlayback(null);
      const message = error instanceof Error ? error.message : "Enter a valid link or embed code.";
      setCaptureError(message);
      setNotice(message);
    }
  }

  function saveAdCompose(event: FormEvent) {
    event.preventDefault();
    const headline = adHeadline.trim();
    const copy = note.trim();
    setCaptureError("");
    if (!headline) {
      setCaptureError("Enter a headline for this ad.");
      return;
    }
    if (!copy) {
      setCaptureError("Write the ad copy.");
      return;
    }
    let destination = "";
    if (url.trim()) {
      try {
        destination = normalizeDestinationUrl(url);
        new URL(destination);
      } catch {
        setCaptureError("Enter a valid destination URL, or leave it blank.");
        return;
      }
    }
    const palettes = ["sunset", "grid", "violet", "coral", "garden"];
    const finalCollection = collection || defaultCollectionFor("ad");
    const nextCollections = userCollections.includes(finalCollection)
      ? userCollections
      : [...userCollections, finalCollection];
    const newId = Date.now();
    const saved: Bookmark = {
      id: newId,
      url: adPersistUrl(newId, destination),
      domain: adDomainLabel(destination),
      title: headline,
      note: copy,
      collection: finalCollection,
      palette: palettes[bookmarks.length % palettes.length],
      mark: brandMark(headline),
      kind: "ad",
      image: adImages[0],
      images: adImages.length ? adImages : undefined,
    };
    const nextBookmarks = [saved, ...bookmarks];
    if (nextCollections.length !== userCollections.length) setUserCollections(nextCollections);
    setBookmarks(nextBookmarks);
    setActive(finalCollection);
    setNotice(`Created ${headline}.`);
    persistNow(nextBookmarks, nextCollections);
    closeModal();
  }

  function saveBookmark(event: FormEvent) {
    event.preventDefault();
    if (!captured) return;
    const palettes = ["sunset", "grid", "violet", "coral", "garden"];
    const finalCollection = collection || defaultCollectionFor(addKind);
    if (!userCollections.includes(finalCollection)) {
      setUserCollections((items) => [...items, finalCollection]);
    }
    const newId = Date.now();
    const saved: Bookmark = {
      id: newId,
      url: captured.normalized,
      domain: captured.domain,
      title: captured.title,
      note: note || defaultNoteFor(addKind),
      collection: finalCollection,
      palette: palettes[bookmarks.length % palettes.length],
      mark: captured.mark,
      kind: addKind,
    };
    setBookmarks((items) => [saved, ...items]);
    if (addKind === "playlist" && capturedPlayback) {
      setActive(finalCollection);
      setPlayerTarget(saved);
    }
    closeModal();
  }

  function openPlayer(bookmark: Bookmark) {
    if (!canPlayMedia(bookmark.url)) return;
    setPlayerTarget(bookmark);
  }

  function openAd(bookmark: Bookmark) {
    if (bookmark.kind !== "ad") return;
    setAdTarget(bookmark);
  }

  function openAdd(kind: AddKind) {
    setAddKind(kind);
    setCollection(defaultCollectionFor(kind));
    setStep(kind === "ad" ? "compose" : "url");
    setUrl("");
    setNote("");
    setAdHeadline("");
    setAdImages([]);
    setCaptured(null);
    setCapturedPlayback(null);
    setCaptureError("");
    setOpen(true);
    setAddMenuOpen(false);
  }

  function closeModal() {
    setOpen(false);
    setStep("url");
    setUrl("");
    setNote("");
    setAdHeadline("");
    setAdImages([]);
    setCaptured(null);
    setCapturedPlayback(null);
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
    if (bookmark.kind === "ad") {
      setAdImages(bookmarkImages(bookmark));
    }
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    const title = editTitle.trim();
    if (!title) return;

    if (editTarget.kind === "ad") {
      const copy = editNote.trim();
      if (!copy) {
        setNotice("Ad copy is required.");
        return;
      }
      let destination = "";
      if (editUrl.trim()) {
        try {
          destination = normalizeDestinationUrl(editUrl);
          new URL(destination);
        } catch {
          setNotice("Enter a valid destination URL, or leave it blank.");
          return;
        }
      }
      setBookmarks((items) => items.map((item) => item.id === editTarget.id ? {
        ...item,
        url: adPersistUrl(editTarget.id, destination),
        domain: adDomainLabel(destination),
        mark: brandMark(title),
        title,
        note: copy,
        collection: editCollection,
        image: adImages[0],
        images: adImages.length ? adImages : undefined,
      } : item));
      setEditTarget(null);
      setNotice(`Updated ${title}.`);
      return;
    }

    try {
      const metadata = metadataFor(editUrl);
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
    const incoming: Bookmark = {
      ...loadPreview.bookmark,
      id: Date.now(),
      kind: normalizeScrapKind(loadPreview.bookmark.kind, loadPreview.bookmark.collection),
    };
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
        kind: normalizeScrapKind(item.kind, item.collection),
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
              disabled={!hydrated}
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
                <button type="button" role="menuitem" onClick={() => openAdd("ad")}>
                  <strong>Ad</strong>
                  <span>Headline, copy, and optional creative.</span>
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
          {!hydrated ? (
            <div className="empty"><span>◷</span><h3>Loading your library…</h3><p>Fetching scraps saved on this device.</p></div>
          ) : visible.map((bookmark, index) => {
            const isAd = bookmark.kind === "ad";
            const playable = bookmark.kind === "playlist" && (canPlayMedia(bookmark.url) || bookmark.collection === "Playlists");
            const linked = !isAd && scrapHasLink(bookmark);
            const images = bookmarkImages(bookmark);
            const coverImage = primaryImage(bookmark);
            const artStyle = coverImage ? { backgroundImage: `url(${coverImage})` } : undefined;
            const artMark = isAd ? bookmark.mark : /keepsake|keepseek/i.test(bookmark.domain) ? "Keepseek" : bookmark.mark;
            return (
            <article className={`bookmark-card tilt-${index % 4}${playable ? " playable" : ""}${isAd ? " ad-card" : ""}`} key={bookmark.id}>
              {playable ? (
                <button type="button" className={`art ${bookmark.palette} play-art`} style={artStyle} onClick={() => openPlayer(bookmark)} aria-label={`Play ${bookmark.title}`}>
                  <span className="play-badge">▶</span>
                  <span className={coverImage ? "visually-hidden" : ""}>{artMark}</span>
                </button>
              ) : isAd ? (
                <button type="button" className={`art ${bookmark.palette} view-art`} style={artStyle} onClick={() => openAd(bookmark)} aria-label={`View ${bookmark.title}`}>
                  <span className="view-badge">◎</span>
                  {images.length > 1 && <span className="ad-image-count">+{images.length - 1}</span>}
                  <span className={coverImage ? "visually-hidden" : ""}>{artMark}</span>
                </button>
              ) : linked ? (
                <a href={bookmark.url} target="_blank" rel="noreferrer" className={`art ${bookmark.palette}`} style={artStyle} aria-label={`Open ${bookmark.title}`}>
                  <span className={coverImage ? "visually-hidden" : ""}>{artMark}</span>
                </a>
              ) : (
                <div className={`art ${bookmark.palette} art-static`} style={artStyle} aria-hidden={coverImage ? undefined : true}>
                  <span className={coverImage ? "visually-hidden" : ""}>{artMark}</span>
                </div>
              )}
              <div className="card-body">
                <div className="domain"><span>{bookmark.domain}</span><button onClick={() => toggleFavorite(bookmark.id)} aria-label={bookmark.favorite ? "Remove favorite" : "Add favorite"}>{bookmark.favorite ? "♥" : "♡"}</button></div>
                <h3>{playable ? <button type="button" className="title-play" onClick={() => openPlayer(bookmark)}>{bookmark.title}</button> : isAd ? <button type="button" className="title-play" onClick={() => openAd(bookmark)}>{bookmark.title}</button> : linked ? <a href={bookmark.url} target="_blank" rel="noreferrer">{bookmark.title}</a> : <span>{bookmark.title}</span>}</h3>
                <p className="note">“{bookmark.note}”</p>
                <div className="card-footer"><span className="tag">{bookmark.collection}</span><span className="tag tag-kind">{bookmark.kind}</span><div className="card-actions">{playable && <button className="load-action play-action" onClick={() => openPlayer(bookmark)}>▶ Play</button>}{isAd && <button type="button" className="load-action view-action" onClick={() => openAd(bookmark)}>◎ View</button>}<button type="button" className={`icon-btn edit-icon-btn edit-${bookmark.palette}`} onClick={() => startEdit(bookmark)} aria-label={`Edit ${bookmark.title}`}><VscEditCompact aria-hidden="true" /></button><button type="button" className={`icon-btn delete-icon-btn delete-${bookmark.palette}`} onClick={() => setDeleteTarget(bookmark)} aria-label={`Delete ${bookmark.title}`}><AiTwotoneDelete aria-hidden="true" /></button><button type="button" className={`icon-btn share-icon-btn share-${bookmark.palette}`} onClick={() => setShareTarget(bookmark)} aria-label={`Share ${bookmark.title}`}><IoShareSocialOutline aria-hidden="true" /></button></div></div>
              </div>
            </article>
          );})}
          {hydrated && visible.length === 0 && <div className="empty"><span>✦</span><h3>No scraps hiding here.</h3><p>Try another collection or save something new.</p></div>}
        </div>
      </section>

      <section className="how" id="about"><p className="kicker">THE QUIET MAGIC</p><h2>Paste. Pause. Remember.</h2><div className="steps"><div><b>01</b><h3>Drop a link</h3><p>Any article, product, video, or corner of the web.</p></div><div><b>02</b><h3>We gather the pieces</h3><p>Title, image, description, and source appear automatically.</p></div><div><b>03</b><h3>Add what matters</h3><p>Leave a thought in your own words and find it later.</p></div></div></section>

      <footer><span className="brand">Keepseek</span><p>Made for curious minds and gloriously open tabs.</p></footer>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

      {open && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
        <div className={`modal${step === "player" ? " player-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="close" onClick={closeModal} aria-label="Close">×</button>
          {step === "compose" ? <form onSubmit={saveAdCompose} noValidate>
            <span className="modal-icon">◎</span>
            <p className="kicker">CREATE AD</p>
            <h2 id="modal-title">Build your ad.</h2>
            <p>Write the headline, copy, and an optional image or link.</p>
            <label>Headline<input autoFocus required value={adHeadline} onChange={(e) => { setAdHeadline(e.target.value); setCaptureError(""); }} placeholder="e.g. Wake up slow." maxLength={160} /></label>
            <label>Ad copy<textarea required value={note} onChange={(e) => { setNote(e.target.value); setCaptureError(""); }} placeholder="The message you want people to remember." rows={4} /></label>
            <label>Destination URL (optional)<input type="text" value={url} onChange={(e) => { setUrl(e.target.value); setCaptureError(""); }} placeholder="https://brand.com/offer" /></label>
            <AdCreativeField images={adImages} onChange={setAdImages} />
            <label>Collection<select value={collection} onChange={(e) => e.target.value === "__new" ? setCollectionOpen(true) : setCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}<option value="__new">＋ New collection…</option></select></label>
            {captureError && <p className="form-error" role="alert">{captureError}</p>}
            <button className="primary wide" type="submit">Create ad <span>→</span></button>
          </form> : step === "url" ? <form onSubmit={startCapture} noValidate>
            <span className="modal-icon">{addKind === "playlist" ? "♫" : "↗"}</span>
            <p className="kicker">{addKind === "playlist" ? "NEW PLAYLIST" : "NEW SCRAP"}</p>
            <h2 id="modal-title">{addKind === "playlist" ? "What are you keeping?" : "What caught your eye?"}</h2>
            <p>{addKind === "playlist" ? "Paste a playlist link, video URL, or embed code. We’ll gather its title and source." : "Paste the address. We’ll gather its picture and details."}</p>
            <label>{addKind === "playlist" ? "Playlist, video, or embed" : "Website URL"}
              {addKind === "playlist"
                ? <textarea autoFocus required value={url} onChange={(e) => { setUrl(e.target.value); setCaptureError(""); }} placeholder={"https://open.spotify.com/playlist/...\nhttps://youtube.com/watch?v=...\n<iframe src=\"https://www.youtube.com/embed/...\"></iframe>"} rows={4} />
                : <input autoFocus type="text" required value={url} onChange={(e) => { setUrl(e.target.value); setCaptureError(""); }} placeholder="https://something.wonderful" />}
            </label>
            {captureError && <p className="form-error" role="alert">{captureError}</p>}
            <button className="primary wide" type="submit">{addKind === "playlist" ? "Open player" : "Gather this page"} <span>→</span></button>
          </form> : step === "player" && captured && capturedPlayback ? <form onSubmit={saveBookmark}>
            <p className="kicker">NOW PLAYING</p><h2 id="modal-title">Preview your playlist.</h2>
            <PlaylistPlayerFrame playback={capturedPlayback} title={captured.title} sourceUrl={captured.normalized} />
            <label>Your note<textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why are you keeping this playlist?" /></label>
            <label>Collection<select value={collection} onChange={(e) => e.target.value === "__new" ? setCollectionOpen(true) : setCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}<option value="__new">＋ New collection…</option></select></label>
            <button className="primary wide" type="submit">Save playlist <span>→</span></button>
          </form> : step === "details" ? <form onSubmit={saveBookmark}>
            <p className="kicker">{addKind === "playlist" ? "PLAYLIST FOUND" : "PAGE FOUND"}</p><h2 id="modal-title">Make it yours.</h2>
            <div className="captured-preview"><div className="mini-art">{captured?.mark}</div><div><small>{captured?.domain}</small><strong>{captured?.title}</strong></div><span>✓</span></div>
            <label>Your note<textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={addKind === "playlist" ? "Why are you keeping this playlist?" : "Why are you keeping this?"} /></label>
            <label>Collection<select value={collection} onChange={(e) => e.target.value === "__new" ? setCollectionOpen(true) : setCollection(e.target.value)}>{userCollections.map((item) => <option key={item}>{item}</option>)}<option value="__new">＋ New collection…</option></select></label>
            <button className="primary wide" type="submit">{addKind === "playlist" ? "Save playlist" : "Tuck it away"} <span>→</span></button>
          </form> : null}
        </div>
      </div>}

      {playerTarget && playerPlayback && <div className="modal-backdrop player-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPlayerTarget(null)}>
        <div className="modal player-modal" role="dialog" aria-modal="true" aria-labelledby="player-title">
          <button className="close" onClick={() => setPlayerTarget(null)} aria-label="Close">×</button>
          <span className="modal-icon">♫</span>
          <p className="kicker">PLAYLIST</p>
          <h2 id="player-title">{playerTarget.title}</h2>
          <PlaylistPlayerFrame playback={playerPlayback} title={playerTarget.title} sourceUrl={playerTarget.url} />
          {playerTarget.note && <p className="player-note">“{playerTarget.note}”</p>}
          <div className="player-actions">
            <a href={playerTarget.url} target="_blank" rel="noreferrer">Open source <span>↗</span></a>
            <button type="button" onClick={() => setPlayerTarget(null)}>Close player</button>
          </div>
        </div>
      </div>}

      {adTarget && (() => {
        const images = bookmarkImages(adTarget);
        const linked = scrapHasLink(adTarget);
        return (
          <div className="modal-backdrop ad-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setAdTarget(null)}>
            <div className="modal ad-modal" role="dialog" aria-modal="true" aria-labelledby="ad-title">
              <button className="close" onClick={() => setAdTarget(null)} aria-label="Close">×</button>
              <span className="modal-icon ad-view-icon">◎</span>
              <p className="kicker">AD</p>
              <p className="ad-view-domain">{adTarget.domain}</p>
              <h2 id="ad-title">{adTarget.title}</h2>
              <p className="ad-view-copy">“{adTarget.note}”</p>
              {images.length > 0 ? (
                <div className="ad-view-gallery">
                  {images.map((src, imageIndex) => (
                    <img key={`${imageIndex}-${src.slice(0, 48)}`} src={src} alt={`${adTarget.title} creative ${imageIndex + 1}`} />
                  ))}
                </div>
              ) : (
                <div className={`ad-view-placeholder art ${adTarget.palette}`} aria-hidden="true"><span>{adTarget.mark}</span></div>
              )}
              <div className="player-actions">
                {linked && <a href={adTarget.url} target="_blank" rel="noreferrer">Open link <span>↗</span></a>}
                <button type="button" onClick={() => { setAdTarget(null); startEdit(adTarget); }}>Edit ad</button>
                <button type="button" onClick={() => setAdTarget(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

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
          <span className="modal-icon share-icon">↗</span><p className="kicker">SHARE KNOWLEDGE</p><h2 id="share-title">Shoot the Load.</h2><p>{shareTarget.title}</p>
          {!shareLink ? <div className="share-options">
            <button onClick={() => shareLoad(shareTarget)} disabled={sharing !== null}><strong>{sharing === "load" ? "PACKING…" : "muthur.load"}</strong><span>Download the owned, offline `.muthur.load` file.</span></button>
            <button onClick={() => prepareMuthurLink(shareTarget)} disabled={sharing !== null}><strong>{sharing === "link" ? "LINKING…" : "muthur.link"}</strong><span>Create a zero-install browser link. Anyone with it can read this Load.</span></button>
          </div> : <div className="share-ready"><strong>muthur.link ready</strong><p>This public-by-possession link contains the complete verified Load.</p><a href={shareLink}>Open muthur.link <span>↗</span></a><button onClick={copyPreparedLink}>Copy Link</button></div>}
        </div>
      </div>}

      {editTarget && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditTarget(null)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
          <button className="close" onClick={() => setEditTarget(null)} aria-label="Close">×</button>
          <form onSubmit={saveEdit}>
            <span className="modal-icon">✎</span><p className="kicker">{editTarget.kind === "ad" ? "EDIT AD" : "EDIT SCRAP"}</p><h2 id="edit-title">{editTarget.kind === "ad" ? "Revise your ad." : "Tune what you kept."}</h2>
            {editTarget.kind === "ad" ? <>
              <label>Headline<input autoFocus type="text" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={160} /></label>
              <label>Ad copy<textarea required value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={4} /></label>
              <label>Destination URL (optional)<input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://brand.com/offer" /></label>
              <AdCreativeField images={adImages} onChange={setAdImages} />
            </> : <>
              <label>Website URL<input autoFocus type="text" required value={editUrl} onChange={(e) => setEditUrl(e.target.value)} /></label>
              <label>Title<input type="text" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={160} /></label>
              <label>Your note<textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} /></label>
            </>}
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
