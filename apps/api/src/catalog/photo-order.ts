/** Réordonne les URLs pour que la photo de couverture soit en sortOrder 0. */
export function photosWithCoverFirst(urls: string[], coverPhotoIndex = 0): string[] {
  if (urls.length <= 1) return [...urls];
  const idx = Math.min(Math.max(0, coverPhotoIndex), urls.length - 1);
  if (idx === 0) return [...urls];
  const next = [...urls];
  const [cover] = next.splice(idx, 1);
  return [cover, ...next];
}
