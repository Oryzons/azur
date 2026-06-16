/** URI `tel:` / `sms:` à partir d’un numéro affiché (FR). */
export function phoneToTelUri(phone: string): string {
  const digits = phone.replaceAll(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('33')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+33${digits.slice(1)}`;
  return `+${digits}`;
}

export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
