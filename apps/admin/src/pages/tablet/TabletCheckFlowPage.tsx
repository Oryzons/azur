import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { CHECK_FLOW_SUBMIT_GRACE_DAYS } from '@/lib/checkFlowTabletAccess';
import { answersFromSubmission } from '@/lib/checkFlowFormPrefill';
import { isQuestionStepComplete } from '@/lib/checkFlowPhotoGuide';
import { TabletSubmissionDetail } from '@/components/tablet/TabletSubmissionDetail';
import { TabletCheckFlowStep, TabletCheckFlowSignatures } from '@/components/tablet/TabletCheckFlowStep';
import {
  useCheckFlowStore,
  type CheckFlowKind,
  type CheckFlowQuestion,
  type CheckFlowSubmissionSummary,
} from '@/stores/checkFlow';
import { dispatchTabletCalendarRefresh } from '@/lib/tabletRealtime';
import { TB } from '@/lib/tabletTheme';
import { extractApiErrorMessage } from '@/lib/apiError';
import { fileToCompressedDataUrl } from '@/lib/mediaPhotos';

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
  const [stepIndex, setStepIndex] = useState(0);

  const enabledQuestions = questions.filter((q) => q.enabled);
  const stepTotal = enabledQuestions.length + 1;
  const isSignatureStep = stepIndex >= enabledQuestions.length;
  const progressPct = stepTotal > 0 ? Math.round(((stepIndex + 1) / stepTotal) * 100) : 0;

  useEffect(() => {
    setStepIndex(0);
  }, [reservationId, kind, screen]);

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
    setStepIndex(0);
    setScreen('edit');
    setError('');
  }

  const currentQuestion = enabledQuestions[stepIndex];
  const currentStepComplete = useMemo(() => {
    if (isSignatureStep) return Boolean(clientSignature && loueurSignature);
    if (!currentQuestion) return false;
    return isQuestionStepComplete(currentQuestion, answers[currentQuestion.id]);
  }, [isSignatureStep, clientSignature, loueurSignature, currentQuestion, answers]);

  function goNext() {
    if (!currentStepComplete) {
      setError('Complétez cette étape avant de continuer.');
      return;
    }
    setError('');
    if (stepIndex < stepTotal - 1) setStepIndex((i) => i + 1);
  }

  function goPrev() {
    setError('');
    if (stepIndex > 0) setStepIndex((i) => i - 1);
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
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
          {screen === 'edit' ? (
            <button
              type="button"
              onClick={() => setScreen('choose')}
              className="text-sm font-semibold text-[#7eb3e8] hover:underline"
            >
              ← Annuler la modification
            </button>
          ) : null}

          <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-zinc-200/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
              <span>Parcours guidé</span>
              <span className="tabular-nums text-sky-700">{progressPct} %</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-700 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {error ? <p className={TB.error}>{error}</p> : null}

          {!isSignatureStep && currentQuestion ? (
            <TabletCheckFlowStep
              key={currentQuestion.id}
              q={currentQuestion}
              value={answers[currentQuestion.id]}
              onText={(t) => setText(currentQuestion.id, t)}
              onComment={(c) => setComment(currentQuestion.id, c)}
              onPhoto={(f) => void addPhoto(currentQuestion, f)}
              stepIndex={stepIndex}
              stepTotal={stepTotal}
            />
          ) : (
            <TabletCheckFlowSignatures
              kind={kind}
              clientSignature={clientSignature}
              loueurSignature={loueurSignature}
              onClientChange={setClientSignature}
              onLoueurChange={setLoueurSignature}
              stepIndex={stepIndex}
              stepTotal={stepTotal}
            />
          )}

          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button type="button" onClick={goPrev} className={`flex-1 ${TB.btnSecondary} inline-flex items-center justify-center gap-1`}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Précédent
              </button>
            ) : (
              <div className="flex-1" />
            )}
            {stepIndex < stepTotal - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!currentStepComplete}
                className={`flex-1 ${TB.btnPrimary} inline-flex items-center justify-center gap-1 disabled:opacity-50`}
              >
                Suivant
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={saving || !currentStepComplete} className={`flex-1 ${TB.btnPrimary} disabled:opacity-50`}>
                {saving
                  ? 'Enregistrement…'
                  : screen === 'edit'
                    ? 'Enregistrer les modifications'
                    : 'Valider le check'}
              </button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}
