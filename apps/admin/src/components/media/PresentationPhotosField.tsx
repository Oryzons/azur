import { Star, Trash2 } from 'lucide-react';
import { MAX_PRESENTATION_PHOTOS, movePhotoToCover, readImageFilesAsDataUrls } from '@/lib/mediaPhotos';

export function PresentationPhotosField(props: Readonly<{
  label?: string;
  photos: string[];
  setPhotos: (next: string[] | ((prev: string[]) => string[])) => void;
  photoError: string;
  setPhotoError: (v: string) => void;
}>) {
  const { label = 'Photos de présentation', photos, setPhotos, photoError, setPhotoError } = props;

  async function addPhotos(files: FileList | null) {
    setPhotoError('');
    if (!files?.length) return;
    const remaining = MAX_PRESENTATION_PHOTOS - photos.length;
    if (remaining <= 0) {
      setPhotoError(`Maximum ${MAX_PRESENTATION_PHOTOS} photos.`);
      return;
    }
    const slice = Array.from(files).slice(0, remaining);
    const dt = new DataTransfer();
    for (const f of slice) dt.items.add(f);
    const { urls, error } = await readImageFilesAsDataUrls(dt.files);
    if (error) {
      setPhotoError(error);
      return;
    }
    if (urls.length) setPhotos((prev) => [...prev, ...urls].slice(0, MAX_PRESENTATION_PHOTOS));
  }

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <span className="text-xs font-semibold text-zinc-400">
          {photos.length}/{MAX_PRESENTATION_PHOTOS}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        La photo marquée « Principale » s’affiche en premier (calendrier, listes). Les fichiers de plus de 1,5 Mo sont
        automatiquement réduits.
      </p>

      <div className="mt-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => void addPhotos(e.target.files)}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-2xl file:border file:border-zinc-200/90 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-50"
        />
        {photoError ? <p className="mt-2 text-sm font-medium text-red-600">{photoError}</p> : null}
      </div>

      {photos.length ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {photos.map((src, idx) => {
            const isPrimary = idx === 0;
            return (
              <div
                key={`${src.slice(0, 48)}-${idx}`}
                className={[
                  'group relative overflow-hidden rounded-2xl border bg-zinc-50',
                  isPrimary ? 'border-[#416B9F]/50 ring-2 ring-[#416B9F]/25' : 'border-zinc-200/90',
                ].join(' ')}
              >
                <img src={src} alt="" className="h-24 w-full object-cover" />
                {isPrimary ? (
                  <span className="absolute left-2 top-2 rounded-md bg-[#416B9F] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Principale
                  </span>
                ) : null}
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {!isPrimary ? (
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => movePhotoToCover(prev, idx))}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 text-zinc-600 shadow-sm hover:bg-[#416B9F]/10 hover:text-[#416B9F]"
                      aria-label="Définir comme photo principale"
                      title="Photo principale"
                    >
                      <Star className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 text-zinc-600 shadow-sm hover:bg-red-50 hover:text-red-700"
                    aria-label="Supprimer la photo"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Ajoute des photos (enregistrées en base à la validation).</p>
      )}
    </div>
  );
}
