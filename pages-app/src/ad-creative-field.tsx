import { ChangeEvent, DragEvent, useRef, useState } from "react";

type AdCreativeFieldProps = {
  images: string[];
  onChange: (images: string[]) => void;
};

async function readImageFiles(files: FileList | File[]): Promise<string[]> {
  const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
  return Promise.all(imageFiles.map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image file."));
    reader.readAsDataURL(file);
  })));
}

export default function AdCreativeField({ images, onChange }: AdCreativeFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  async function addFiles(fileList: FileList | File[]) {
    const next = await readImageFiles(fileList);
    if (next.length) onChange([...images, ...next]);
  }

  function removeImage(index: number) {
    onChange(images.filter((_, itemIndex) => itemIndex !== index));
  }

  function pickImages(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files?.length) void addFiles(files);
    event.target.value = "";
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  }

  return (
    <div className="ad-creative-field">
      <span className="ad-creative-label">Creative images (optional)</span>
      <div
        className={`ad-creative-drop${dragActive ? " ad-creative-drop-active" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="visually-hidden"
          onChange={pickImages}
        />
        <button type="button" className="ad-creative-add" onClick={() => inputRef.current?.click()}>
          Add images
        </button>
        <p>or drag and drop here</p>
      </div>
      {images.length > 0 && (
        <div className="ad-image-grid" aria-live="polite">
          {images.map((src, index) => (
            <div
              key={`${index}-${src.slice(0, 48)}`}
              className="ad-image-preview"
              style={{ backgroundImage: `url(${src})` }}
              role="img"
              aria-label={`Creative image ${index + 1}`}
            >
              <button
                type="button"
                className="ad-image-remove"
                onClick={() => removeImage(index)}
                aria-label={`Remove image ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
