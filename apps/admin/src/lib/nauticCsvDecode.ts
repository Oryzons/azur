/** Décode un export CSV Nautic Manager (UTF-8 ou Latin-1). */
export function decodeCsvBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const latin1 = new TextDecoder('iso-8859-1').decode(bytes).replace(/^\uFEFF/, '');
  const utf8Bad = (utf8.match(/\uFFFD/g) ?? []).length;
  const accent = /[éèêëàâäùûüôöîïçÉÈÊÀÂ]/g;
  const latin1Accents = (latin1.match(accent) ?? []).length;
  const utf8Accents = (utf8.match(accent) ?? []).length;
  if (utf8Bad > 0 || /Ã[©¨ª«»]|â€™|â€"/.test(utf8)) return latin1;
  if (latin1Accents > utf8Accents + 2) return latin1;
  return utf8;
}
