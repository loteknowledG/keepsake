import type { PlaylistPlayback } from "./video-utils";

export function playerFrameHeight(playback: PlaylistPlayback): number {
  const mediaHeight = playback.embedKind === "spotify"
    ? playback.isPlaylist ? 380 : 152
    : playback.isPlaylist ? 450 : 360;
  return mediaHeight + 88;
}

export function buildPlayerFrameUrl(playback: PlaylistPlayback, title: string, sourceUrl?: string): string {
  const params = new URLSearchParams({
    src: playback.iframeSrc,
    kind: playback.embedKind,
    playlist: playback.isPlaylist ? "1" : "0",
    title,
    domain: playback.metadata.domain,
    mark: playback.metadata.mark,
  });
  if (sourceUrl) params.set("source", sourceUrl);
  return `/player.html?${params.toString()}`;
}
