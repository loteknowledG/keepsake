import { useMemo, useRef, useState } from "react";
import type { PlaylistPlayback, VideoEmbedKind } from "./video-utils";

type PlaylistPlayerProps = {
  playback: PlaylistPlayback;
  title: string;
  sourceUrl?: string;
};

function postEmbedPlay(iframe: HTMLIFrameElement, iframeSrc: string, embedKind: VideoEmbedKind) {
  const win = iframe.contentWindow;
  if (!win) return;

  if (embedKind === "youtube") {
    win.postMessage(JSON.stringify({ event: "command", func: "unMute", args: "", id: 1 }), "*");
    win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: "", id: 1 }), "*");
    return;
  }

  if (embedKind === "vimeo") {
    try {
      win.postMessage(JSON.stringify({ method: "play" }), new URL(iframeSrc).origin);
    } catch {
      /* ignore invalid iframe origin */
    }
  }
}

export default function PlaylistPlayer({ playback, title, sourceUrl }: PlaylistPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const awaitingUserStart = playback.embedKind !== "direct";
  const [started, setStarted] = useState(!awaitingUserStart);
  const height = useMemo(() => {
    if (playback.embedKind === "spotify") return playback.isPlaylist ? 380 : 152;
    return playback.isPlaylist ? 450 : 360;
  }, [playback.embedKind, playback.isPlaylist]);

  const handleStart = () => {
    setStarted(true);
    const iframe = iframeRef.current;
    if (iframe) postEmbedPlay(iframe, playback.iframeSrc, playback.embedKind);
  };

  return (
    <div className="media-player">
      <div className="media-player-frame playlist-player-frame" style={{ height }}>
        <iframe
          ref={iframeRef}
          src={playback.iframeSrc}
          title={title}
          className="playlist-player-iframe"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
        {awaitingUserStart && !started && (
          <button type="button" className="playlist-player-start" onClick={handleStart} aria-label="Start playlist playback">
            <span className="playlist-player-start-icon">▶</span>
            <strong>Click to start playlist</strong>
            <span>Browsers need one tap before embed playback runs.</span>
          </button>
        )}
      </div>
      <div className="media-player-meta">
        <small>{playback.metadata.domain}</small>
        <strong>{title}</strong>
        {sourceUrl && <a className="media-player-open" href={sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}
      </div>
    </div>
  );
}
