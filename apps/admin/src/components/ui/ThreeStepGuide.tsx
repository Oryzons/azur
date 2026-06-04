import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { dismissGuide, isGuideDismissed } from '@/lib/dismissedGuides';

export type ThreeStepGuideProps = Readonly<{
  /** Clé stable pour la persistance (ex. `extras`, `reservations`). */
  guideKey: string;
  title: string;
  steps: readonly [ReactNode, ReactNode, ReactNode];
}>;

export function ThreeStepGuide({ guideKey, title, steps }: ThreeStepGuideProps) {
  const [visible, setVisible] = useState(() => !isGuideDismissed(guideKey));

  if (!visible) return null;

  function handleDismiss() {
    dismissGuide(guideKey);
    setVisible(false);
  }

  return (
    <div className="relative rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/90 text-zinc-500 shadow-sm transition-colors hover:bg-white hover:text-zinc-800"
        aria-label="Masquer ce guide définitivement"
        title="Ne plus afficher"
      >
        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <h3 className="pr-10 text-sm font-semibold text-zinc-900">{title}</h3>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={index}
            className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              {index + 1}
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
