import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Anchor,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  User,
} from 'lucide-react';
import { ContractDocumentPhotoSlot } from '@/components/contract/ContractDocumentPhotoSlot';
import { ContractSignaturePad } from '@/components/ContractSignaturePad';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';
import { MoneyAmount, PricingAmountRow } from '@/components/ui/MoneyAmount';
import { DEFAULT_BRAND_NAME } from '@/lib/brand';

type DocumentPhotos = {
  cniFrontUrl: string;
  cniBackUrl: string;
  boatLicenseFrontUrl: string;
  boatLicenseBackUrl: string;
  airbusBadgePhotoUrl: string;
  requireAirbusBadge: boolean;
};

type DocumentsOnFile = {
  cniFront: boolean;
  cniBack: boolean;
  boatLicenseFront: boolean;
  boatLicenseBack: boolean;
  airbusBadgePhoto: boolean;
};

function emptyDocumentsOnFile(): DocumentsOnFile {
  return {
    cniFront: false,
    cniBack: false,
    boatLicenseFront: false,
    boatLicenseBack: false,
    airbusBadgePhoto: false,
  };
}

function OnFileHint(props: Readonly<{ show: boolean }>) {
  if (!props.show) return null;
  return (
    <p className="mt-1 text-[11px] font-medium text-emerald-700">
      Document déjà enregistré sur votre fiche — vous pouvez le remplacer en téléversant une nouvelle photo.
    </p>
  );
}

function emptyDocumentPhotos(requireAirbus = false): DocumentPhotos {
  return {
    cniFrontUrl: '',
    cniBackUrl: '',
    boatLicenseFrontUrl: '',
    boatLicenseBackUrl: '',
    airbusBadgePhotoUrl: '',
    requireAirbusBadge: requireAirbus,
  };
}

function onFileFromApi(
  src:
    | {
        hasCniFront?: boolean;
        hasCniBack?: boolean;
        hasBoatLicenseFront?: boolean;
        hasBoatLicenseBack?: boolean;
        hasAirbusBadgePhoto?: boolean;
        requireAirbusBadge?: boolean;
      }
    | undefined,
): DocumentsOnFile {
  return {
    cniFront: Boolean(src?.hasCniFront),
    cniBack: Boolean(src?.hasCniBack),
    boatLicenseFront: Boolean(src?.hasBoatLicenseFront),
    boatLicenseBack: Boolean(src?.hasBoatLicenseBack),
    airbusBadgePhoto: Boolean(src?.hasAirbusBadgePhoto),
  };
}

function photosFromApi(
  src:
    | {
        requireAirbusBadge?: boolean;
      }
    | undefined,
  requireAirbus: boolean,
): DocumentPhotos {
  return {
    cniFrontUrl: '',
    cniBackUrl: '',
    boatLicenseFrontUrl: '',
    boatLicenseBackUrl: '',
    airbusBadgePhotoUrl: '',
    requireAirbusBadge: src?.requireAirbusBadge ?? requireAirbus,
  };
}

type ContractSummary = {
  brandName: string;
  contractNumber: number;
  clientName: string;
  clientEmail: string;
  boatName: string;
  boatModel: string;
  startLabel: string;
  endLabel: string;
  baseLabel: string;
  totalLabel: string;
  depositLabel: string | null;
  pricingLines: { description: string; amountLabel: string }[];
  paymentItems: { label: string; methodLabel: string; amountLabel: string; paid: boolean }[];
  balanceDueLabel: string | null;
  paid: boolean;
};

type ContractPayload = {
  contractNumber: number;
  signed: boolean;
  signedAt: string | null;
  signedEmailSent: boolean;
  operatorSignatureReady: boolean;
  paid?: boolean;
  paymentRequired?: boolean;
  canSign: boolean;
  signBlockedReason: string | null;
  pdfDownloadUrl: string | null;
  summary: ContractSummary;
  requiredDocuments?: string[];
  documentChecklist?: { label: string; status: 'provided' | 'missing'; source?: string; detail?: string }[];
  documentPhotos?: {
    hasCniFront: boolean;
    hasCniBack: boolean;
    hasBoatLicenseFront: boolean;
    hasBoatLicenseBack: boolean;
    hasAirbusBadgePhoto: boolean;
    requireAirbusBadge: boolean;
  };
  reservation: {
    id: string;
    boatName: string;
    paid: boolean;
    paymentChannel?: string;
    paymentUrl: string | null;
  };
};

type SignResponse = {
  signed: boolean;
  contractNumber: number;
  alreadySigned?: boolean;
  signedEmailSent?: boolean;
  pdfDownloadUrl?: string;
};

function SignedSuccessCard(props: Readonly<{
  contractNumber: number;
  boatName: string;
  clientEmail: string;
  signedEmailSent: boolean;
  pdfDownloadUrl: string | null;
  paymentUrl: string | null;
  paid: boolean;
}>) {
  const { contractNumber, boatName, clientEmail, signedEmailSent, pdfDownloadUrl, paymentUrl, paid } = props;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">Merci, c&apos;est signé</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Contrat n°{contractNumber} — {boatName}
      </p>
      {signedEmailSent ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Le <strong className="text-zinc-800">PDF signé</strong> (contrat n°{contractNumber}) a été envoyé à{' '}
          <strong className="text-zinc-800">{clientEmail}</strong>. Conservez-le pour la durée de la location.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-amber-900">
          Votre contrat est signé et archivé. L&apos;envoi par email n&apos;a pas abouti — téléchargez le PDF via le lien
          sécurisé ci-dessous et conservez-le.
        </p>
      )}
      {pdfDownloadUrl ? (
        <a
          href={pdfDownloadUrl}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800"
        >
          <FileText className="h-4 w-4" aria-hidden />
          Télécharger le PDF (lien sécurisé)
        </a>
      ) : null}
      {!paid && paymentUrl ? (
        <a
          href={paymentUrl}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-5 py-2.5 text-sm font-semibold text-white"
        >
          <CreditCard className="h-4 w-4" aria-hidden />
          Procéder au paiement
        </a>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">Vous pouvez fermer cette page.</p>
      )}
    </div>
  );
}

function SummaryRow(props: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return (
    <div className="flex gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#416B9F]/10 text-[#416B9F]">
        {props.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{props.label}</p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-900">{props.value}</p>
      </div>
    </div>
  );
}

function ReservationSummaryCard(props: Readonly<{ summary: ContractSummary }>) {
  const { summary: s } = props;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#416B9F] px-5 py-5 text-white">
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">{s.brandName}</p>
        <h2 className="mt-1 text-xl font-bold">{s.boatName}</h2>
        <p className="text-sm text-white/85">{s.boatModel}</p>
        <p className="mt-3 text-xs text-white/70">Contrat n°{s.contractNumber}</p>
      </div>
      <div className="divide-y divide-zinc-100 px-5">
        <SummaryRow icon={<User className="h-4 w-4" aria-hidden />} label="Locataire" value={s.clientName} />
        <SummaryRow icon={<Mail className="h-4 w-4" aria-hidden />} label="Email" value={s.clientEmail} />
        <SummaryRow icon={<Calendar className="h-4 w-4" aria-hidden />} label="Départ" value={s.startLabel} />
        <SummaryRow icon={<Calendar className="h-4 w-4" aria-hidden />} label="Retour" value={s.endLabel} />
        <SummaryRow icon={<Anchor className="h-4 w-4" aria-hidden />} label="Base" value={s.baseLabel} />
      </div>
      {s.pricingLines.length > 0 ? (
        <div className="border-t border-zinc-100 px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Détail du tarif</p>
          <ul className="mt-2 space-y-1.5">
            {s.pricingLines.map((line) => (
              <li key={line.description} className="text-sm">
                <PricingAmountRow
                  label={line.description}
                  amount={line.amountLabel}
                  labelClassName="text-zinc-700"
                  amountClassName="text-zinc-900"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {s.paymentItems.length > 0 ? (
        <div className="border-t border-zinc-100 px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Règlements</p>
          <ul className="mt-2 space-y-2">
            {s.paymentItems.map((item) => (
              <li key={`${item.label}-${item.methodLabel}`} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-800">{item.label}</p>
                  <p className="text-xs text-zinc-500">{item.methodLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <MoneyAmount className="font-semibold text-zinc-900">{item.amountLabel}</MoneyAmount>
                  <p
                    className={`text-xs font-medium ${item.paid ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {item.paid ? 'Réglé' : 'À régler'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm font-medium text-zinc-600">Total</span>
          <MoneyAmount className="text-xl font-bold text-[#416B9F]">{s.totalLabel}</MoneyAmount>
        </div>
        {s.depositLabel ? (
          <p className="mt-2 text-xs text-zinc-500">
            Caution : <MoneyAmount>{s.depositLabel}</MoneyAmount>
          </p>
        ) : null}
        {s.balanceDueLabel ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            Reste à payer : <MoneyAmount>{s.balanceDueLabel}</MoneyAmount>
          </p>
        ) : s.paid ? (
          <p className="mt-2 text-xs font-medium text-emerald-600">Tout est réglé</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-amber-600">Paiement en attente</p>
        )}
      </div>
    </div>
  );
}

export function ContractSignPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [data, setData] = useState<ContractPayload | null>(null);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [signedEmailSent, setSignedEmailSent] = useState(false);
  const [photos, setPhotos] = useState<DocumentPhotos>(() => emptyDocumentPhotos());
  const [onFile, setOnFile] = useState<DocumentsOnFile>(() => emptyDocumentsOnFile());

  useEffect(() => {
    if (!token) {
      setError('Lien de signature invalide.');
      return;
    }
    void api
      .get<ContractPayload>(`/public/rental-contracts/${encodeURIComponent(token)}`)
      .then((res) => {
        setData(res.data);
        setPhotos(
          photosFromApi(res.data.documentPhotos, Boolean(res.data.documentPhotos?.requireAirbusBadge)),
        );
        setOnFile(onFileFromApi(res.data.documentPhotos));
        if (res.data.signed) {
          setDone(true);
          setSignedEmailSent(Boolean(res.data.signedEmailSent));
        }
      })
      .catch(() => setError('Contrat introuvable ou lien expiré.'));
  }, [token]);

  async function submit() {
    if (!signature) {
      setError('Veuillez signer dans le cadre ci-dessus.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post<SignResponse>(`/public/rental-contracts/${encodeURIComponent(token)}/sign`, {
        clientSignature: signature,
        cniFrontUrl: photos.cniFrontUrl || null,
        cniBackUrl: photos.cniBackUrl || null,
        boatLicenseFrontUrl: photos.boatLicenseFrontUrl || null,
        boatLicenseBackUrl: photos.boatLicenseBackUrl || null,
        airbusBadgePhotoUrl: photos.airbusBadgePhotoUrl || null,
      });
      setSignedEmailSent(Boolean(res.data.signedEmailSent));
      setData((prev) =>
        prev
          ? {
              ...prev,
              signed: true,
              contractNumber: res.data.contractNumber,
              pdfDownloadUrl: res.data.pdfDownloadUrl ?? prev.pdfDownloadUrl,
              signedEmailSent: Boolean(res.data.signedEmailSent),
            }
          : prev,
      );
      setDone(true);
    } catch (e: unknown) {
      setError(extractApiErrorMessage(e, 'Signature impossible.'));
    } finally {
      setSubmitting(false);
    }
  }

  const summary = data?.summary;
  const requiresAirbus = photos.requireAirbusBadge;
  const showIdDocs = (data?.requiredDocuments ?? []).some((l) => /identit|passeport|\bcni\b|titre de s/i.test(l));
  const showLicenseDocs = (data?.requiredDocuments ?? []).some((l) => /permis|certificat/i.test(l));
  const docsOk =
    (!showIdDocs ||
      ((photos.cniFrontUrl.trim() || onFile.cniFront) && (photos.cniBackUrl.trim() || onFile.cniBack))) &&
    (!showLicenseDocs ||
      ((photos.boatLicenseFrontUrl.trim() || onFile.boatLicenseFront) &&
        (photos.boatLicenseBackUrl.trim() || onFile.boatLicenseBack))) &&
    (!requiresAirbus || photos.airbusBadgePhotoUrl.trim() || onFile.airbusBadgePhoto);
  const readyToSign = Boolean(data?.canSign && docsOk);

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#416B9F]/10">
            <FileText className="h-6 w-6 text-[#416B9F]" aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Signature de votre location</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {summary?.brandName ?? DEFAULT_BRAND_NAME} — récapitulatif et contrat
          </p>
        </div>

        {error && !data ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : !data || !summary ? (
          <div className="flex items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Chargement…
          </div>
        ) : done && summary ? (
          <SignedSuccessCard
            contractNumber={data.contractNumber}
            boatName={summary.boatName}
            clientEmail={summary.clientEmail}
            signedEmailSent={signedEmailSent || Boolean(data.signedEmailSent)}
            pdfDownloadUrl={data.pdfDownloadUrl}
            paid={data.reservation.paid}
            paymentUrl={data.reservation.paymentUrl}
          />
        ) : (
          <div className="space-y-4">
            <ReservationSummaryCard summary={summary} />

            {(data.paymentRequired || !data.reservation.paid) && data.reservation.paymentUrl ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 shadow-sm">
                <p className="text-sm font-semibold text-amber-950">Paiement requis avant signature</p>
                <p className="mt-1 text-sm text-amber-900/90">
                  Le contrat ne peut être signé qu’après confirmation du paiement de la location. Si vous venez de payer,
                  actualisez cette page dans quelques secondes.
                </p>
                <a
                  href={data.reservation.paymentUrl}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#416B9F] px-5 py-3 text-sm font-semibold text-white sm:w-auto"
                >
                  <CreditCard className="h-4 w-4" aria-hidden />
                  Procéder au paiement
                </a>
              </div>
            ) : null}

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-zinc-600">
                En signant ci-dessous, vous validez le{' '}
                <strong className="text-zinc-800">contrat de location n°{data.contractNumber}</strong>, incluant les
                conditions générales de {summary.brandName}. Le PDF signé vous sera envoyé par email (pièce jointe) et
                restera disponible via un lien de téléchargement sécurisé.
              </p>

              {(showIdDocs || showLicenseDocs || requiresAirbus) ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Justificatifs requis avant signature</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Téléversez des photos ou PDF lisibles (recto et verso). Ils seront enregistrés sur votre fiche client
                    pour vos prochaines locations.
                  </p>
                  <div className="mt-4 space-y-4">
                    {showIdDocs ? (
                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Pièce d&apos;identité
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <ContractDocumentPhotoSlot
                              label="Recto"
                              required
                              value={photos.cniFrontUrl}
                              onChange={(url) => {
                                setPhotos((p) => ({ ...p, cniFrontUrl: url }));
                                if (url.trim()) setOnFile((o) => ({ ...o, cniFront: false }));
                              }}
                            />
                            <OnFileHint show={onFile.cniFront && !photos.cniFrontUrl.trim()} />
                          </div>
                          <div>
                            <ContractDocumentPhotoSlot
                              label="Verso"
                              required
                              value={photos.cniBackUrl}
                              onChange={(url) => {
                                setPhotos((p) => ({ ...p, cniBackUrl: url }));
                                if (url.trim()) setOnFile((o) => ({ ...o, cniBack: false }));
                              }}
                            />
                            <OnFileHint show={onFile.cniBack && !photos.cniBackUrl.trim()} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {showLicenseDocs ? (
                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Permis bateau ou certificat côtier
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <ContractDocumentPhotoSlot
                              label="Recto"
                              required
                              value={photos.boatLicenseFrontUrl}
                              onChange={(url) => {
                                setPhotos((p) => ({ ...p, boatLicenseFrontUrl: url }));
                                if (url.trim()) setOnFile((o) => ({ ...o, boatLicenseFront: false }));
                              }}
                            />
                            <OnFileHint show={onFile.boatLicenseFront && !photos.boatLicenseFrontUrl.trim()} />
                          </div>
                          <div>
                            <ContractDocumentPhotoSlot
                              label="Verso"
                              required
                              value={photos.boatLicenseBackUrl}
                              onChange={(url) => {
                                setPhotos((p) => ({ ...p, boatLicenseBackUrl: url }));
                                if (url.trim()) setOnFile((o) => ({ ...o, boatLicenseBack: false }));
                              }}
                            />
                            <OnFileHint show={onFile.boatLicenseBack && !photos.boatLicenseBackUrl.trim()} />
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {requiresAirbus ? (
                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Badge Airbus</p>
                        <ContractDocumentPhotoSlot
                          label="Photo du badge"
                          required
                          value={photos.airbusBadgePhotoUrl}
                          onChange={(url) => {
                            setPhotos((p) => ({ ...p, airbusBadgePhotoUrl: url }));
                            if (url.trim()) setOnFile((o) => ({ ...o, airbusBadgePhoto: false }));
                          }}
                        />
                        <OnFileHint show={onFile.airbusBadgePhoto && !photos.airbusBadgePhotoUrl.trim()} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!readyToSign && data.signBlockedReason ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  {data.signBlockedReason}
                </p>
              ) : !docsOk ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Veuillez téléverser toutes les photos demandées avant de signer.
                </p>
              ) : readyToSign ? (
                <div className="mt-5">
                  <ContractSignaturePad label="Votre signature" value={signature} onChange={setSignature} />
                </div>
              ) : null}
              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {readyToSign ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submit()}
                    className="flex-1 rounded-xl bg-[#416B9F] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting ? 'Enregistrement…' : 'Signer le contrat'}
                  </button>
                ) : null}
                {!data.reservation.paid && data.reservation.paymentUrl ? (
                  <a
                    href={data.reservation.paymentUrl}
                    className={[
                      'rounded-xl px-5 py-3 text-center text-sm font-semibold',
                      data.canSign
                        ? 'border border-zinc-200 text-zinc-700'
                        : 'flex-1 bg-[#416B9F] text-white',
                    ].join(' ')}
                  >
                    {data.canSign ? 'Payer d’abord' : 'Paiement en ligne'}
                  </a>
                ) : null}
                {!data.canSign && data.reservation.paid ? (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700"
                  >
                    Actualiser
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-zinc-400">{summary?.brandName ?? DEFAULT_BRAND_NAME}</p>
      </div>
    </div>
  );
}
