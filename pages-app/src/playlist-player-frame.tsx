import { buildPlayerFrameUrl, playerFrameHeight } from "./player-frame-url";
import type { PlaylistPlayback } from "./video-utils";

type PlaylistPlayerFrameProps = {
  playback: PlaylistPlayback;
  title: string;
  sourceUrl?: string;
};

export default function PlaylistPlayerFrame({ playback, title, sourceUrl }: PlaylistPlayerFrameProps) {
  return (
    <iframe
      src={buildPlayerFrameUrl(playback, title, sourceUrl)}
      title={title}
      className="playlist-shell-frame"
      style={{ height: playerFrameHeight(playback) }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
