export function prefersNativeFileShare() {
  if (!navigator.share || !navigator.canShare) return false;
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 768px)").matches;
}

export async function shareFilesNatively(files: File[], title: string, text: string) {
  if (!prefersNativeFileShare()) return false;
  const payload: ShareData & { files?: File[] } = { files, title, text };
  if (!navigator.canShare(payload)) return false;
  await navigator.share(payload);
  return true;
}
