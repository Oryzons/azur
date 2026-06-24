import {
  CHECK_FLOW_KIND_LABELS,
  formatCheckAnswerDisplay,
  submissionSummaryLines,
  type CheckFlowSubmissionSummary,
} from '@/stores/checkFlow';
import { CF } from '@/lib/tabletCheckFlowTheme';

function parsePhotoUrls(json: string): string[] {
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function TabletSubmissionDetail({ row }: { row: CheckFlowSubmissionSummary }) {
  const lines = submissionSummaryLines(row.summaryJson);
  const agent = row.submittedBy
    ? `${row.submittedBy.firstName} ${row.submittedBy.lastName}`.trim()
    : '—';

  return (
    <div className="space-y-5">
      <div className={CF.card}>
        <p className={CF.label}>{CHECK_FLOW_KIND_LABELS[row.kind]}</p>
        <p className="mt-2 text-lg font-bold text-zinc-900">{row.reservation?.title ?? 'Réservation'}</p>
        {row.reservation?.boat ? (
          <p className="mt-1 text-sm text-zinc-500">
            {row.reservation.boat.brand} {row.reservation.boat.name}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-700">
          Enregistré le {new Date(row.submittedAt).toLocaleString('fr-FR')}
        </p>
        <p className="text-sm text-zinc-500">Par {agent}</p>
      </div>

      {lines.length > 0 ? (
        <section className={CF.card}>
          <h2 className={CF.label}>Résumé</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {row.answers && row.answers.length > 0 ? (
        <section className="space-y-3">
          <h2 className={CF.label}>Détail des réponses</h2>
          {row.answers.map((a) => (
            <div key={a.id} className={CF.card}>
              <p className="font-semibold text-zinc-900">{a.question.label}</p>
              {a.valueText ? (
                <p className="mt-1 text-sm text-zinc-700">
                  {formatCheckAnswerDisplay(a.question.questionType, a.valueText)}
                </p>
              ) : null}
              {a.valueJson ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsePhotoUrls(a.valueJson).map((src, i) => (
                    <img key={i} src={src} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-zinc-200" />
                  ))}
                </div>
              ) : null}
              {a.commentText ? (
                <p className="mt-2 text-sm italic text-zinc-500">Commentaire : {a.commentText}</p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {row.clientSignatureUrl || row.agentSignatureUrl ? (
        <section className={CF.card}>
          <h2 className={CF.label}>Signatures</h2>
          <div className="mt-3 grid grid-cols-1 gap-4">
            {row.clientSignatureUrl ? (
              <div>
                <p className="text-xs font-semibold text-zinc-500">Client</p>
                <img
                  src={row.clientSignatureUrl}
                  alt="Signature client"
                  className="mt-2 max-h-28 w-full rounded-2xl border border-zinc-200/80 bg-zinc-50 object-contain p-2"
                />
              </div>
            ) : null}
            {row.agentSignatureUrl ? (
              <div>
                <p className="text-xs font-semibold text-zinc-500">Loueur</p>
                <img
                  src={row.agentSignatureUrl}
                  alt="Signature du loueur"
                  className="mt-2 max-h-28 w-full rounded-2xl border border-zinc-200/80 bg-zinc-50 object-contain p-2"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
