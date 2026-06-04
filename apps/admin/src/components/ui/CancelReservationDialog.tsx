import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Portal } from '@/components/Portal';
import { RoundCheckbox } from '@/components/RoundCheckbox';

export function CancelReservationDialog(props: Readonly<{
  open: boolean;
  clientLabel: string;
  boatLabel: string;
  onConfirm: (payload: { reason: string; notifyClient: boolean }) => void;
  onCancel: () => void;
  loading?: boolean;
}>) {
  const { open, clientLabel, boatLabel, onConfirm, onCancel, loading = false } = props;
  const [reason, setReason] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);

  useEffect(() => {
    if (open) {
      setReason('');
      setNotifyClient(true);
    }
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
          aria-label="Fermer"
          onClick={onCancel}
          disabled={loading}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-reservation-title"
          className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
        >
          <div className="flex shrink-0 gap-3 border-b border-zinc-100 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id="cancel-reservation-title" className="text-base font-bold text-zinc-900">
                Annuler la réservation
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {clientLabel} · {boatLabel}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-sm leading-relaxed text-zinc-600">
              La réservation sera marquée comme annulée dans le planning et en base de données.
            </p>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Motif (facultatif, inclus dans l&apos;e-mail)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Ex. intempéries, indisponibilité du bateau, demande du client…"
                className="mt-1.5 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
                disabled={loading}
              />
            </label>
            <RoundCheckbox
              checked={notifyClient}
              onChange={setNotifyClient}
              label="Envoyer un e-mail d'annulation au client"
              disabled={loading}
            />
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-5 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              Retour
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onConfirm({ reason: reason.trim(), notifyClient })}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Annulation…' : 'Confirmer l’annulation'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
