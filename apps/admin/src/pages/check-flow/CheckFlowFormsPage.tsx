import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Eye,
  Fuel,
  Image,
  List,
  LogIn,
  LogOut,
  MessageSquare,
  Pencil,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { CheckFlowFormEditor } from '@/pages/check-flow/CheckFlowFormEditor';
import { CheckFlowSubNav } from '@/pages/check-flow/CheckFlowSubNav';
import { CHECK_FLOW_THEME, questionTypeShortLabel } from '@/lib/checkFlowUi';
import {
  CHECK_FLOW_KIND_LABELS,
  questionOptions,
  useCheckFlowStore,
  type CheckFlowKind,
  type CheckFlowQuestion,
  type CheckQuestionType,
} from '@/stores/checkFlow';

const TYPE_ICONS: Record<CheckQuestionType, typeof Type> = {
  TEXT: Type,
  BOOLEAN: ToggleLeft,
  SELECT: List,
  PHOTO: Image,
  FUEL_GAUGE: Fuel,
};

type PageMode = 'preview' | 'edit';

function QuestionPreviewCard({ q, index }: Readonly<{ q: CheckFlowQuestion; index: number }>) {
  const opts = questionOptions(q);
  const TypeIcon = TYPE_ICONS[q.questionType];

  return (
    <li className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/10 text-sm font-bold text-[#416B9F]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-zinc-900">{q.label}</p>
              {q.helpText ? <p className="mt-1 text-sm text-zinc-500">{q.helpText}</p> : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                <TypeIcon className="h-3 w-3" />
                {questionTypeShortLabel(q.questionType)}
              </span>
              {q.required ? (
                <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                  Obligatoire
                </span>
              ) : (
                <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                  Optionnel
                </span>
              )}
            </div>
          </div>

          {q.questionType === 'SELECT' && opts.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {opts.map((o) => (
                <li key={o} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                  {o}
                </li>
              ))}
            </ul>
          ) : null}

          {q.questionType === 'PHOTO' ? (
            <p className="mt-2 text-xs text-zinc-600">
              {q.photoMinCount} à {q.photoMaxCount} photo(s) demandée(s)
            </p>
          ) : null}

          {q.questionType === 'FUEL_GAUGE' ? (
            <p className="mt-2 text-xs text-zinc-600">Jauge visuelle 0 – 100 %</p>
          ) : null}

          <p className="mt-3 flex items-center gap-1.5 text-[11px] italic text-zinc-400">
            <MessageSquare className="h-3 w-3" />
            Commentaire optionnel saisi sur tablette
          </p>
        </div>
      </div>
    </li>
  );
}

function FormPreviewPanel(props: Readonly<{
  kind: CheckFlowKind;
  questions: CheckFlowQuestion[];
  loading: boolean;
  onEdit: () => void;
}>) {
  const { kind, questions, loading, onEdit } = props;
  const theme = CHECK_FLOW_THEME[kind];
  const active = questions.filter((q) => q.enabled);

  return (
    <div className={`rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-offset-2 ${theme.ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-5">
        <div>
          <p className={`text-lg font-bold ${theme.accent}`}>{CHECK_FLOW_KIND_LABELS[kind]}</p>
          <p className="text-sm text-zinc-500">
            {active.length} question{active.length !== 1 ? 's' : ''} visible{active.length !== 1 ? 's' : ''} sur
            tablette
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <p className="py-10 text-center text-sm text-zinc-500">Chargement…</p>
        ) : active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-12 text-center">
            <p className="text-sm text-zinc-600">Aucune question active sur ce formulaire.</p>
            <button
              type="button"
              onClick={onEdit}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
            >
              <Pencil className="h-4 w-4" />
              Ajouter des questions
            </button>
          </div>
        ) : (
          <ol className="space-y-3">
            {active.map((q, i) => (
              <QuestionPreviewCard key={q.id} q={q} index={i} />
            ))}
          </ol>
        )}

        <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fin du parcours tablette</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            <li>Signature client (obligatoire)</li>
            <li>Signature loueur (obligatoire)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CheckFlowFormsPage() {
  const [params, setParams] = useSearchParams();
  const fetchQuestions = useCheckFlowStore((s) => s.fetchQuestions);
  const fetchSettings = useCheckFlowStore((s) => s.fetchSettings);
  const questionsCheckIn = useCheckFlowStore((s) => s.questionsCheckIn);
  const questionsCheckOut = useCheckFlowStore((s) => s.questionsCheckOut);
  const checkOutUsesCheckInForm = useCheckFlowStore((s) => s.settings.checkOutUsesCheckInForm);

  const mode: PageMode = params.get('mode') === 'edit' ? 'edit' : 'preview';
  const [kindTab, setKindTab] = useState<CheckFlowKind>('CHECK_IN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchSettings(),
      fetchQuestions('CHECK_IN'),
      fetchQuestions('CHECK_OUT'),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchQuestions, fetchSettings]);

  const checkoutReusesCheckIn = kindTab === 'CHECK_OUT' && checkOutUsesCheckInForm;
  const questions =
    kindTab === 'CHECK_IN' || checkoutReusesCheckIn ? questionsCheckIn : questionsCheckOut;

  function setMode(next: PageMode) {
    const p = new URLSearchParams(params);
    if (next === 'edit') p.set('mode', 'edit');
    else p.delete('mode');
    setParams(p, { replace: true });
  }

  const activeIn = questionsCheckIn.filter((q) => q.enabled).length;
  const activeOut = checkOutUsesCheckInForm
    ? activeIn
    : questionsCheckOut.filter((q) => q.enabled).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <ClipboardCheck className="h-6 w-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Check-in / Check-out</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Formulaires tablette pour les agents (départ et retour). Comptes <strong className="text-zinc-800">AGENT</strong>{' '}
              requis.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Check-in : {activeIn} question{activeIn !== 1 ? 's' : ''} · Check-out :{' '}
              {checkOutUsesCheckInForm ? 'identique au check-in' : `${activeOut} question${activeOut !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          <li className="rounded-lg bg-white/70 px-3 py-2 text-[11px] text-zinc-600 ring-1 ring-zinc-200/60">
            <span className="font-bold text-[#416B9F]">1.</span> Choisir check-in ou check-out
          </li>
          <li className="rounded-lg bg-white/70 px-3 py-2 text-[11px] text-zinc-600 ring-1 ring-zinc-200/60">
            <span className="font-bold text-[#416B9F]">2.</span> Aperçu ou modification des questions
          </li>
          <li className="rounded-lg bg-white/70 px-3 py-2 text-[11px] text-zinc-600 ring-1 ring-zinc-200/60">
            <span className="font-bold text-[#416B9F]">3.</span> Consulter l’historique des passages
          </li>
        </ol>
      </div>

      <CheckFlowSubNav />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={[
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
            mode === 'preview' ? 'bg-[#416B9F] text-white shadow-sm' : 'border border-zinc-200 bg-white text-zinc-700',
          ].join(' ')}
        >
          <Eye className="h-4 w-4" />
          Aperçu tablette
        </button>
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={[
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
            mode === 'edit' ? 'bg-[#416B9F] text-white shadow-sm' : 'border border-zinc-200 bg-white text-zinc-700',
          ].join(' ')}
        >
          <Pencil className="h-4 w-4" />
          Modifier les questions
        </button>
        <Link
          to="/parametres"
          className="ml-auto inline-flex items-center rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 hover:text-[#416B9F]"
        >
          Aussi dans Paramètres → Check-in/out
        </Link>
      </div>

      {mode === 'edit' ? (
        <div className="mt-6">
          <CheckFlowFormEditor />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(['CHECK_IN', 'CHECK_OUT'] as const).map((k) => {
              const t = CHECK_FLOW_THEME[k];
              const active = kindTab === k;
              const Icon = k === 'CHECK_IN' ? LogIn : LogOut;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindTab(k)}
                  className={[
                    'inline-flex min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition sm:max-w-[14rem]',
                    active ? t.pillActive : t.pill,
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {CHECK_FLOW_KIND_LABELS[k]}
                </button>
              );
            })}
          </div>

          {checkoutReusesCheckIn ? (
            <p className="mt-4 rounded-xl border border-orange-200/80 bg-orange-50/60 px-4 py-3 text-sm text-orange-950">
              Le <strong>check-out</strong> réutilise le formulaire <strong>check-in</strong> ci-dessous. Modifiez l’option
              dans l’onglet Modifier si besoin.
            </p>
          ) : null}

          <div className="mt-6">
            <FormPreviewPanel
              kind={kindTab}
              questions={questions}
              loading={loading}
              onEdit={() => setMode('edit')}
            />
          </div>
        </>
      )}
    </div>
  );
}
