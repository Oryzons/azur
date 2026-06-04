export function formatPhoneInput(value: string) {
  // Format intuitif FR: "06 12 34 56 78" (ou "+33 6 12 34 56 78")
  // On limite le nombre de chiffres pour éviter de dépasser.
  const raw = value.trim();
  const hasPlus = raw.startsWith('+');
  const digits = raw.replaceAll(/\D/g, '');

  // France:
  // - format national: 10 chiffres (ex: 0606060606)
  // - format +33: 33 + 9 chiffres (ex: +33 6 06 06 06 06)
  const isFR = hasPlus && digits.startsWith('33');
  const maxDigits = isFR ? 11 : 10;
  const d = digits.slice(0, maxDigits);

  // Simple heuristique France
  // - si +33: +33 X XX XX XX XX
  // - sinon: XX XX XX XX XX (10 chiffres)
  if (hasPlus && d.startsWith('33')) {
    const rest = d.slice(2);
    const parts = [rest.slice(0, 1), rest.slice(1, 3), rest.slice(3, 5), rest.slice(5, 7), rest.slice(7, 9)];
    return `+33 ${parts.filter(Boolean).join(' ')}`.trim();
  }

  // Format par paires
  const pairs: string[] = [];
  for (let i = 0; i < d.length; i += 2) pairs.push(d.slice(i, i + 2));
  return pairs.join(' ').trim();
}

export function phoneToStorage(value: string) {
  const raw = value.trim();
  const digits = raw.replaceAll(/\D/g, '');
  const isFR = raw.startsWith('+') && digits.startsWith('33');
  const maxDigits = isFR ? 11 : 10;
  const clipped = digits.slice(0, maxDigits);
  return clipped ? `+${clipped}` : null;
}

