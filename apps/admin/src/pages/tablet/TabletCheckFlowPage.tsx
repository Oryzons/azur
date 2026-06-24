import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { CHECK_FLOW_SUBMIT_GRACE_DAYS } from '@/lib/checkFlowTabletAccess';
import { answersFromSubmission } from '@/lib/checkFlowFormPrefill';
import { isQuestionStepComplete } from '@/lib/checkFlowPhotoGuide';
import { TabletSubmissionDetail } from '@/components/tablet/TabletSubmissionDetail';
import { TabletCheckFlowStep, TabletCheckFlowSignatures } from '@/components/tablet/TabletCheckFlowStep';
import { TabletCheckFlowStepTransition } from '@/components/tablet/TabletCheckFlowStepTransition';
import {
  useCheckFlowStore,
  type CheckFlowKind,
  type CheckFlowQuestion,
  type CheckFlowSubmissionSummary,
} from '@/stores/checkFlow';
import { dispatchTabletCalendarRefresh } from '@/lib/tabletRealtime';
import { CF, type CfStepDirection } from '@/lib/tabletCheckFlowTheme';
import { extractApiErrorMessage } from '@/lib/apiError';
import { fileToCompressedDataUrl } from '@/lib/mediaPhotos';

const KIND_LABEL: Record<CheckFlowKind, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
};

const WIZARD_FORM_ID = 'tablet-check-flow-wizard';

type Screen = 'loading' | 'choose' | 'edit' | 'submit' | 'view' | 'expired' | 'payment_required';

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
  const [stepDirection, setStepDirection] = useState<CfStepDirection>('forward');

  const enabledQuestions = questions.filter((q) => q.enabled);
  const stepTotal = enabledQuestions.length + 1;
  const isSignatureStep = stepIndex >= enabledQuestions.length;
  const progressPct = stepTotal > 0 ? Math.round(((stepIndex + 1) / stepTotal) * 100) : 0;
  const inWizard = screen === 'submit' || screen === 'edit';

  useEffect(() => {
    setStepIndex(0);
    setStepDirection('forward');
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

        if (access.mode === 'payment_required') {
          if (!cancelled) setScreen('payment_required');
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
    setStepDirection('forward');
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
    if (stepIndex < stepTotal - 1) {
      setStepDirection('forward');
      setStepIndex((i) => i + 1);
    }
  }

  function goPrev() {
    setError('');
    if (stepIndex > 0) {
      setStepDirection('back');
      setStepIndex((i) => i - 1);
    }
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

  const stepTransitionKey = isSignatureStep ? 'signatures' : currentQuestion?.id ?? 'step';

  return (
    <div className={CF.screen}>
      <div className={CF.inner}>
        {!inWizard ? (
          <Link to="/tablette/aujourdhui" className={`${CF.btnGhost} -ml-2 mb-2`}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Retour
          </Link>
        ) : null}

        {inWizard ? (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className={CF.stepMeta}>{KIND_LABEL[kind]}</p>
              <p className={`${CF.stepMeta} tabular-nums`}>{progressPct}%</p>
            </div>
            <div className={CF.progressTrack}>
              <div className={CF.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        ) : (
          <header className="bc-cf-fade-up mb-6">
            <h1 className={CF.title}>{KIND_LABEL[kind]}</h1>
          </header>
        )}

        {screen === 'loading' && !error ? (
          <div className="bc-cf-fade-up flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
            <p className="text-sm font-medium">Chargement…</p>
          </div>
        ) : null}

        {screen === 'loading' && error ? (
          <p className={`bc-cf-fade-up ${CF.error}`}>{error}</p>
        ) : null}

        {screen === 'choose' && detail ? (
          <div className="bc-cf-fade-up space-y-5">
            <div className={CF.card}>
              <p className={CF.label}>Déjà enregistré</p>
              <p className={`mt-2 ${CF.subtitle}`}>
                Ce {KIND_LABEL[kind].toLowerCase()} a été effectué aujourd&apos;hui. Consultez le
                résumé ou modifiez le formulaire.
              </p>
            </div>
            <div className="grid gap-3">
              <button type="button" onClick={() => setScreen('view')} className={CF.btnSecondary}>
                Voir le résumé
              </button>
              <button type="button" onClick={() => enterEdit(detail)} className={CF.btnPrimary}>
                Modifier
              </button>
            </div>
          </div>
        ) : null}

        {screen === 'expired' ? (
          <div className={`bc-cf-fade-up ${CF.card}`}>
            <p className={CF.label}>Indisponible</p>
            <h2 className="mt-2 text-lg font-bold text-zinc-900">Délai dépassé</h2>
            <p className={`mt-2 ${CF.subtitle}`}>
              Ce {KIND_LABEL[kind].toLowerCase()} ne peut plus être effectué : plus de{' '}
              {CHECK_FLOW_SUBMIT_GRACE_DAYS} jours se sont écoulés depuis le{' '}
              {kind === 'CHECK_IN' ? 'départ' : 'retour'} de la réservation.
            </p>
            {error ? <p className={`mt-4 ${CF.error}`}>{error}</p> : null}
          </div>
        ) : null}

        {screen === 'payment_required' ? (
          <div className={`bc-cf-fade-up ${CF.card}`}>
            <p className={CF.label}>Indisponible</p>
            <h2 className="mt-2 text-lg font-bold text-zinc-900">Paiement requis</h2>
            <p className={`mt-2 ${CF.subtitle}`}>
              Le {KIND_LABEL[kind].toLowerCase()} n&apos;est accessible que lorsque la réservation est
              marquée comme payée ou payée partiellement.
            </p>
            {error ? <p className={`mt-4 ${CF.error}`}>{error}</p> : null}
          </div>
        ) : null}

        {screen === 'view' && detail ? (
          <div className="bc-cf-fade-up space-y-4">
            {allowsChoose ? (
              <button
                type="button"
                onClick={() => setScreen('choose')}
                className={`${CF.btnGhost} -ml-2`}
              >
                <ChevronLeft className="h-4 w-4" />
                Retour au choix
              </button>
            ) : (
              <p className={`${CF.subtitle} px-1`}>Consultation seule — formulaire déjà enregistré.</p>
            )}
            <TabletSubmissionDetail row={detail} />
          </div>
        ) : null}

        {screen === 'view' && !detail && !error ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
          </div>
        ) : null}

        {screen === 'view' && error ? <p className={CF.error}>{error}</p> : null}

        {(screen === 'submit' || screen === 'edit') && enabledQuestions.length === 0 ? (
          <p className="bc-cf-fade-up text-center text-sm text-zinc-500">
            Aucune question configurée. Contactez l&apos;administrateur.
          </p>
        ) : null}

        {(screen === 'submit' || screen === 'edit') && enabledQuestions.length > 0 ? (
          <form id={WIZARD_FORM_ID} onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            {screen === 'edit' ? (
              <button
                type="button"
                onClick={() => setScreen('choose')}
                className={`${CF.btnGhost} -ml-2`}
              >
                <ChevronLeft className="h-4 w-4" />
                Annuler
              </button>
            ) : null}

            {error ? <p className={CF.error}>{error}</p> : null}

            <TabletCheckFlowStepTransition stepKey={stepTransitionKey} direction={stepDirection}>
              {!isSignatureStep && currentQuestion ? (
                <TabletCheckFlowStep
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
            </TabletCheckFlowStepTransition>
          </form>
        ) : null}
      </div>

      {inWizard && enabledQuestions.length > 0 ? (
        <div className={CF.footer}>
          <div className="mx-auto flex w-full max-w-lg items-center gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goPrev}
                className={`${CF.btnSecondary} !w-auto shrink-0 !px-5`}
                aria-label="Étape précédente"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            {stepIndex < stepTotal - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!currentStepComplete}
                className={`${CF.btnPrimary} flex-1`}
              >
                Continuer
                <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
              </button>
            ) : (
              <button
                type="submit"
                form={WIZARD_FORM_ID}
                disabled={saving || !currentStepComplete}
                className={`${CF.btnPrimary} flex-1`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Enregistrement…
                  </>
                ) : screen === 'edit' ? (
                  'Enregistrer'
                ) : (
                  'Valider'
                )}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
