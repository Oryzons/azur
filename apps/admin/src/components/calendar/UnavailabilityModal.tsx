import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Portal } from '@/components/Portal';
import type { BoatUnavailability, UnavailabilityInput } from '@/stores/unavailabilities';
import { dayToIso, pad2, startOfDay } from '@/pages/calendar/calendarConstants';
import { extractApiErrorMessage } from '@/lib/apiError';

type Props = {
  open: boolean;
  boats: { id: string; name: string }[];
  initial?: BoatUnavailability | null;
  initialBoatId?: string;
  initialDay?: Date;
  initialTimes?: Readonly<{ startTime: string; endTime: string }>;
  onClose: () => void;
  onSave: (input: UnavailabilityInput, existingId?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

function toLocalDateTimeIso(dateIso: string, time: string): string | null {
  const d = new Date(`${dateIso}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDayHint(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function UnavailabilityModal(props: Readonly<Props>) {
  const { open, boats, initial, initialBoatId, initialDay, initialTimes, onClose, onSave, onDelete } = props;
  const [boatId, setBoatId] = useState('');
  const [title, setTitle] = useState('Indisponible');
  const [reason, setReason] = useState<BoatUnavailability['reason']>('OTHER');
  const [note, setNote] = useState('');
  const [startDateIso, setStartDateIso] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDateIso, setEndDateIso] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const contextHint = useMemo(() => {
    if (initial) return null;
    if (!initialDay) return 'Choisissez le bateau et la plage horaire à bloquer.';
    return `Créneau à partir du ${formatDayHint(startOfDay(initialDay))}.`;
  }, [initial, initialDay]);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initial) {
      const start = new Date(initial.startAt);
      const end = new Date(initial.endAt);
      setBoatId(initial.boatId);
      setTitle(initial.title);
      setReason(initial.reason ?? 'OTHER');
      setNote(initial.note ?? '');
      setStartDateIso(dayToIso(start));
      setStartTime(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`);
      setEndDateIso(dayToIso(end));
      setEndTime(`${pad2(end.getHours())}:${pad2(end.getMinutes())}`);
    } else {
      const day = initialDay ? startOfDay(initialDay) : startOfDay(new Date());
      const dayIso = dayToIso(day);
      setBoatId(initialBoatId ?? boats[0]?.id ?? '');
      setTitle('Indisponible');
      setReason('OTHER');
      setNote('');
      setStartDateIso(dayIso);
      setEndDateIso(dayIso);
      setStartTime(initialTimes?.startTime ?? '09:00');
      setEndTime(initialTimes?.endTime ?? '18:00');
    }
  }, [open, initial, initialBoatId, initialDay, initialTimes, boats]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setError('');
    if (!boatId || !title.trim()) {
      setError('Bateau et titre requis.');
      return;
    }
    if (!startDateIso || !endDateIso) {
      setError('Dates de début et de fin requises.');
      return;
    }
    const startAtIso = toLocalDateTimeIso(startDateIso, startTime);
    const endAtIso = toLocalDateTimeIso(endDateIso, endTime);
    if (!startAtIso || !endAtIso) {
      setError('Date ou heure invalide.');
      return;
    }
    const startAt = new Date(startAtIso);
    const endAt = new Date(endAtIso);
    if (endAt.getTime() <= startAt.getTime()) {
      setError('La date et l\'heure de fin doivent être après le début.');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          boatId,
          title: title.trim(),
          reason,
          note: note.trim() || null,
          startAt: startAtIso,
          endAt: endAtIso,
        },
        initial?.id,
      );
      onClose();
    } catch (e: unknown) {
      setError(extractApiErrorMessage(e, 'Enregistrement impossible.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[70]" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/30"
          aria-label="Fermer le panneau"
          onClick={onClose}
        />
        <aside
          className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-200/90 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unavailability-panel-title"
        >
        <header className="shrink-0 border-b border-zinc-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="unavailability-panel-title" className="text-lg font-bold tracking-tight text-zinc-900">
                {initial ? 'Modifier l\'indisponibilité' : 'Nouvelle indisponibilité'}
              </h2>
              {contextHint ? <p className="mt-1 text-sm text-zinc-500">{contextHint}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-zinc-500 transition-colors hover:bg-zinc-100"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Bateau</span>
              <select
                value={boatId}
                onChange={(e) => setBoatId(e.target.value)}
                disabled={boats.length === 0}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15 disabled:opacity-60"
              >
                {boats.length === 0 ? (
                  <option value="">Aucun bateau assigné</option>
                ) : (
                  boats.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Titre</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Raison</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as BoatUnavailability['reason'])}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              >
                <option value="REPAIR">Réparation</option>
                <option value="PRIVATE_USE">Usage privé</option>
                <option value="WEATHER">Météo</option>
                <option value="OTHER">Autre</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-zinc-700">Note (optionnel)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </label>

            <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/90 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#416B9F]">Début</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="font-medium text-zinc-600">Date</span>
                  <input
                    type="date"
                    value={startDateIso}
                    onChange={(e) => setStartDateIso(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-600">Heure</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px]"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/90 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#416B9F]">Fin</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="font-medium text-zinc-600">Date</span>
                  <input
                    type="date"
                    value={endDateIso}
                    onChange={(e) => setEndDateIso(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-zinc-600">Heure</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[15px]"
                  />
                </label>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {initial && onDelete ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void onDelete(initial.id).then(onClose)}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Supprimer
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/25 hover:opacity-95 disabled:opacity-60"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </footer>
        </aside>
      </div>
    </Portal>
  );
}
