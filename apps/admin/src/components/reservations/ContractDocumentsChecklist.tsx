import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, FileCheck, Link2 } from 'lucide-react';
import { buildContractDocumentChecklist } from '@bleu-calanque/shared';
import { SectionCard } from '@/pages/reservations/reservationDetailsUi';
import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import type { Member, MemberClient } from '@/stores/members';

function memberDocumentFlags(member: Member | null | undefined) {
  if (!member || member.role !== 'client') {
    return {
      memberHasCompleteIdFiles: false,
      memberHasCompleteLicenseFiles: false,
      memberHasAirbusBadgePhoto: false,
    };
  }
  const c = member as MemberClient;
  const has = (url: string | null | undefined) => Boolean(url?.trim());
  return {
    memberHasCompleteIdFiles: has(c.cniFrontUrl) && has(c.cniBackUrl),
    memberHasCompleteLicenseFiles: has(c.boatLicenseFrontUrl) && has(c.boatLicenseBackUrl),
    memberHasAirbusBadgePhoto: has(c.airbusBadgePhotoUrl),
  };
}

type Props = Readonly<{
  requiredDocuments: string[];
  details: ReservationWizardDetails;
  linkedMember?: Member | null;
  locked?: boolean;
  onValidate: (label: string, validated: boolean) => void;
}>;

export function ContractDocumentsChecklist(props: Props) {
  const { requiredDocuments, details, linkedMember, locked, onValidate } = props;
  const navigate = useNavigate();

  const items = useMemo(() => {
    const docs = memberDocumentFlags(linkedMember);
    return buildContractDocumentChecklist({
      requiredLabels: requiredDocuments,
      ...docs,
      adminValidations: details.contractDocumentValidations,
    });
  }, [requiredDocuments, details, linkedMember]);

  if (requiredDocuments.length === 0) {
    return (
      <SectionCard icon={FileCheck} title="Justificatifs contrat" accent="default" collapsible>
        <p className="text-xs text-zinc-500">
          Aucun justificatif configuré dans le modèle de contrat actif (Paramètres → Contrats).
        </p>
      </SectionCard>
    );
  }

  const providedCount = items.filter((i) => i.status === 'provided').length;

  return (
    <SectionCard icon={FileCheck} title="Justificatifs contrat" accent="sky" collapsible>
      <p className="mb-3 text-xs text-zinc-600">
        {providedCount}/{items.length} fourni{providedCount > 1 ? 's' : ''} — reflété dans le PDF (checklist
        Fourni / Manquant).
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const ok = item.status === 'provided';
          const adminValidated = item.source === 'admin';
          return (
            <li
              key={item.label}
              className={[
                'rounded-xl border px-3 py-2.5',
                ok ? 'border-emerald-200/80 bg-emerald-50/50' : 'border-amber-200/80 bg-amber-50/40',
              ].join(' ')}
            >
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-zinc-600">
                    {ok ? 'Fourni' : 'Manquant'}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </p>
                </div>
                {adminValidated ? (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onValidate(item.label, false)}
                    className={[
                      'shrink-0 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white',
                      locked ? 'cursor-not-allowed opacity-50' : '',
                    ].join(' ')}
                  >
                    Retirer
                  </button>
                ) : ok ? (
                  <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                    Auto
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onValidate(item.label, true)}
                    className={[
                      'shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50',
                      locked ? 'cursor-not-allowed opacity-50' : '',
                    ].join(' ')}
                  >
                    Valider
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {linkedMember ? (
        <button
          type="button"
          onClick={() => navigate(`/clients?open=${encodeURIComponent(linkedMember.id)}`)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#416B9F] hover:underline"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Fiche client — pièces jointes ({linkedMember.firstName} {linkedMember.lastName})
        </button>
      ) : (
        <p className="mt-3 text-[11px] text-zinc-500">
          Liez un client membre pour détecter automatiquement les scans CNI / permis, ou validez manuellement.
        </p>
      )}
    </SectionCard>
  );
}
