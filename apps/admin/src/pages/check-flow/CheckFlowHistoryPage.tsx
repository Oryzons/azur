import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, LogIn, LogOut, Ship } from 'lucide-react';
import { CheckFlowSubNav } from '@/pages/check-flow/CheckFlowSubNav';
import { CHECK_FLOW_THEME } from '@/lib/checkFlowUi';
import { DataTableSkeleton, PageHeaderSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';
import { ContentReveal } from '@/components/ui/ContentReveal';
import {
  CHECK_FLOW_KIND_LABELS,
  formatCheckAnswerDisplay,
  submissionSummaryLines,
  useCheckFlowStore,
  type CheckFlowKind,
  type CheckFlowSubmissionSummary,
} from '@/stores/checkFlow';

function parsePhotoUrls(json: string): string[] {
  try {
    const arr = JSON.parse(json) as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function CheckFlowHistoryPage() {
  const listSubmissions = useCheckFlowStore((s) => s.listSubmissions);
  const getSubmission = useCheckFlowStore((s) => s.getSubmission);
  const [params] = useSearchParams();
  const focusId = params.get('id');

  const [kindFilter, setKindFilter] = useState<CheckFlowKind | ''>('');
  const [rows, setRows] = useState<CheckFlowSubmissionSummary[]>([]);
  const [detail, setDetail] = useState<CheckFlowSubmissionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listSubmissions({
      kind: kindFilter || undefined,
      from: new Date(Date.now() - 90 * 86400000).toISOString(),
    }).then((data) => {
      if (!cancelled) setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [kindFilter, listSubmissions]);

  useEffect(() => {
    if (!focusId) {
      setDetail(null);
      return;
    }
    void getSubmission(focusId).then(setDetail);
  }, [focusId, getSubmission]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [rows],
  );

  return (
    <ContentReveal
      ready={!loading}
      skeleton={
        <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-5">
            <PageHeaderSkeleton />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-16" rounded="2xl" />
            <Skeleton className="h-9 w-24" rounded="2xl" />
            <Skeleton className="h-9 w-24" rounded="2xl" />
          </div>
          <DataTableSkeleton rows={8} />
        </div>
      }
    >
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <ClipboardList className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Historique</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Soumissions tablette des 90 derniers jours — check-in et check-out.
            </p>
          </div>
        </div>
      </div>

      <CheckFlowSubNav />

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={kindFilter === ''} label="Tous" onClick={() => setKindFilter('')} />
        <FilterChip
          active={kindFilter === 'CHECK_IN'}
          label="Check-in"
          theme={CHECK_FLOW_THEME.CHECK_IN}
          Icon={LogIn}
          onClick={() => setKindFilter('CHECK_IN')}
        />
        <FilterChip
          active={kindFilter === 'CHECK_OUT'}
          label="Check-out"
          theme={CHECK_FLOW_THEME.CHECK_OUT}
          Icon={LogOut}
          onClick={() => setKindFilter('CHECK_OUT')}
        />
        <span className="ml-auto self-center text-xs text-zinc-500">
          {loading ? '…' : `${sorted.length} entrée${sorted.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          {sorted.length === 0 && !loading ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-600">Aucune soumission pour cette période.</p>
              <Link
                to="/check-flow/formulaires"
                className="mt-3 inline-block text-sm font-semibold text-[#416B9F] hover:underline"
              >
                Voir les formulaires
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {sorted.map((row) => (
                <HistoryRow key={row.id} row={row} selected={focusId === row.id} />
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
          {!detail ? (
            <p className="py-6 text-center text-sm text-zinc-500">Sélectionnez une entrée pour le détail.</p>
          ) : (
            <DetailPanel row={detail} />
          )}
        </aside>
      </div>
    </div>
    </ContentReveal>
  );
}

function FilterChip(props: Readonly<{
  active: boolean;
  label: string;
  onClick: () => void;
  theme?: (typeof CHECK_FLOW_THEME)[CheckFlowKind];
  Icon?: typeof LogIn;
}>) {
  const { active, label, onClick, theme, Icon } = props;
  if (theme && Icon) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition',
          active ? theme.pillActive : theme.pill,
        ].join(' ')}
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl px-4 py-2 text-sm font-semibold',
        active ? 'bg-[#416B9F] text-white shadow-sm' : 'border border-zinc-200 bg-white text-zinc-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function HistoryRow(props: Readonly<{ row: CheckFlowSubmissionSummary; selected: boolean }>) {
  const { row, selected } = props;
  const theme = CHECK_FLOW_THEME[row.kind];
  const title = row.reservation?.title ?? row.reservationId;
  const boat = row.reservation?.boat
    ? `${row.reservation.boat.brand} ${row.reservation.boat.name}`
    : '';

  return (
    <li>
      <Link
        to={`/check-flow/historique?id=${row.id}`}
        className={[
          'block px-4 py-3.5 transition hover:bg-zinc-50',
          selected ? 'bg-[#416B9F]/5 ring-1 ring-inset ring-[#416B9F]/20' : '',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{title}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {new Date(row.submittedAt).toLocaleString('fr-FR')}
            </p>
            {boat ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                <Ship className="h-3 w-3 shrink-0" />
                {boat}
              </p>
            ) : null}
          </div>
          <span
            className={[
              'shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              theme.pill,
            ].join(' ')}
          >
            {CHECK_FLOW_KIND_LABELS[row.kind]}
          </span>
        </div>
      </Link>
    </li>
  );
}

function DetailPanel({ row }: Readonly<{ row: CheckFlowSubmissionSummary }>) {
  const theme = CHECK_FLOW_THEME[row.kind];
  const lines = submissionSummaryLines(row.summaryJson);
  const agent = row.submittedBy
    ? `${row.submittedBy.firstName} ${row.submittedBy.lastName}`.trim()
    : '—';

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-3 py-2 ${theme.pill}`}>
        <p className="text-sm font-bold">{CHECK_FLOW_KIND_LABELS[row.kind]}</p>
        <p className="text-xs opacity-80">{new Date(row.submittedAt).toLocaleString('fr-FR')}</p>
      </div>

      <dl className="space-y-2 text-sm text-zinc-700">
        <div>
          <dt className="text-[10px] font-semibold uppercase text-zinc-500">Agent</dt>
          <dd>{agent}</dd>
        </div>
        {row.reservation ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase text-zinc-500">Réservation</dt>
            <dd>
              {row.reservation.title}
              {row.reservation.boat ? ` · ${row.reservation.boat.name}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {lines.length > 0 ? (
        <div className="border-t border-zinc-100 pt-3">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">Résumé</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.clientSignatureUrl || row.agentSignatureUrl ? (
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
          {row.clientSignatureUrl ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-zinc-500">Client</p>
              <img
                src={row.clientSignatureUrl}
                alt="Signature client"
                className="mt-1 h-20 w-full rounded-lg border object-contain bg-zinc-50"
              />
            </div>
          ) : null}
          {row.agentSignatureUrl ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-zinc-500">Loueur</p>
              <img
                src={row.agentSignatureUrl}
                alt="Signature du loueur"
                className="mt-1 h-20 w-full rounded-lg border object-contain bg-zinc-50"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {row.answers && row.answers.length > 0 ? (
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          <p className="text-[10px] font-semibold uppercase text-zinc-500">Réponses</p>
          {row.answers.map((a) => (
            <div key={a.id} className="rounded-xl bg-zinc-50 p-3 text-sm">
              <p className="font-semibold text-zinc-800">{a.question.label}</p>
              {a.valueText ? (
                <p className="mt-0.5 text-zinc-600">
                  {formatCheckAnswerDisplay(a.question.questionType, a.valueText)}
                </p>
              ) : null}
              {a.valueJson ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {parsePhotoUrls(a.valueJson).map((src, i) => (
                    <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-zinc-200" />
                  ))}
                </div>
              ) : null}
              {a.commentText ? (
                <p className="mt-1 text-xs italic text-zinc-500">Commentaire : {a.commentText}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
