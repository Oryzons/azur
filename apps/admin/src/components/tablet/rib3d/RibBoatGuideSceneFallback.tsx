import type { CheckFlowGuideKind } from '@/lib/checkFlowPhotoGuide';
import { RIB_CAMERA_PRESETS } from './ribBoatPresets';

export function RibBoatGuideSceneFallback({ kind }: Readonly<{ kind: CheckFlowGuideKind }>) {
  const preset = RIB_CAMERA_PRESETS[kind];
  return (
    <div className="flex h-56 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-900 to-sky-700 text-sm font-medium text-white/80 sm:h-64">
      <div className="text-center">
        <div className="mx-auto mb-2 h-8 w-8 animate-pulse rounded-full bg-white/20" />
        Chargement 3D… {preset.shotLabel}
      </div>
    </div>
  );
}
