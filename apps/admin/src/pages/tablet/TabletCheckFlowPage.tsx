import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CHECK_FLOW_SUBMIT_GRACE_DAYS } from '@/lib/checkFlowTabletAccess';
import { answersFromSubmission } from '@/lib/checkFlowFormPrefill';
import { TabletSubmissionDetail } from '@/components/tablet/TabletSubmissionDetail';
import {
  questionOptions,
  useCheckFlowStore,
  type CheckFlowKind,
  type CheckFlowQuestion,
  type CheckFlowSubmissionSummary,
} from '@/stores/checkFlow';
import { extractApiErrorMessage } from '@/lib/apiError';
import { fileToCompressedDataUrl } from '@/lib/mediaPhotos';
import { TabletPhotoCapture } from '@/components/tablet/TabletPhotoCapture';
import { SignaturePad } from '@/components/tablet/SignaturePad';
import { dispatchTabletCalendarRefresh } from '@/lib/tabletRealtime';
import { TB } from '@/lib/tabletTheme';

const KIND_LABEL: Record<CheckFlowKind, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
};

type Screen = 'loading' | 'choose' | 'edit' | 'submit' | 'view' | 'expired';

export function TabletCheckFlowPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const location = useLocation();
  const kind: CheckFlowKind = location.pathname.includes('check-out') ? 'CHECK_OUT' : 'CHECK_IN';
  const navigate = useNavigate();

  const fetchQuestions = useCheckFlowStore((s) => s.fetchQuestions);
  const fetchReservationStatus = useCheckFlowStore((s) => s.fetchReservationStatus);
  const getSubmission = useCheckFlowStore((s) => s.getSubmission);
  const submit = useCheckFlowStore((s) => s.submit);
  const updateSubmission = useCheckFlowStore((s) => s.updateSubmission);
  const questions =
    kind === 'CHECK_IN'
      ? useCheckFlowStore((s) => s.questionsCheckIn)
      : useCheckFlowStore((s) => s.questionsCheckOut);

  const [screen, setScreen] = useState<Screen>('loading');
  const [allowsChoose, setAllowsChoose] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CheckFlowSubmissionSummary | null>(null);
  const [answers, setAnswers] = useState<
    Record<string, { text?: string; photos?: string[]; comment?: string }>
  >({});
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [loueurSignature, setLoueurSignature] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    setScreen('loading');
    setAllowsChoose(false);
    setEditingId(null);
    setDetail(null);
    setAnswers({});
    setClientSignature(null);
    setLoueurSignature(null);
    setError('');

    void (async () => {
      try {
        const status = await fetchReservationStatus(reservationId);
        if (cancelled) return;
        const access = kind === 'CHECK_IN' ? status.checkInAccess : status.checkOutAccess;

        if (access.mode === 'done_today' && access.submissionId) {
          setAllowsChoose(true);
          const row = await getSubmission(access.submissionId);
          if (cancelled) return;
          setDetail(row);
          await fetchQuestions(kind);
          setScreen('choose');
          return;
        }

        if (access.mode === 'view' && access.submissionId) {
          const row = await getSubmission(access.submissionId);
          if (!cancelled) {
            setDetail(row);
            setScreen('view');
          }
          return;
        }

        if (access.mode === 'submit') {
          await fetchQuestions(kind);
          if (!cancelled) setScreen('submit');
          return;
        }

        if (!cancelled) setScreen('expired');
      } catch (err) {
        if (!cancelled) {
          setError(extractApiErrorMessage(err, 'Impossible de charger le flux.'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reservationId, kind, fetchReservationStatus, getSubmission, fetchQuestions]);

  const enabledQuestions = questions.filter((q) => q.enabled);

  function setText(qId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], text } }));
  }

  function setComment(qId: string, comment: string) {
    setAnswers((prev) => ({ ...prev, [qId]: { ...prev[qId], comment } }));
  }

  async function addPhoto(q: CheckFlowQuestion, file: File) {
    try {
      const url = await fileToCompressedDataUrl(file);
      setAnswers((prev) => {
        const cur = prev[q.id]?.photos ?? [];
        if (cur.length >= q.photoMaxCount) return prev;
        return { ...prev, [q.id]: { ...prev[q.id], photos: [...cur, url] } };
      });
    } catch {
      setError('Impossible de traiter la photo.');
    }
  }

  function enterEdit(row: CheckFlowSubmissionSummary) {
    setAnswers(answersFromSubmission(row));
    setClientSignature(row.clientSignatureUrl ?? null);
    setLoueurSignature(row.agentSignatureUrl ?? null);
    setEditingId(row.id);
    setScreen('edit');
    setError('');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reservationId) return;
    if (!clientSignature || !loueurSignature) {
      setError('Les signatures du client et du loueur sont obligatoires.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = enabledQuestions.map((q) => {
        const a = answers[q.id];
        const comment = a?.comment?.trim() || null;
        const base = { questionId: q.id, comment };
        if (q.questionType === 'PHOTO') {
          return { ...base, photos: a?.photos ?? [] };
        }
        if (q.questionType === 'BOOLEAN') {
          return { ...base, valueText: a?.text === 'true' ? 'true' : 'false' };
        }
        if (q.questionType === 'FUEL_GAUGE') {
          return { ...base, valueText: a?.text ?? '' };
        }
        return { ...base, valueText: a?.text ?? '' };
      });
      if (editingId) {
        await updateSubmission(editingId, {
          answers: payload,
          clientSignature,
          agentSignature: loueurSignature,
        });
      } else {
        await submit({
          reservationId,
          kind,
          answers: payload,
          clientSignature,
          agentSignature: loueurSignature,
        });
      }
      dispatchTabletCalendarRefresh();
      navigate('/tablette/aujourdhui', { replace: true });
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Enregistrement impossible.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={TB.page}>
      <Link to="/tablette/aujourdhui" className={TB.linkBack}>
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>
      <h1 className={`mt-4 ${TB.h1}`}>{KIND_LABEL[kind]}</h1>

      {screen === 'loading' && !error ? (
        <p className={`mt-6 ${TB.empty}`}>Chargement…</p>
      ) : null}

      {screen === 'loading' && error ? (
        <p className={`mt-6 ${TB.error}`}>{error}</p>
      ) : null}

      {screen === 'choose' && detail ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-zinc-600">
            {KIND_LABEL[kind]} effectué aujourd&apos;hui — consultez le résumé ou modifiez le formulaire.
          </p>
          <div className="grid gap-3">
            <button type="button" onClick={() => setScreen('view')} className={TB.btnSecondary}>
              Voir le résumé
            </button>
            <button type="button" onClick={() => enterEdit(detail)} className={TB.btnPrimary}>
              Modifier
            </button>
          </div>
        </div>
      ) : null}

      {screen === 'expired' ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-950">
          <p className="font-semibold">Délai dépassé</p>
          <p className="mt-2 text-amber-900/90">
            Ce {KIND_LABEL[kind].toLowerCase()} ne peut plus être effectué : plus de{' '}
            {CHECK_FLOW_SUBMIT_GRACE_DAYS} jours se sont écoulés depuis le{' '}
            {kind === 'CHECK_IN' ? 'départ' : 'retour'} de la réservation.
          </p>
          {error ? <p className={`mt-3 ${TB.error}`}>{error}</p> : null}
        </div>
      ) : null}

      {screen === 'view' && detail ? (
        <div className="mt-6">
          {allowsChoose ? (
            <button
              type="button"
              onClick={() => setScreen('choose')}
              className="mb-4 text-sm font-semibold text-[#416B9F] hover:underline"
            >
              ← Retour au choix
            </button>
          ) : (
            <p className="mb-4 text-sm text-zinc-500">Consultation seule — formulaire déjà enregistré.</p>
          )}
          <TabletSubmissionDetail row={detail} />
        </div>
      ) : null}

      {screen === 'view' && !detail && !error ? (
        <p className={`mt-6 ${TB.empty}`}>Chargement du détail…</p>
      ) : null}

      {screen === 'view' && error ? (
        <p className={`mt-6 ${TB.error}`}>{error}</p>
      ) : null}

      {(screen === 'submit' || screen === 'edit') && enabledQuestions.length === 0 ? (
        <p className={`mt-6 ${TB.empty}`}>Aucune question configurée. Contactez l’administrateur.</p>
      ) : null}

      {(screen === 'submit' || screen === 'edit') && enabledQuestions.length > 0 ? (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-6">
          {screen === 'edit' ? (
            <button
              type="button"
              onClick={() => setScreen('choose')}
              className="text-sm font-semibold text-[#7eb3e8] hover:underline"
            >
              ← Annuler la modification
            </button>
          ) : null}
          {error ? <p className={TB.error}>{error}</p> : null}
          {enabledQuestions.map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={answers[q.id]}
              onText={(t) => setText(q.id, t)}
              onComment={(c) => setComment(q.id, c)}
              onPhoto={(f) => void addPhoto(q, f)}
            />
          ))}

          <section className={`space-y-4 ${TB.card}`}>
            <h2 className="text-base font-bold text-zinc-900">Signatures</h2>
            <p className="text-sm text-zinc-600">
              Le client et le loueur signent pour valider ce {kind === 'CHECK_IN' ? 'check-in' : 'check-out'}.
            </p>
            <SignaturePad label="Signature du client" value={clientSignature} onChange={setClientSignature} />
            <SignaturePad label="Signature du loueur" value={loueurSignature} onChange={setLoueurSignature} />
          </section>
          <button
            type="submit"
            disabled={saving}
            className={`w-full ${TB.btnPrimary} py-4 text-base`}
          >
            {saving
              ? 'Enregistrement…'
              : screen === 'edit'
                ? 'Enregistrer les modifications'
                : 'Valider'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function QuestionField(props: {
  q: CheckFlowQuestion;
  value?: { text?: string; photos?: string[]; comment?: string };
  onText: (t: string) => void;
  onComment: (c: string) => void;
  onPhoto: (f: File) => void;
}) {
  const { q, value, onText, onComment, onPhoto } = props;
  const opts = questionOptions(q);

  return (
    <fieldset className={TB.card}>
      <legend className="text-base font-semibold text-zinc-900">
        {q.label}
        {q.required ? <span className="text-red-600"> *</span> : null}
      </legend>
      {q.helpText ? <p className="mt-1 text-sm text-zinc-500">{q.helpText}</p> : null}

      {q.questionType === 'TEXT' ? (
        <textarea
          className={`mt-3 ${TB.input}`}
          rows={3}
          value={value?.text ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      ) : null}

      {q.questionType === 'BOOLEAN' ? (
        <div className="mt-3 flex gap-2">
          {(['true', 'false'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onText(v)}
              className={[
                'flex-1 rounded-xl py-3 text-sm font-semibold',
                value?.text === v ? 'bg-[#416B9F] text-white' : 'border border-zinc-200/90 bg-zinc-50 text-zinc-600',
              ].join(' ')}
            >
              {v === 'true' ? 'Oui' : 'Non'}
            </button>
          ))}
        </div>
      ) : null}

      {q.questionType === 'SELECT' ? (
        <select
          className={`mt-3 ${TB.input}`}
          value={value?.text ?? ''}
          onChange={(e) => onText(e.target.value)}
        >
          <option value="">— Choisir —</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : null}

      {q.questionType === 'FUEL_GAUGE' ? <FuelGaugeField value={value?.text} onChange={onText} /> : null}

      {q.questionType === 'PHOTO' ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-zinc-500">
            {q.photoMinCount} à {q.photoMaxCount} photo(s) — prise directe avec l&apos;appareil
          </p>
          <div className="flex flex-wrap gap-2">
            {(value?.photos ?? []).map((src, i) => (
              <img key={i} src={src} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-zinc-200" />
            ))}
          </div>
          {(value?.photos?.length ?? 0) < q.photoMaxCount ? (
            <TabletPhotoCapture onPhoto={onPhoto} />
          ) : null}
        </div>
      ) : null}

      <label className="mt-4 block">
        <span className={TB.label}>Commentaire (optionnel)</span>
        <textarea
          className={`mt-1.5 ${TB.input} text-sm`}
          rows={2}
          placeholder="Précision, remarque…"
          value={value?.comment ?? ''}
          onChange={(e) => onComment(e.target.value)}
        />
      </label>
    </fieldset>
  );
}

function FuelGaugeField(props: { value?: string; onChange: (v: string) => void }) {
  const { value, onChange } = props;
  const level =
    value !== undefined && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : 50;

  useEffect(() => {
    if (value === undefined || value === '') onChange('50');
  }, [value, onChange]);

  const fillStyle = { width: `${level}%` };

  return (
    <div className="mt-4 space-y-4">
      <div className="relative h-10 overflow-hidden rounded-xl border border-zinc-200/90 bg-white">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 via-amber-400 to-emerald-500 transition-[width] duration-150"
          style={fillStyle}
        />
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-zinc-900 drop-shadow">
          {level} %
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={level}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-amber-400"
        aria-label="Niveau d'essence"
      />
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Vide</span>
        <span>Plein</span>
      </div>
    </div>
  );
}
