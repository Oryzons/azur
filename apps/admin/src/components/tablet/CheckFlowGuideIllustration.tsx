import { lazy, Suspense } from 'react';
import type { CheckFlowGuideKind } from '@/lib/checkFlowPhotoGuide';
import { RIB_CAMERA_PRESETS } from '@/components/tablet/rib3d/ribBoatPresets';
import { RibBoatGuideSceneFallback } from '@/components/tablet/rib3d/RibBoatGuideSceneFallback';

const RibBoatGuideScene = lazy(() =>
  import('@/components/tablet/rib3d/RibBoatGuideScene').then((m) => ({ default: m.RibBoatGuideScene })),
);

type Props = Readonly<{
  kind: CheckFlowGuideKind;
  compact?: boolean;
}>;

export function CheckFlowGuideIllustration({ kind, compact }: Props) {
  return (
    <Suspense fallback={<RibBoatGuideSceneFallback kind={kind} />}>
      <RibBoatGuideScene kind={kind} compact={compact} />
    </Suspense>
  );
}

/** Overlay léger dans la caméra (pas de WebGL pour économiser la perf). */
export function CheckFlowCameraOverlay({ kind }: Readonly<{ kind: CheckFlowGuideKind }>) {
  const preset = RIB_CAMERA_PRESETS[kind];
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-28">
      <div className="rounded-2xl bg-black/50 px-4 py-2 text-center backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300">{preset.shotLabel}</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{preset.viewHint}</p>
      </div>
    </div>
  );
}
