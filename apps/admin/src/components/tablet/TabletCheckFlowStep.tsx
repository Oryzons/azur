import { useEffect } from 'react';
import { Camera, CheckCircle2, ChevronRight } from 'lucide-react';
import { CheckFlowGuideIllustration } from '@/components/tablet/CheckFlowGuideIllustration';
import { SignaturePad } from '@/components/tablet/SignaturePad';
import { TabletPhotoCapture } from '@/components/tablet/TabletPhotoCapture';
import { resolveCheckFlowGuide } from '@/lib/checkFlowPhotoGuide';
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
    <div className="space-y-4">
      {/* Hero 3D */}
      <div className="overflow-hidden rounded-3xl shadow-xl shadow-sky-900/15 ring-1 ring-white/60">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#0c4a6e] to-[#1e5f8f] px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200/90">
              Étape {stepIndex + 1} / {stepTotal}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">{guide.title}</p>
          </div>
          {photoComplete && q.questionType === 'PHOTO' && photoCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-emerald-100 ring-1 ring-emerald-300/40">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {photoCount}/{q.photoMaxCount}
            </span>
          ) : null}
        </div>
        <CheckFlowGuideIllustration kind={guide.kind} />
      </div>

      {/* Conseils */}
      <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
        <ul className="space-y-2">
          {guide.tips.map((tip, i) => (
            <li key={tip} className="flex gap-3 text-sm leading-snug text-zinc-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-800">
                {i + 1}
              </span>
              <span className="pt-0.5">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Formulaire */}
      <div className="space-y-4 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">
            {q.label}
            {q.required ? <span className="text-red-500"> *</span> : null}
          </h2>
          {q.helpText ? <p className="mt-1.5 text-sm text-zinc-500">{q.helpText}</p> : null}
        </div>

        {q.questionType === 'TEXT' ? (
          <textarea
            className="w-full min-h-[3.5rem] rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-base text-zinc-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-400/20"
            rows={4}
            placeholder="Saisissez votre réponse…"
            value={value?.text ?? ''}
            onChange={(e) => onText(e.target.value)}
          />
        ) : null}

        {q.questionType === 'BOOLEAN' ? (
          <div className="grid grid-cols-2 gap-3">
            {(['true', 'false'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onText(v)}
                className={[
                  'min-h-[3.5rem] rounded-2xl py-3.5 text-base font-bold touch-manipulation transition active:scale-[0.98]',
                  value?.text === v
                    ? 'bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-lg shadow-sky-900/20'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100',
                ].join(' ')}
              >
                {v === 'true' ? 'Oui' : 'Non'}
              </button>
            ))}
          </div>
        ) : null}

        {q.questionType === 'SELECT' ? (
          <div className="relative">
            <select
              className="w-full min-h-[3.5rem] appearance-none rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 pr-10 text-base text-zinc-900 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-400/20"
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
            <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 rotate-90 text-zinc-400" />
          </div>
        ) : null}

        {q.questionType === 'FUEL_GAUGE' ? <FuelGaugeField value={value?.text} onChange={onText} /> : null}

        {q.questionType === 'PHOTO' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
              <Camera className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              <span>
                {q.photoMinCount === q.photoMaxCount
                  ? `${q.photoMinCount} photo${q.photoMinCount > 1 ? 's' : ''} requise${q.photoMinCount > 1 ? 's' : ''}`
                  : `${q.photoMinCount} à ${q.photoMaxCount} photos`}
              </span>
            </div>
            {photoCount > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {(value?.photos ?? []).map((src, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-2xl ring-2 ring-emerald-400/60">
                    <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">
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
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Commentaire</span>
          <textarea
            className="mt-1.5 w-full rounded-2xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-400/15"
            rows={2}
            placeholder="Précision optionnelle…"
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
      <div className="relative h-14 overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-inner">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-[width] duration-200"
          style={{ width: `${level}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-zinc-900 drop-shadow-sm">
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
        className="h-3 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-amber-500"
        aria-label="Niveau d'essence"
      />
      <div className="flex justify-between text-xs font-medium text-zinc-500">
        <span>Réservoir vide</span>
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
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-[#0c4a6e] to-[#1e5f8f] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200/90">
          Étape {stepIndex + 1} / {stepTotal}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-white">Signatures finales</p>
      </div>
      <section className="space-y-4 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">Validation</h2>
        <p className="text-sm text-zinc-500">
          Le client et le loueur signent pour valider ce {kind === 'CHECK_IN' ? 'check-in' : 'check-out'}.
        </p>
        <SignaturePad label="Signature du client" value={clientSignature} onChange={onClientChange} />
        <SignaturePad label="Signature du loueur" value={loueurSignature} onChange={onLoueurChange} />
      </section>
    </div>
  );
}
