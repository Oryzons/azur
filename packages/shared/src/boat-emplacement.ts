/** Emplacement portuaire : une lettre + 1 à 3 chiffres (ex. A45, C123). */
export const BOAT_EMPLACEMENT_PATTERN = /^[A-Z]\d{1,3}$/;

/** Formate la saisie en direct (lettre majuscule + jusqu’à 3 chiffres). */
export function formatBoatEmplacementInput(raw: string): string {
  const upper = raw.replace(/\s/g, '').toUpperCase();
  if (!upper) return '';

  const direct = upper.match(/^([A-Z])(\d{0,3})/);
  if (direct) return `${direct[1]}${direct[2] ?? ''}`;

  const letter = upper.match(/[A-Z]/)?.[0];
  if (!letter) return '';
  const digits = upper.slice(upper.indexOf(letter) + 1).replace(/\D/g, '').slice(0, 3);
  return `${letter}${digits}`;
}

/** Retourne un message d’erreur, ou null si vide ou valide. */
export function boatEmplacementValidationError(raw: string | null | undefined): string | null {
  const v = formatBoatEmplacementInput(String(raw ?? ''));
  if (!v) return null;
  if (!BOAT_EMPLACEMENT_PATTERN.test(v)) {
    return 'L’emplacement doit être une lettre suivie de 1 à 3 chiffres (ex. A45, C123).';
  }
  return null;
}
