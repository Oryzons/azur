import { useEffect, useState } from 'react';
import { Anchor, Pencil, Trash2, Users } from 'lucide-react';
import { coverPhotoUrl } from '@/lib/mediaPhotos';
import { formatDepositEuros } from '@/lib/boatUi';
import type { Boat } from '@/stores/boats';

function DetailLine(props: Readonly<{ label: string; value: React.ReactNode }>) {
  const v = props.value;
  if (v === null || v === undefined || v === '' || v === '—') return null;
  return (
    <p className="text-sm text-zinc-900">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{props.label}</span>
      <span className="mt-0.5 block font-medium">{v}</span>
    </p>
  );
}

export function BoatDetailPanel(
  props: Readonly<{
    boat: Boat;
    fleetLabel: string;
    ownerLabel: string;
    typeLabel: string;
    extraRows: { label: string; value: string }[];
    onEdit: () => void;
    onDelete: () => void;
  }>,
) {
  const { boat, fleetLabel, ownerLabel, typeLabel, extraRows, onEdit, onDelete } = props;
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    setPhotoIdx(0);
  }, [boat.id]);

  const photos = boat.presentationPhotos ?? [];
  const activePhoto = photos[photoIdx] ?? photos[0] ?? null;

  return (
    <div className="flex max-h-[min(42rem,72vh)] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
      <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4 sm:p-5">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200/90 shadow-sm">
          {coverPhotoUrl(photos) ? (
            <img src={coverPhotoUrl(photos)!} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-zinc-100" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-zinc-900">{boat.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-[#416B9F]">
            {boat.brand} · {boat.model}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {typeLabel} · {boat.maxPassengers} passagers max · Caution {formatDepositEuros(boat.depositEuros)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailLine label="Flotille" value={fleetLabel} />
          <DetailLine label="Propriétaire" value={ownerLabel} />
          <DetailLine label="Type" value={typeLabel} />
          <DetailLine label="Passagers max" value={String(boat.maxPassengers)} />
        </div>

        {extraRows.length > 0 ? (
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Fiche technique
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {extraRows.map((row) => (
                <DetailLine key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Aucune information complémentaire — utilisez <span className="font-semibold">Modifier</span> puis
            « Voir plus » pour les dimensions, équipements et documents de légalité.
          </p>
        )}

        {photos.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Photos</p>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <div className="relative max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-zinc-200/90 bg-zinc-50">
                <img
                  src={activePhoto ?? ''}
                  alt=""
                  className="aspect-[4/3] h-28 w-full object-cover sm:h-32"
                />
                {photoIdx === 0 ? (
                  <span className="absolute left-1.5 top-1.5 rounded bg-[#416B9F] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Principale
                  </span>
                ) : null}
              </div>
              {photos.length > 1 ? (
                <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5 sm:max-w-[280px]">
                  {photos.map((src, idx) => (
                    <button
                      key={`${src.slice(0, 24)}-${idx}`}
                      type="button"
                      onClick={() => setPhotoIdx(idx)}
                      className={[
                        'overflow-hidden rounded-md border-2',
                        idx === photoIdx ? 'border-[#416B9F] ring-1 ring-[#416B9F]/25' : 'border-zinc-200/90',
                      ].join(' ')}
                    >
                      <img src={src} alt="" className="h-9 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Anchor className="h-3.5 w-3.5" aria-hidden />
            Catalogue calendrier & réservations
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {ownerLabel === '—' ? 'Sans propriétaire lié' : ownerLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
