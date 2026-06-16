import { useEffect, useState } from 'react';
import { ExternalLink, MapPin, Megaphone, Pencil, Trash2 } from 'lucide-react';
import {
  announcementCoverSrc,
  announcementTargetSummary,
  linkModeLabel,
} from '@/lib/announcementUi';
import type { Announcement } from '@/stores/announcements';
import type { Boat, Fleet } from '@/stores/boats';

export function AnnouncementDetailPanel(
  props: Readonly<{
    announcement: Announcement;
    fleets: Fleet[];
    boats: Boat[];
    publicUrl: string;
    onEdit: () => void;
    onDelete: () => void;
  }>,
) {
  const { announcement: a, fleets, boats, publicUrl, onEdit, onDelete } = props;
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    setPhotoIdx(0);
  }, [a.id]);

  const sum = announcementTargetSummary(a, fleets, boats);
  const photos = a.presentationPhotos ?? [];
  const fallbackThumb = announcementCoverSrc(a, boats);
  const gallery = photos.length > 0 ? photos : fallbackThumb ? [fallbackThumb] : [];
  const activePhoto = gallery[photoIdx] ?? gallery[0] ?? null;

  const date = new Date(a.createdAt);
  const dateStr = Number.isFinite(date.getTime())
    ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="flex max-h-[min(42rem,72vh)] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
      <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4 sm:p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/12 text-[#416B9F]">
          <Megaphone className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-zinc-900">{a.title}</h3>
          <p className="mt-0.5 text-sm text-[#416B9F]">{sum.line}</p>
          {sum.sub ? <p className="mt-1 text-xs text-zinc-500">{sum.sub}</p> : null}
          <p className="mt-2 text-[11px] text-zinc-400">Publiée le {dateStr}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Site public
          </a>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {gallery.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Photos</p>
            <div className="relative mt-2 overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50">
              <img src={activePhoto ?? ''} alt="" className="aspect-[16/10] w-full object-cover" />
              {photoIdx === 0 && photos.length > 0 ? (
                <span className="absolute left-2 top-2 rounded-md bg-[#416B9F] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  Principale
                </span>
              ) : null}
            </div>
            {gallery.length > 1 ? (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {gallery.map((src, idx) => (
                  <button
                    key={`${src.slice(0, 24)}-${idx}`}
                    type="button"
                    onClick={() => setPhotoIdx(idx)}
                    className={[
                      'overflow-hidden rounded-lg border-2',
                      idx === photoIdx ? 'border-[#416B9F] ring-1 ring-[#416B9F]/25' : 'border-zinc-200/90',
                    ].join(' ')}
                  >
                    <img src={src} alt="" className="h-12 w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
            Aucune photo — une vignette du bateau lié peut s&apos;afficher sur le site si applicable.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase text-zinc-400">Base nautique</p>
            <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-zinc-900">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
              {a.navalBase}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase text-zinc-400">Type de lien</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{linkModeLabel(a.link.kind)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
