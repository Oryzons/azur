/** Import clients depuis l’export CSV Nautic Manager. */

export type NauticManagerImportRowStatus = 'ready' | 'existing' | 'invalid' | 'duplicate_in_file';

export type NauticManagerMappedClient = {
  line: number;
  status: NauticManagerImportRowStatus;
  statusReason?: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  civility: 'NONE' | 'M' | 'MME' | 'MX' | null;
  clientType: 'PARTICULIER' | 'PROFESSIONNEL' | 'ASSOCIATION' | null;
  birthDate: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  internalNote: string | null;
};

/** Décode un export CSV (UTF-8 ou Latin-1 / Windows français). */
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

const HEADER_ALIASES: Record<string, string> = {
  civilite: 'civility',
  civilit: 'civility',
  prenom: 'firstName',
  'prenom client': 'firstName',
  prnom: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  nom: 'lastName',
  'nom client': 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  'nom de famille': 'lastName',
  'date de naissance': 'birthDate',
  'date naissance': 'birthDate',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  telephone: 'phone',
  tlphone: 'phone',
  tel: 'phone',
  mobile: 'phone',
  portable: 'phone',
  'telephone portable': 'phone',
  gsm: 'phone',
  'type de client': 'clientType',
  'type client': 'clientType',
  'raison sociale': 'companyName',
  'n tva': 'vatNumber',
  'no tva': 'vatNumber',
  'numero tva': 'vatNumber',
  adresse: 'address',
  'complement d adresse': 'addressLine2',
  'compl ment d adresse': 'addressLine2',
  'code postal': 'postalCode',
  ville: 'city',
  etat: 'state',
  pays: 'country',
  nationalite: 'nationality',
  nationalit: 'nationality',
  source: 'source',
  'type de permis': 'licenseType',
  'type permis': 'licenseType',
  'annee d obtention du permis': 'licenseYear',
  'annee obtention permis': 'licenseYear',
  'nombre de reservations': 'reservationCount',
  'nombre reservations': 'reservationCount',
  note: 'note',
  'date de creation': 'createdAtExternal',
  'date creation': 'createdAtExternal',
  id: 'externalId',
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[''´`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveHeaderKey(header: string): string | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  const compact = norm.replace(/\s+/g, '');
  if (HEADER_ALIASES[norm]) return HEADER_ALIASES[norm];
  if (HEADER_ALIASES[compact]) return HEADER_ALIASES[compact];
  if (compact.includes('prenom') || compact.includes('firstname')) return 'firstName';
  if (compact === 'nom' || compact.includes('lastname') || compact.includes('nomfamille')) return 'lastName';
  if (compact.includes('email') || compact.includes('courriel') || compact === 'mail') return 'email';
  if (
    compact.includes('telephone') ||
    compact.includes('tel') ||
    compact.includes('phone') ||
    compact.includes('mobile') ||
    compact.includes('portable') ||
    compact.includes('gsm')
  )
    return 'phone';
  if (norm.includes('civil')) return 'civility';
  if (norm.includes('naissance')) return 'birthDate';
  if (norm.includes('adresse') && !norm.includes('complement')) return 'address';
  if (norm.includes('complement') && norm.includes('adresse')) return 'addressLine2';
  if (norm.includes('postal') || norm.includes('cp')) return 'postalCode';
  if (norm.includes('ville') || norm === 'city') return 'city';
  if (norm.includes('pays') || norm === 'country') return 'country';
  if (norm.includes('nationalit')) return 'nationality';
  if (norm.includes('type') && norm.includes('client')) return 'clientType';
  if (norm === 'id' || norm.endsWith(' id') || norm.startsWith('id ')) return null;
  if (norm.includes('source') || norm.includes('permis') || norm.includes('reservation')) return null;
  if (norm.includes('creation') || norm.includes('tva') || norm.includes('raison')) return null;
  return null;
}

function fixImportedText(value: string): string {
  return value
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectDelimiter(line: string): ',' | ';' {
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  return semi > comma ? ';' : ',';
}

/** Parse une ligne CSV (guillemets doubles). */
function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function mapCivility(raw: string): 'NONE' | 'M' | 'MME' | 'MX' | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'n/c' || v === 'nc') return 'NONE';
  if (v.startsWith('mme') || v === 'madame' || v === 'melle' || v === 'mlle') return 'MME';
  if (v === 'mx') return 'MX';
  if (v.startsWith('m') || v === 'monsieur' || v === 'mr') return 'M';
  return null;
}

function mapClientType(raw: string): 'PARTICULIER' | 'PROFESSIONNEL' | 'ASSOCIATION' | null {
  const v = raw.trim().toLowerCase();
  if (!v) return 'PARTICULIER';
  if (v.includes('profession') || v.includes('pro')) return 'PROFESSIONNEL';
  if (v.includes('associ')) return 'ASSOCIATION';
  if (v.includes('particul')) return 'PARTICULIER';
  return 'PARTICULIER';
}

function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e || !e.includes('@') || e.length < 5) return null;
  return e;
}

function normalizeBirthDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** 33782591174 → 0782591174 */
function toFrenchNationalDigits(digits: string): string | null {
  let d = digits.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0033')) d = d.slice(2);
  if (d.startsWith('33')) {
    const rest = d.slice(2);
    if (rest.length === 9) return `0${rest}`;
    if (rest.length === 10 && rest.startsWith('0')) return rest;
  }
  if (d.startsWith('0') && d.length === 10) return d;
  if (d.length === 9 && /^[67]/.test(d)) return `0${d}`;
  if (d.length === 10 && /^[67]/.test(d)) return `0${d}`;
  return null;
}

/** Format affichage FR : 07 82 59 11 74 */
function formatFrenchPhoneDisplay(national: string): string {
  const d = national.replace(/\D/g, '').slice(0, 10);
  if (d.length !== 10 || !d.startsWith('0')) return national;
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].join(' ');
}

function normalizePhone(raw: string): string | null {
  const national = toFrenchNationalDigits(raw);
  if (!national) return null;
  return formatFrenchPhoneDisplay(national);
}

export function parseNauticManagerCsv(csvText: string): {
  rows: Record<string, string>[];
  parseError?: string;
} {
  const text = csvText.replace(/^\uFEFF/, '').trim();
  if (!text) return { rows: [], parseError: 'Fichier vide.' };

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], parseError: 'Le fichier doit contenir une ligne d’en-tête et au moins une ligne de données.' };

  const delimiter = detectDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter);
  const fieldKeys = headers.map((h) => resolveHeaderKey(h));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!, delimiter);
    const row: Record<string, string> = {};
    for (let c = 0; c < fieldKeys.length; c++) {
      const key = fieldKeys[c];
      if (!key || key === 'createdAtExternal' || key === 'externalId') continue;
      row[key] = fixImportedText(cells[c] ?? '');
    }
    const hasData = Object.values(row).some((v) => v.length > 0);
    if (hasData) rows.push(row);
  }

  return { rows };
}

function buildClientFields(raw: Record<string, string>) {
  const firstName = fixImportedText(raw.firstName ?? '');
  const lastName = fixImportedText(raw.lastName ?? '');
  const companyName = fixImportedText(raw.companyName ?? '');
  const addressParts = [raw.address, raw.addressLine2].filter((x) => x?.trim());
  let resolvedFirst = firstName;
  let resolvedLast = lastName;
  if (!resolvedFirst && companyName) resolvedFirst = companyName;
  if (!resolvedLast && companyName) resolvedLast = companyName;

  return {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    phone: normalizePhone(raw.phone ?? ''),
    civility: mapCivility(raw.civility ?? ''),
    clientType: mapClientType(raw.clientType ?? ''),
    birthDate: normalizeBirthDate(raw.birthDate ?? ''),
    nationality: fixImportedText(raw.nationality ?? '') || null,
    address: addressParts.length ? addressParts.join(', ') : null,
    city: fixImportedText(raw.city ?? '') || null,
    postalCode: fixImportedText(raw.postalCode ?? '') || null,
    country: fixImportedText(raw.country ?? '') || null,
    internalNote: null as string | null,
  };
}

export function mapNauticManagerRow(
  raw: Record<string, string>,
  line: number,
  existingEmails: ReadonlySet<string>,
  seenInFile: Set<string>,
): NauticManagerMappedClient {
  const email = normalizeEmail(raw.email ?? '');
  const fields = buildClientFields(raw);

  if (!email) {
    return {
      line,
      status: 'invalid',
      statusReason: 'Email manquant ou invalide',
      email: null,
      firstName: fields.firstName,
      lastName: fields.lastName,
      phone: fields.phone,
      civility: fields.civility,
      clientType: fields.clientType,
      birthDate: fields.birthDate,
      nationality: fields.nationality,
      address: fields.address,
      city: fields.city,
      postalCode: fields.postalCode,
      country: fields.country,
      internalNote: null,
    };
  }

  if (seenInFile.has(email)) {
    return {
      line,
      status: 'duplicate_in_file',
      statusReason: 'Doublon dans le fichier',
      email,
      ...fields,
    };
  }
  seenInFile.add(email);

  if (existingEmails.has(email)) {
    return {
      line,
      status: 'existing',
      statusReason: 'Déjà présent sur le site',
      email,
      ...fields,
    };
  }

  if (!fields.firstName || !fields.lastName) {
    return {
      line,
      status: 'invalid',
      statusReason: !fields.firstName ? 'Prénom manquant' : 'Nom manquant',
      email,
      firstName: fields.firstName || '—',
      lastName: fields.lastName || '—',
      phone: fields.phone,
      civility: fields.civility,
      clientType: fields.clientType,
      birthDate: fields.birthDate,
      nationality: fields.nationality,
      address: fields.address,
      city: fields.city,
      postalCode: fields.postalCode,
      country: fields.country,
      internalNote: null,
    };
  }

  return {
    line,
    status: 'ready',
    email,
    ...fields,
  };
}

export function buildNauticManagerImportPreview(
  csvText: string,
  existingEmails: string[],
): { rows: NauticManagerMappedClient[]; parseError?: string } {
  const { rows: rawRows, parseError } = parseNauticManagerCsv(csvText);
  if (parseError) return { rows: [], parseError };

  const existing = new Set(existingEmails.map((e) => e.trim().toLowerCase()));
  const seenInFile = new Set<string>();
  const rows = rawRows.map((raw, idx) =>
    mapNauticManagerRow(raw, idx + 2, existing, seenInFile),
  );
  return { rows };
}
