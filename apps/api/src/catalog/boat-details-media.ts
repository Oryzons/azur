import type { SecureMediaService } from '../common/media/secure-media.service';
import { formatBoatEmplacementInput } from '@bleu-calanque/shared';

type LegalDoc = { fileUrl?: string | null; [key: string]: unknown };

type BoatLegaliteJson = {
  assurance?: LegalDoc;
  contratGestion?: LegalDoc;
  carteCirculation?: LegalDoc;
  annexe240?: LegalDoc;
};

const LEGAL_DOC_KEYS = ['assurance', 'contratGestion', 'carteCirculation', 'annexe240'] as const;

export const BOAT_LEGAL_DOC_KEYS = LEGAL_DOC_KEYS;
export type BoatLegalDocKey = (typeof LEGAL_DOC_KEYS)[number];

export function isBoatLegalDocKey(value: string): value is BoatLegalDocKey {
  return (LEGAL_DOC_KEYS as readonly string[]).includes(value);
}

export function readLegalDocFileUrl(
  detailsJson: string | null | undefined,
  docKey: BoatLegalDocKey,
): string | null {
  const legalite = parseLegalite(detailsJson);
  const doc = legalite?.[docKey];
  if (!doc || typeof doc !== 'object') return null;
  const url = typeof doc.fileUrl === 'string' ? doc.fileUrl.trim() : '';
  return url || null;
}

function parseLegalite(detailsJson: string | null | undefined): BoatLegaliteJson | null {
  if (!detailsJson?.trim()) return null;
  try {
    const parsed = JSON.parse(detailsJson) as { legalite?: BoatLegaliteJson };
    return parsed.legalite && typeof parsed.legalite === 'object' ? parsed.legalite : null;
  } catch {
    return null;
  }
}

/** Traite les pièces jointes légalité (data URL → stockage sécurisé) avant persistance. */
export async function processBoatDetailsJson(
  detailsJson: string | null | undefined,
  media: SecureMediaService,
  existingDetailsJson?: string | null,
): Promise<string | null | undefined> {
  if (detailsJson == null || detailsJson === '') return detailsJson;
  if (!detailsJson.trim()) return detailsJson;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(detailsJson) as Record<string, unknown>;
  } catch {
    return detailsJson;
  }

  const legalite = parsed.legalite;
  const generales = parsed.generales;
  if (generales && typeof generales === 'object') {
    const raw =
      typeof (generales as { emplacement?: unknown }).emplacement === 'string'
        ? (generales as { emplacement: string }).emplacement
        : '';
    parsed.generales = {
      ...(generales as Record<string, unknown>),
      emplacement: formatBoatEmplacementInput(raw),
    };
  }

  if (!legalite || typeof legalite !== 'object') {
    return JSON.stringify(parsed);
  }

  const existingLegalite = parseLegalite(existingDetailsJson);
  const nextLegalite: BoatLegaliteJson = { ...(legalite as BoatLegaliteJson) };

  for (const key of LEGAL_DOC_KEYS) {
    const doc = (legalite as BoatLegaliteJson)[key];
    if (!doc || typeof doc !== 'object') continue;

    const incoming = typeof doc.fileUrl === 'string' ? doc.fileUrl.trim() : '';
    const existing =
      typeof existingLegalite?.[key]?.fileUrl === 'string' ? existingLegalite[key]!.fileUrl!.trim() : '';

    if (!incoming) {
      nextLegalite[key] = { ...doc, fileUrl: '' };
      continue;
    }

    if (incoming === existing && incoming.startsWith('https://')) {
      nextLegalite[key] = { ...doc, fileUrl: incoming };
      continue;
    }

    const stored = await media.processOptionalDocumentUrl(incoming);
    nextLegalite[key] = { ...doc, fileUrl: stored ?? '' };
  }

  return JSON.stringify({ ...parsed, legalite: nextLegalite });
}
