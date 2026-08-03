import { createRoot } from "react-dom/client";
import PlaylistPlayer from "./playlist-player";
import type { PlaylistPlayback, VideoEmbedKind } from "./video-utils";
import "./style.css";

const embedKinds = ["youtube", "vimeo", "spotify", "direct"] as const;

function isVideoEmbedKind(value: string | null): value is VideoEmbedKind {
  return embedKinds.includes(value as VideoEmbedKind);
}

function parsePlayerRequest():
  | { playback: PlaylistPlayback; title: string; sourceUrl?: string }
  | null {
  const params = new URLSearchParams(window.location.search);
  const src = params.get("src");
  const kind = params.get("kind");
  if (!src || !isVideoEmbedKind(kind)) return null;

  const title = params.get("title") ?? "Playlist";
  const sourceUrl = params.get("source") ?? undefined;
  const domain = params.get("domain") ?? "";

  return {
    playback: {
      iframeSrc: src,
      embedKind: kind,
      isPlaylist: params.get("playlist") === "1",
      metadata: {
        normalized: sourceUrl ?? src,
        domain,
        title,
        mark: params.get("mark") ?? domain.split(".")[0]?.slice(0, 18) ?? "Keepseek",
      },
    },
    title,
    sourceUrl,
  };
}

const parsed = parsePlayerRequest();
const root = document.getElementById("root");

if (!root) {
  throw new Error("Player root element is missing.");
}

createRoot(root).render(
  parsed ? (
    <PlaylistPlayer playback={parsed.playback} title={parsed.title} sourceUrl={parsed.sourceUrl} />
  ) : (
    <p className="player-page-error">Missing or invalid player link.</p>
  ),
);
