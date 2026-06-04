import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Portal } from '@/components/Portal';
import { ContractSignaturePad } from '@/components/ContractSignaturePad';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';

export function OperatorContractSignatureDialog(props: Readonly<{
  reservationId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { reservationId, open, onClose, onSaved } = props;
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function save() {
    if (!signature) {
      setError('Veuillez signer dans le cadre ci-dessus.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/reservations/${reservationId}/rental-contract/operator-signature`, {
        operatorSignature: signature,
      });
      onSaved();
      onClose();
      setSignature(null);
    } catch (e: unknown) {
      setError(extractApiErrorMessage(e, 'Enregistrement impossible.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
        <div
          className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
          role="dialog"
          aria-labelledby="operator-sig-title"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="operator-sig-title" className="text-base font-semibold text-zinc-900">
                Signature exploitant
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Obligatoire avant la signature client. Vous pouvez aussi définir une signature par défaut dans
                Paramètres → Contrats.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-4">
            <ContractSignaturePad label="Signature de l'exploitant" value={signature} onChange={setSignature} />
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void save()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
