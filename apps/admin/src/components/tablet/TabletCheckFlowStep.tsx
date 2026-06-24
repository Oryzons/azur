import { useEffect } from 'react';
import { Camera, Check, ChevronDown } from 'lucide-react';
import { CheckFlowGuideIllustration } from '@/components/tablet/CheckFlowGuideIllustration';
import { SignaturePad } from '@/components/tablet/SignaturePad';
import { TabletPhotoCapture } from '@/components/tablet/TabletPhotoCapture';
import { resolveCheckFlowGuide } from '@/lib/checkFlowPhotoGuide';
import { CF } from '@/lib/tabletCheckFlowTheme';
import { questionOptions, type CheckFlowQuestion } from '@/stores/checkFlow';

type AnswerValue = { text?: string; photos?: string[]; comment?: string };

type Props = Readonly<{
  q: CheckFlowQuestion;
  value?: AnswerValue;
  onText: (t: string) => void;
  onComment: (c: string) => void;
  onPhoto: (f: File) => void;
  stepIndex: number;
  stepTotal: number;
}>;

export function TabletCheckFlowStep(props: Props) {
  const { q, value, onText, onComment, onPhoto, stepIndex, stepTotal } = props;
  const guide = resolveCheckFlowGuide(q);
  const opts = questionOptions(q);
  const photoCount = value?.photos?.length ?? 0;
  const photoComplete =
    q.questionType !== 'PHOTO' || !q.required || photoCount >= q.photoMinCount;

  return (
    <div className="space-y-5">
      <header>
        <p className={CF.label}>
          Étape {stepIndex + 1} sur {stepTotal}
        </p>
        <h2 className={`mt-2 ${CF.title}`}>{q.label}</h2>
        {q.helpText ? <p className={CF.subtitle}>{q.helpText}</p> : null}
      </header>

      <div className={CF.hero}>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            <p className={CF.label}>Guide visuel</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-800">{guide.title}</p>
          </div>
          {photoComplete && q.questionType === 'PHOTO' && photoCount > 0 ? (
            <span className={CF.badge}>
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              {photoCount}/{q.photoMaxCount}
            </span>
          ) : null}
        </div>
        <CheckFlowGuideIllustration kind={guide.kind} />
      </div>

      {guide.tips.length > 0 ? (
        <div className={CF.cardSoft}>
          <p className={CF.label}>À vérifier</p>
          <ul className="mt-3 space-y-2.5">
            {guide.tips.map((tip) => (
              <li key={tip} className="flex gap-3 text-sm leading-snug text-zinc-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={`${CF.card} space-y-5`}>
        {q.questionType === 'TEXT' ? (
          <textarea
            className={`${CF.input} min-h-[5rem] resize-none`}
            rows={4}
            placeholder="Votre réponse…"
            value={value?.text ?? ''}
            onChange={(e) => onText(e.target.value)}
          />
        ) : null}

        {q.questionType === 'BOOLEAN' ? (
          <div className="grid grid-cols-2 gap-3">
            {(['true', 'false'] as const).map((v) => {
              const selected = value?.text === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onText(v)}
                  className={[
                    CF.optionBase,
                    selected ? CF.optionSelected : CF.optionIdle,
                  ].join(' ')}
                >
                  {selected ? (
                    <Check className="absolute right-3 top-3 h-4 w-4" strokeWidth={2.5} aria-hidden />
                  ) : null}
                  {v === 'true' ? 'Oui' : 'Non'}
                </button>
              );
            })}
          </div>
        ) : null}

        {q.questionType === 'SELECT' ? (
          <div className="relative">
            <select
              className={CF.select}
              value={value?.text ?? ''}
              onChange={(e) => onText(e.target.value)}
            >
              <option value="">Choisir une option</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
          </div>
        ) : null}

        {q.questionType === 'FUEL_GAUGE' ? <FuelGaugeField value={value?.text} onChange={onText} /> : null}

        {q.questionType === 'PHOTO' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-2xl bg-zinc-100 px-3.5 py-3 text-sm text-zinc-700">
              <Camera className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <span>
                {q.photoMinCount === q.photoMaxCount
                  ? `${q.photoMinCount} photo${q.photoMinCount > 1 ? 's' : ''} requise${q.photoMinCount > 1 ? 's' : ''}`
                  : `${q.photoMinCount} à ${q.photoMaxCount} photos`}
              </span>
            </div>
            {photoCount > 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {(value?.photos ?? []).map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-zinc-200"
                  >
                    <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-zinc-900/75 px-2 py-0.5 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {photoCount < q.photoMaxCount ? (
              <TabletPhotoCapture
                onPhoto={onPhoto}
                guideKind={guide.kind}
                cameraHint={guide.cameraHint}
              />
            ) : null}
          </div>
        ) : null}

        <label className="block">
          <span className={CF.label}>Commentaire</span>
          <textarea
            className={`${CF.input} mt-2 min-h-[4.5rem] resize-none text-sm`}
            rows={2}
            placeholder="Optionnel"
            value={value?.comment ?? ''}
            onChange={(e) => onComment(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function FuelGaugeField(props: { value?: string; onChange: (v: string) => void }) {
  const { value, onChange } = props;
  const level =
    value !== undefined && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : 50;

  useEffect(() => {
    if (value === undefined || value === '') onChange('50');
  }, [value, onChange]);

  return (
    <div className="space-y-4">
      <div className="relative h-16 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400 transition-[width] duration-300 ease-out"
          style={{ width: `${level}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums text-zinc-900">
          {level}%
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={level}
        onChange={(e) => onChange(e.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
        aria-label="Niveau d'essence"
      />
      <div className="flex justify-between text-xs font-medium text-zinc-400">
        <span>Vide</span>
        <span>Plein</span>
      </div>
    </div>
  );
}

export function TabletCheckFlowSignatures(props: Readonly<{
  kind: 'CHECK_IN' | 'CHECK_OUT';
  clientSignature: string | null;
  loueurSignature: string | null;
  onClientChange: (v: string | null) => void;
  onLoueurChange: (v: string | null) => void;
  stepIndex: number;
  stepTotal: number;
}>) {
  const { kind, clientSignature, loueurSignature, onClientChange, onLoueurChange, stepIndex, stepTotal } =
    props;

  return (
    <div className="space-y-5">
      <header>
        <p className={CF.label}>
          Étape {stepIndex + 1} sur {stepTotal}
        </p>
        <h2 className={`mt-2 ${CF.title}`}>Signatures</h2>
        <p className={CF.subtitle}>
          Le client et le loueur valident ce {kind === 'CHECK_IN' ? 'départ' : 'retour'}.
        </p>
      </header>

      <div className={`${CF.card} space-y-6`}>
        <SignaturePad label="Signature client" value={clientSignature} onChange={onClientChange} />
        <div className="h-px bg-zinc-100" />
        <SignaturePad label="Signature loueur" value={loueurSignature} onChange={onLoueurChange} />
      </div>
    </div>
  );
}
