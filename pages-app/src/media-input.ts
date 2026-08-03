export type MediaMetadata = {
  normalized: string;
  domain: string;
  title: string;
  mark: string;
};

export type MediaEmbed = {
  embedUrl: string;
  provider: "youtube" | "spotify" | "vimeo";
  isPlaylist: boolean;
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function siteMark(domain: string) {
  const rawName = domain.split(".")[0].replace(/[-_]+/g, " ");
  if (/keepsake|keepseek/i.test(rawName)) return "Keepseek";
  return titleCase(rawName).slice(0, 18);
}

function extractEmbedSrc(raw: string): string | null {
  const trimmed = raw.trim();
  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch?.[1]) return iframeMatch[1];
  const embedMatch = trimmed.match(/<embed[^>]+src=["']([^"']+)["']/i);
  if (embedMatch?.[1]) return embedMatch[1];
  const objectMatch = trimmed.match(/<object[^>]+data=["']([^"']+)["']/i);
  if (objectMatch?.[1]) return objectMatch[1];
  const paramMatch = trimmed.match(/<param[^>]+value=["'](https?:[^"']+)["']/i);
  if (paramMatch?.[1]) return paramMatch[1];
  return null;
}

function normalizeYouTube(parsed: URL): MediaMetadata | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    if (!id) return null;
    return {
      normalized: `https://www.youtube.com/watch?v=${id}`,
      domain: "youtube.com",
      title: "YouTube Video",
      mark: "YouTube",
    };
  }
  if (!["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) return null;

  if (parsed.pathname.startsWith("/embed/")) {
    const id = parsed.pathname.split("/").filter(Boolean)[1];
    if (!id) return null;
    return {
      normalized: `https://www.youtube.com/watch?v=${id}`,
      domain: "youtube.com",
      title: "YouTube Video",
      mark: "YouTube",
    };
  }

  if (parsed.pathname === "/playlist" && parsed.searchParams.get("list")) {
    return {
      normalized: parsed.toString(),
      domain: "youtube.com",
      title: "YouTube Playlist",
      mark: "YouTube",
    };
  }

  if (parsed.pathname === "/watch") {
    const videoId = parsed.searchParams.get("v");
    const playlistId = parsed.searchParams.get("list");
    if (playlistId && !videoId) {
      return {
        normalized: parsed.toString(),
        domain: "youtube.com",
        title: "YouTube Playlist",
        mark: "YouTube",
      };
    }
    if (videoId) {
      return {
        normalized: `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ""}`,
        domain: "youtube.com",
        title: playlistId ? "YouTube Playlist" : "YouTube Video",
        mark: "YouTube",
      };
    }
  }

  return null;
}

function normalizeVimeo(parsed: URL): MediaMetadata | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (!["vimeo.com", "player.vimeo.com"].includes(host)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const videoId = host === "player.vimeo.com"
    ? segments[1]
    : segments[0] === "video" ? segments[1] : segments[0];

  if (!videoId || !/^\d+$/.test(videoId)) return null;

  return {
    normalized: `https://vimeo.com/${videoId}`,
    domain: "vimeo.com",
    title: "Vimeo Video",
    mark: "Vimeo",
  };
}

const spotifyKinds = ["playlist", "album", "track", "episode", "show"] as const;
type SpotifyKind = (typeof spotifyKinds)[number];

function normalizeSpotify(parsed: URL): MediaMetadata | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "open.spotify.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const kindIndex = segments.findIndex((segment): segment is SpotifyKind =>
    spotifyKinds.includes(segment as SpotifyKind),
  );
  if (kindIndex === -1) return null;

  const kind = segments[kindIndex] as SpotifyKind;
  const id = segments[kindIndex + 1];
  if (!id) return null;

  const titles: Record<SpotifyKind, string> = {
    playlist: "Spotify Playlist",
    album: "Spotify Album",
    track: "Spotify Track",
    episode: "Spotify Episode",
    show: "Spotify Show",
  };

  return {
    normalized: parsed.toString(),
    domain: "open.spotify.com",
    title: titles[kind],
    mark: "Spotify",
  };
}

function normalizeProtocol(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function metadataFromUrl(rawUrl: string): MediaMetadata {
  const normalized = normalizeProtocol(rawUrl);
  const parsed = new URL(normalized);

  const known = normalizeYouTube(parsed) ?? normalizeVimeo(parsed) ?? normalizeSpotify(parsed);
  if (known) return known;

  const domain = parsed.hostname.replace(/^www\./, "");
  const slug = parsed.pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ");
  const title = slug ? titleCase(slug) : `Something worth keeping from ${domain}`;
  return { normalized: parsed.toString(), domain, title, mark: siteMark(domain) };
}

export function parsePlaylistInput(raw: string): MediaMetadata {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter a playlist link, video URL, or embed code.");

  const embedSrc = extractEmbedSrc(trimmed);
  if (embedSrc) return metadataFromUrl(embedSrc);

  if (/^https?:\/\//i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return metadataFromUrl(trimmed);
  }

  throw new Error("Enter a valid playlist link, video URL, or embed tag.");
}

function getYouTubeEmbed(parsed: URL): MediaEmbed | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) return null;

  if (parsed.pathname.startsWith("/embed/")) {
    const isPlaylist = parsed.pathname.includes("videoseries") || parsed.searchParams.has("list");
    return { embedUrl: parsed.toString(), provider: "youtube", isPlaylist };
  }

  const listId = parsed.searchParams.get("list");
  const videoId = parsed.searchParams.get("v")
    ?? (host === "youtu.be" ? parsed.pathname.split("/").filter(Boolean)[0] : null);

  if (listId && !videoId) {
    return {
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${listId}`,
      provider: "youtube",
      isPlaylist: true,
    };
  }

  if (videoId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}${listId ? `?list=${listId}` : ""}`,
      provider: "youtube",
      isPlaylist: Boolean(listId),
    };
  }

  if (parsed.pathname === "/playlist" && listId) {
    return {
      embedUrl: `https://www.youtube.com/embed/videoseries?list=${listId}`,
      provider: "youtube",
      isPlaylist: true,
    };
  }

  return null;
}

function getSpotifyEmbed(parsed: URL): MediaEmbed | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "open.spotify.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const kindIndex = segments.findIndex((segment): segment is SpotifyKind =>
    spotifyKinds.includes(segment as SpotifyKind),
  );
  if (kindIndex === -1) return null;

  const kind = segments[kindIndex] as SpotifyKind;
  const id = segments[kindIndex + 1];
  if (!id) return null;

  return {
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
    provider: "spotify",
    isPlaylist: kind === "playlist" || kind === "album" || kind === "show",
  };
}

function getVimeoEmbed(parsed: URL): MediaEmbed | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (!["vimeo.com", "player.vimeo.com"].includes(host)) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  const videoId = host === "player.vimeo.com"
    ? segments[1]
    : segments[0] === "video" ? segments[1] : segments[0];

  if (!videoId || !/^\d+$/.test(videoId)) return null;

  return {
    embedUrl: `https://player.vimeo.com/video/${videoId}`,
    provider: "vimeo",
    isPlaylist: false,
  };
}

export function getMediaEmbed(raw: string): MediaEmbed | null {
  try {
    const { normalized } = parsePlaylistInput(raw);
    const parsed = new URL(normalized);
    return getYouTubeEmbed(parsed) ?? getSpotifyEmbed(parsed) ?? getVimeoEmbed(parsed);
  } catch {
    return null;
  }
}
