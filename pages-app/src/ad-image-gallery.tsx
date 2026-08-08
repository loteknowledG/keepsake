import { useEffect } from "react";

type AdImageGalleryProps = {
  images: string[];
  index: number;
  title: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export default function AdImageGallery({ images, index, title, onClose, onIndexChange }: AdImageGalleryProps) {
  const hasMultiple = images.length > 1;
  const current = images[index];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (!hasMultiple) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange((index - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange((index + 1) % images.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasMultiple, images.length, index, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div className="gallery-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="gallery-stage" role="dialog" aria-modal="true" aria-label={`${title} image gallery`}>
        <button type="button" className="gallery-close" onClick={onClose} aria-label="Close gallery">×</button>
        {hasMultiple && (
          <button
            type="button"
            className="gallery-nav gallery-prev"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}
        <figure className="gallery-frame">
          <img src={current} alt={`${title} creative ${index + 1} of ${images.length}`} />
          <figcaption>{index + 1} / {images.length}</figcaption>
        </figure>
        {hasMultiple && (
          <button
            type="button"
            className="gallery-nav gallery-next"
            onClick={() => onIndexChange((index + 1) % images.length)}
            aria-label="Next image"
          >
            ›
          </button>
        )}
        {hasMultiple && (
          <div className="gallery-thumbs" aria-label="Gallery thumbnails">
            {images.map((src, thumbIndex) => (
              <button
                key={`${thumbIndex}-${src.slice(0, 48)}`}
                type="button"
                className={thumbIndex === index ? "active" : ""}
                onClick={() => onIndexChange(thumbIndex)}
                aria-label={`Show image ${thumbIndex + 1}`}
                aria-current={thumbIndex === index ? "true" : undefined}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
