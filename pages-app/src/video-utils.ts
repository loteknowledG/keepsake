const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/|embed\/)?(\d+)/;
const SPOTIFY_PATTERN = /open\.spotify\.com\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/;

export type VideoEmbedKind = "youtube" | "vimeo" | "spotify" | "direct";

export function parseYouTubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function parseYouTubePlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];

  try {
    const parsed = new URL(normalizeProtocol(url));
    if (parsed.pathname.includes("videoseries")) {
      return parsed.searchParams.get("list");
    }
    if (parsed.pathname === "/playlist") {
      return parsed.searchParams.get("list");
    }
  } catch {
    return null;
  }

  return null;
}

export function parseVimeoId(url: string): string | null {
  const match = url.match(VIMEO_PATTERN);
  return match?.[1] ?? null;
}

export function parseSpotifyEmbed(url: string): { kind: string; id: string } | null {
  const match = url.match(SPOTIFY_PATTERN);
  if (!match?.[1] || !match[2]) return null;
  return { kind: match[1], id: match[2] };
}

export function normalizeSpotifyUri(raw: string): string | null {
  const match = raw.trim().match(/^spotify:(playlist|album|track|episode|show):([A-Za-z0-9]+)/i);
  if (!match) return null;
  return `https://open.spotify.com/${match[1]}/${match[2]}`;
}

export function isYouTubeHost(hostname: string): boolean {
  return (
    hostname === "youtube.com"
    || hostname.endsWith(".youtube.com")
    || hostname === "youtu.be"
    || hostname === "youtube-nocookie.com"
    || hostname.endsWith(".youtube-nocookie.com")
  );
}

export function isVimeoHost(hostname: string): boolean {
  return hostname === "vimeo.com" || hostname.endsWith(".vimeo.com");
}

export function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeProtocol(url.trim()));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function embedNameFromSrc(src: string): string {
  if (parseYouTubePlaylistId(src) && !parseYouTubeId(src)) return "YouTube Playlist";
  if (parseYouTubeId(src)) return "YouTube Video";
  if (parseVimeoId(src)) return "Vimeo Video";
  const spotify = parseSpotifyEmbed(src);
  if (spotify) return `Spotify ${spotify.kind}`;
  try {
    return new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return "Embedded media";
  }
}

export function parseEmbedCode(input: string): { src: string; name: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iframeMatch = trimmed.match(/<iframe[\s\S]*?\ssrc=["']([^"']+)["']/i);
  if (iframeMatch?.[1]) {
    const src = iframeMatch[1].trim();
    if (!isValidVideoUrl(src)) return null;
    return { src, name: embedNameFromSrc(src) };
  }

  if (isValidVideoUrl(trimmed)) {
    return { src: trimmed, name: embedNameFromSrc(trimmed) };
  }

  return null;
}

function applyEmbedPlayerParams(embedSrc: string, autoPlay: boolean, origin?: string): string {
  try {
    const url = new URL(embedSrc);
    url.searchParams.set("autoplay", autoPlay ? "1" : "0");

    if (isYouTubeHost(url.hostname) || parseYouTubeId(embedSrc) || parseYouTubePlaylistId(embedSrc)) {
      url.searchParams.set("enablejsapi", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("modestbranding", "1");
      if (origin) url.searchParams.set("origin", origin);
    }

    if (isVimeoHost(url.hostname) || parseVimeoId(embedSrc)) {
      url.searchParams.set("api", "1");
      url.searchParams.set("autopause", "0");
      url.searchParams.set("byline", "0");
      url.searchParams.set("title", "0");
    }

    return url.toString();
  } catch {
    return embedSrc;
  }
}

export function getVideoEmbedKind(src: string): VideoEmbedKind {
  if (parseYouTubeId(src) || parseYouTubePlaylistId(src)) return "youtube";
  if (parseVimeoId(src)) return "vimeo";
  if (parseSpotifyEmbed(src)) return "spotify";

  try {
    const hostname = new URL(src).hostname;
    if (isYouTubeHost(hostname)) return "youtube";
    if (isVimeoHost(hostname)) return "vimeo";
    if (hostname === "open.spotify.com") return "spotify";
  } catch {
    /* ignore invalid URLs */
  }

  return "direct";
}

export function normalizeEmbedSrc(src: string, autoPlay = false, origin?: string): string {
  const spotifyUri = normalizeSpotifyUri(src);
  const normalized = spotifyUri ?? src;

  const spotify = parseSpotifyEmbed(normalized);
  if (spotify) {
    return `https://open.spotify.com/embed/${spotify.kind}/${spotify.id}`;
  }

  const playlistId = parseYouTubePlaylistId(normalized);
  const youtubeId = parseYouTubeId(normalized);
  if (playlistId && !youtubeId) {
    return applyEmbedPlayerParams(
      `https://www.youtube.com/embed/videoseries?list=${playlistId}`,
      autoPlay,
      origin,
    );
  }
  if (youtubeId) {
    const base = playlistId
      ? `https://www.youtube.com/embed/${youtubeId}?list=${playlistId}`
      : `https://www.youtube.com/embed/${youtubeId}`;
    return applyEmbedPlayerParams(base, autoPlay, origin);
  }

  const vimeoId = parseVimeoId(normalized);
  if (vimeoId) {
    return applyEmbedPlayerParams(`https://player.vimeo.com/video/${vimeoId}`, autoPlay, origin);
  }

  return normalized;
}

export function normalizeProtocol(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function siteMark(domain: string) {
  const rawName = domain.split(".")[0].replace(/[-_]+/g, " ");
  if (/keepsake|keepseek/i.test(rawName)) return "Keepseek";
  return rawName.replace(/\b\w/g, (character) => character.toUpperCase()).slice(0, 18);
}

export function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function metadataFromSrc(src: string) {
  const normalized = normalizeProtocol(src);
  const name = embedNameFromSrc(normalized);
  let domain = "embed";
  try {
    domain = new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    /* keep fallback domain */
  }
  return {
    normalized,
    domain,
    title: name,
    mark: siteMark(domain),
  };
}

export type PlaylistPlayback = {
  metadata: ReturnType<typeof metadataFromSrc>;
  iframeSrc: string;
  embedKind: VideoEmbedKind;
  isPlaylist: boolean;
};

function firstCandidate(raw: string) {
  const trimmed = raw.trim();
  const embed = parseEmbedCode(trimmed);
  if (embed) return embed.src;

  const spotifyUri = normalizeSpotifyUri(trimmed);
  if (spotifyUri) return spotifyUri;

  const firstLine = trimmed.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? trimmed;
  const urlMatch = firstLine.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch?.[0]) return urlMatch[0];

  if (/^[\w.-]+\.[a-z]{2,}/i.test(firstLine)) return normalizeProtocol(firstLine);
  return firstLine;
}

export function resolvePlaylistPlayback(raw: string, origin?: string): PlaylistPlayback {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter a playlist link, video URL, or embed code.");

  const candidate = firstCandidate(trimmed);
  const embedCode = parseEmbedCode(trimmed);
  const src = embedCode?.src ?? candidate;

  if (!isValidVideoUrl(src) && !normalizeSpotifyUri(src)) {
    throw new Error("Enter a valid playlist link, video URL, or embed tag.");
  }

  const metadata = metadataFromSrc(src);
  const playlistId = parseYouTubePlaylistId(src);
  const spotify = parseSpotifyEmbed(src);
  const iframeSrc = normalizeEmbedSrc(src, false, origin);
  const embedKind = getVideoEmbedKind(src);

  return {
    metadata,
    iframeSrc,
    embedKind,
    isPlaylist: Boolean(playlistId) || spotify?.kind === "playlist" || spotify?.kind === "album" || spotify?.kind === "show",
  };
}

export function canPlayMedia(raw: string): boolean {
  try {
    resolvePlaylistPlayback(raw);
    return true;
  } catch {
    return false;
  }
}
