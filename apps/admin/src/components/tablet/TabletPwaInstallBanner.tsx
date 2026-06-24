import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export function TabletPwaInstallBanner() {
  const { showBanner, canNativeInstall, isIos, install, dismiss } = usePwaInstall();

  if (!showBanner) return null;

  return (
    <div
      className="fixed left-3 right-3 z-50 rounded-2xl border border-[#416B9F]/25 bg-white p-4 shadow-xl shadow-zinc-400/20"
      style={{ bottom: 'calc(6.25rem + env(safe-area-inset-bottom))' }}
      role="region"
      aria-label="Installer l’application"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/10 text-[#416B9F]">
          <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-900">Installer Azure Agent</p>
          <p className="mt-0.5 text-xs leading-snug text-zinc-600">
            {isIos && !canNativeInstall ? (
              <>
                Touchez <Share className="mb-0.5 inline h-3.5 w-3.5" aria-hidden /> puis{' '}
                <strong>Sur l’écran d’accueil</strong> pour utiliser l’app en plein écran.
              </>
            ) : (
              'Ajoutez l’app sur votre téléphone pour un accès rapide au check-in et check-out.'
            )}
          </p>
          {canNativeInstall ? (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#416B9F] px-4 text-sm font-semibold text-white shadow-sm touch-manipulation active:scale-[0.98]"
            >
              Installer
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Masquer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
