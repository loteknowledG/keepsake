import type { MediaEmbed } from "./media-input";

type MediaPlayerProps = {
  title: string;
  domain: string;
  embed: MediaEmbed;
};

export default function MediaPlayer({ title, domain, embed }: MediaPlayerProps) {
  const height = embed.provider === "spotify"
    ? embed.isPlaylist ? 380 : 152
    : embed.provider === "vimeo"
      ? 360
      : embed.isPlaylist ? 450 : 315;

  return (
    <div className="media-player">
      <div className="media-player-frame" style={{ height }}>
        <iframe
          src={embed.embedUrl}
          title={title}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <div className="media-player-meta">
        <small>{domain}</small>
        <strong>{title}</strong>
      </div>
    </div>
  );
}
