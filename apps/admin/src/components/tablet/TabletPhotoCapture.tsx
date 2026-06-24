import type { CheckFlowGuideKind } from '@/lib/checkFlowPhotoGuide';
import { CheckFlowCameraOverlay } from '@/components/tablet/CheckFlowGuideIllustration';
import { CF } from '@/lib/tabletCheckFlowTheme';
import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

type Props = Readonly<{
  onPhoto: (file: File) => void;
  disabled?: boolean;
  guideKind?: CheckFlowGuideKind;
  cameraHint?: string;
}>;

/** Prise de vue directe (caméra) — pas de sélection galerie. */
export function TabletPhotoCapture({ onPhoto, disabled, guideKind, cameraHint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stopStream(), []);

  async function openCamera() {
    if (disabled) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Caméra indisponible sur cet appareil.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play().catch(() => setError('Impossible de démarrer la prévisualisation.'));
      });
    } catch {
      setError('Autorisez l’accès à la caméra pour prendre la photo.');
    }
  }

  function closeCamera() {
    stopStream();
    setOpen(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Capture impossible, réessayez.');
          return;
        }
        onPhoto(new File([blob], `check-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        closeCamera();
      },
      'image/jpeg',
      0.88,
    );
  }

  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
        <div className="flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
          <div className="min-w-0">
            <span className="block text-sm font-semibold">Prendre une photo</span>
            {cameraHint ? (
              <span className="mt-0.5 block truncate text-xs text-white/70">{cameraHint}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={closeCamera}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 touch-manipulation"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {guideKind ? <CheckFlowCameraOverlay kind={guideKind} /> : null}
          <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-dashed border-white/60 cf-guide-pulse" />
        </div>
        <div className="flex gap-3 border-t border-white/10 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={closeCamera} className={`flex-1 ${CF.btnSecondary}`}>
            Annuler
          </button>
          <button type="button" onClick={capture} className={`flex-1 ${CF.btnPrimary}`}>
            Capturer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void openCamera()}
        className={[
          'flex w-full min-h-[3.75rem] items-center justify-center gap-2.5 rounded-full bg-zinc-900 py-4 text-sm font-semibold text-white shadow-lg shadow-zinc-900/15 touch-manipulation transition-transform active:scale-[0.98]',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
      >
        <Camera className="h-5 w-5" aria-hidden />
        Prendre une photo
      </button>
      <p className="text-center text-[11px] text-zinc-400">Prise de vue directe uniquement</p>
      {error ? <p className={CF.error}>{error}</p> : null}
    </div>
  );
}
