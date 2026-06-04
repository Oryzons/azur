import { useEffect, useState } from 'react';
import {
  Fuel,
  Image,
  List,
  LogIn,
  LogOut,
  Plus,
  Save,
  ToggleLeft,
  Trash2,
  Type,
} from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { extractApiErrorMessage } from '@/lib/apiError';
import { CHECK_FLOW_THEME, QUESTION_TYPE_ORDER, questionTypeShortLabel } from '@/lib/checkFlowUi';
import { Link } from 'react-router-dom';
import {
  CHECK_FLOW_KIND_LABELS,
  CHECK_QUESTION_TYPE_LABELS,
  questionOptions,
  useCheckFlowStore,
  type CheckFlowKind,
  type CheckFlowQuestionInput,
  type CheckQuestionType,
} from '@/stores/checkFlow';

export type DraftQuestion = CheckFlowQuestionInput & { _key: string; optionsText?: string };

const TYPE_ICONS: Record<CheckQuestionType, typeof Type> = {
  TEXT: Type,
  BOOLEAN: ToggleLeft,
  SELECT: List,
  PHOTO: Image,
  FUEL_GAUGE: Fuel,
};

function newDraft(): DraftQuestion {
  return {
    _key: `q_${Math.random().toString(36).slice(2)}`,
    label: '',
    questionType: 'TEXT',
    required: true,
    photoMinCount: 1,
    photoMaxCount: 3,
    enabled: true,
    optionsText: '',
  };
}

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

type Props = Readonly<{
  /** Afficher le lien vers l’aperçu tablette en bas */
  showPreviewLink?: boolean;
}>;

export function CheckFlowFormEditor({ showPreviewLink = true }: Props) {
  const fetchQuestions = useCheckFlowStore((s) => s.fetchQuestions);
  const syncQuestions = useCheckFlowStore((s) => s.syncQuestions);
  const fetchSettings = useCheckFlowStore((s) => s.fetchSettings);
  const updateSettings = useCheckFlowStore((s) => s.updateSettings);
  const checkOutUsesCheckInForm = useCheckFlowStore((s) => s.settings.checkOutUsesCheckInForm);

  const [flow, setFlow] = useState<CheckFlowKind>('CHECK_IN');
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const checkoutUsesCheckIn = flow === 'CHECK_OUT' && checkOutUsesCheckInForm;
  const theme = CHECK_FLOW_THEME[flow];
  const activeCount = drafts.filter((d) => d.enabled !== false).length;

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (checkoutUsesCheckIn) {
      setDrafts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        await fetchQuestions(flow, { all: true });
        const qs =
          flow === 'CHECK_IN'
            ? useCheckFlowStore.getState().questionsCheckIn
            : useCheckFlowStore.getState().questionsCheckOut;
        setDrafts(
          qs.map((q) => ({
            _key: q.id,
            id: q.id,
            label: q.label,
            helpText: q.helpText,
            questionType: q.questionType,
            required: q.required,
            photoMinCount: q.photoMinCount,
            photoMaxCount: q.photoMaxCount,
            enabled: q.enabled,
            optionsText: questionOptions(q).join('\n'),
          })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [flow, fetchQuestions, checkoutUsesCheckIn]);

  async function toggleCheckOutUsesCheckIn(checked: boolean) {
    setSettingsSaving(true);
    setMsg(null);
    try {
      await updateSettings({ checkOutUsesCheckInForm: checked });
      setMsg({
        tone: 'ok',
        text: checked
          ? 'Le check-out reprend le formulaire check-in.'
          : 'Formulaire check-out séparé activé.',
      });
    } catch (err) {
      setMsg({ tone: 'err', text: extractApiErrorMessage(err, 'Erreur lors de l’enregistrement.') });
    } finally {
      setSettingsSaving(false);
    }
  }

  function updateDraft(key: string, patch: Partial<DraftQuestion>) {
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, ...patch } : d)));
    setMsg(null);
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d._key !== key));
    setConfirmDeleteKey(null);
    setMsg(null);
  }

  async function save() {
    if (drafts.some((d) => !d.label.trim())) {
      setMsg({ tone: 'err', text: 'Chaque question doit avoir un libellé.' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const questions: CheckFlowQuestionInput[] = drafts.map((d) => ({
        id: d.id,
        label: d.label.trim(),
        helpText: d.helpText?.trim() || null,
        questionType: d.questionType,
        required: d.required,
        enabled: d.enabled,
        photoMinCount: d.photoMinCount,
        photoMaxCount: d.photoMaxCount,
        options:
          d.questionType === 'SELECT'
            ? (d.optionsText ?? '')
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
      }));
      await syncQuestions(flow, questions);
      setMsg({ tone: 'ok', text: 'Formulaire enregistré.' });
    } catch (err) {
      setMsg({ tone: 'err', text: extractApiErrorMessage(err, 'Erreur lors de l’enregistrement.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(['CHECK_IN', 'CHECK_OUT'] as const).map((kind) => {
          const t = CHECK_FLOW_THEME[kind];
          const active = flow === kind;
          const Icon = kind === 'CHECK_IN' ? LogIn : LogOut;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setFlow(kind);
                setConfirmDeleteKey(null);
                setMsg(null);
              }}
              className={[
                'inline-flex min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition sm:max-w-[14rem]',
                active ? t.pillActive : t.pill,
              ].join(' ')}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {CHECK_FLOW_KIND_LABELS[kind]}
            </button>
          );
        })}
      </div>

      {flow === 'CHECK_OUT' ? (
        <div className="rounded-2xl border border-orange-200/80 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-orange-950">Même formulaire au départ et au retour ?</p>
              <p className="mt-0.5 text-xs text-orange-900/80">
                Réutiliser les questions check-in au check-out, ou définir un formulaire distinct.
              </p>
            </div>
            <RoundCheckbox
              checked={checkOutUsesCheckInForm}
              disabled={settingsSaving}
              onChange={(v) => void toggleCheckOutUsesCheckIn(v)}
              label="Formulaire check-in"
              className="rounded-xl border border-orange-200/80 bg-white px-3 py-2"
            />
          </div>
        </div>
      ) : null}

      {flow === 'CHECK_IN' && checkOutUsesCheckInForm ? (
        <p className="rounded-xl border border-teal-200/80 bg-teal-50/60 px-4 py-3 text-xs text-teal-900">
          Ce formulaire est aussi utilisé pour le <strong>check-out</strong>.
        </p>
      ) : null}

      {checkoutUsesCheckIn ? (
        <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 px-6 py-12 text-center">
          <LogIn className="mx-auto h-10 w-10 text-orange-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-zinc-800">Check-out = formulaire check-in</p>
          <button
            type="button"
            onClick={() => setFlow('CHECK_IN')}
            className="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Modifier le check-in
          </button>
        </div>
      ) : (
        <div className={`rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-offset-2 ${theme.ring}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
            <div>
              <p className={`text-sm font-semibold ${theme.accent}`}>
                Édition — {CHECK_FLOW_KIND_LABELS[flow]}
              </p>
              <p className="text-[11px] text-zinc-500">
                {activeCount} active{activeCount !== 1 ? 's' : ''} · {drafts.length} question{drafts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrafts((prev) => [...prev, newDraft()])}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#416B9F] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#365b87]"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une question
            </button>
          </div>

          {msg ? (
            <div
              className={[
                'mx-4 mt-3 rounded-xl px-3 py-2 text-xs font-medium sm:mx-5',
                msg.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800',
              ].join(' ')}
            >
              {msg.text}
            </div>
          ) : null}

          <div className="space-y-3 p-4 sm:p-5">
            {loading ? (
              <p className="py-8 text-center text-sm text-zinc-500">Chargement…</p>
            ) : drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-10 text-center">
                <p className="text-sm text-zinc-600">Aucune question.</p>
                <button
                  type="button"
                  onClick={() => setDrafts([newDraft()])}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Première question
                </button>
              </div>
            ) : (
              drafts.map((d, idx) => (
                <QuestionEditorCard
                  key={d._key}
                  index={idx}
                  draft={d}
                  confirmDelete={confirmDeleteKey === d._key}
                  onConfirmDelete={() => setConfirmDeleteKey(d._key)}
                  onCancelDelete={() => setConfirmDeleteKey(null)}
                  onDelete={() => removeDraft(d._key)}
                  onChange={(patch) => updateDraft(d._key, patch)}
                />
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/80 px-4 py-4 sm:px-5">
            {showPreviewLink ? (
              <p className="text-[11px] text-zinc-500">
                Après enregistrement, consultez l’onglet <strong>Aperçu</strong> ou la{' '}
                <Link to="/check-flow/formulaires" className="font-semibold text-[#416B9F] hover:underline">
                  vue tablette
                </Link>
                .
              </p>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditorCard(props: Readonly<{
  index: number;
  draft: DraftQuestion;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<DraftQuestion>) => void;
}>) {
  const d = props.draft;
  const TypeIcon = TYPE_ICONS[d.questionType];
  const inactive = d.enabled === false;

  return (
    <article
      className={[
        'rounded-xl border border-zinc-200/90 bg-white shadow-sm',
        inactive ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-600">
            {props.index + 1}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
            <TypeIcon className="h-3 w-3" />
            {questionTypeShortLabel(d.questionType)}
          </span>
          {d.required ? (
            <span className="text-[10px] font-semibold uppercase text-amber-700">Obligatoire</span>
          ) : null}
          {inactive ? (
            <span className="text-[10px] font-semibold text-zinc-500">Désactivée</span>
          ) : null}
        </div>
        {props.confirmDelete ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={props.onCancelDelete}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={props.onDelete}
              className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white"
            >
              Supprimer
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={props.onConfirmDelete}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Supprimer la question"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="block">
          <FieldLabel>Libellé affiché</FieldLabel>
          <input
            className={inputCls()}
            value={d.label}
            onChange={(e) => props.onChange({ label: e.target.value })}
            placeholder="ex. Niveau d'essence"
          />
        </label>
        <label className="block">
          <FieldLabel>Texte d’aide (optionnel)</FieldLabel>
          <input
            className={inputCls()}
            value={d.helpText ?? ''}
            onChange={(e) => props.onChange({ helpText: e.target.value })}
            placeholder="Consigne pour l’agent sur tablette"
          />
        </label>

        <div>
          <FieldLabel>Type de réponse</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUESTION_TYPE_ORDER.map((t) => {
              const Icon = TYPE_ICONS[t];
              const on = d.questionType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => props.onChange({ questionType: t })}
                  className={[
                    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition',
                    on
                      ? 'border-[#416B9F] bg-[#416B9F]/10 text-[#416B9F]'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                  ].join(' ')}
                  title={CHECK_QUESTION_TYPE_LABELS[t]}
                >
                  <Icon className="h-3 w-3" />
                  {questionTypeShortLabel(t)}
                </button>
              );
            })}
          </div>
        </div>

        {d.questionType === 'SELECT' ? (
          <label className="block">
            <FieldLabel>Choix possibles (un par ligne)</FieldLabel>
            <textarea
              className={`${inputCls()} resize-none font-mono text-[13px]`}
              rows={3}
              value={d.optionsText ?? ''}
              onChange={(e) => props.onChange({ optionsText: e.target.value })}
              placeholder={'Oui\nNon\nN/A'}
            />
          </label>
        ) : null}

        {d.questionType === 'PHOTO' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Photos minimum</FieldLabel>
              <input
                type="number"
                min={0}
                max={10}
                className={inputCls()}
                value={d.photoMinCount ?? 1}
                onChange={(e) => props.onChange({ photoMinCount: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            <label className="block">
              <FieldLabel>Photos maximum</FieldLabel>
              <input
                type="number"
                min={1}
                max={10}
                className={inputCls()}
                value={d.photoMaxCount ?? 3}
                onChange={(e) => props.onChange({ photoMaxCount: parseInt(e.target.value, 10) || 1 })}
              />
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-6 pt-1">
          <RoundCheckbox
            checked={d.required ?? true}
            onChange={(v) => props.onChange({ required: v })}
            label="Réponse obligatoire"
          />
          <RoundCheckbox
            checked={d.enabled ?? true}
            onChange={(v) => props.onChange({ enabled: v })}
            label="Afficher sur tablette"
          />
        </div>
      </div>
    </article>
  );
}
