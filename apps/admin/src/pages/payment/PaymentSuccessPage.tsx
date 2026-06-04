import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { postAdminBroadcast } from '@/lib/adminBroadcast';
import { api } from '@/lib/api';
import { useReservationsStore } from '@/stores/reservations';

type SuccessPayload = {
  paid: boolean;
  reservation: {
    id: string;
    boatName: string;
    startAt: string;
    endAt: string;
    clientFirstName: string | null;
    clientLastName: string | null;
    status: string;
  };
  contract?: {
    number: number;
    signed: boolean;
    signUrl: string;
  };
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [data, setData] = useState<SuccessPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('Lien de confirmation invalide.');
      return;
    }
    void api
      .get<SuccessPayload>(`/public/payments/success?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        setData(res.data);
        if (res.data.paid) {
          postAdminBroadcast({ type: 'payment-captured', reservationId: res.data.reservation.id });
          void useReservationsStore.getState().refresh();
        }
      })
      .catch(() => setError('Impossible de charger les informations de paiement.'));
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e3a5f] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-red-200">Paiement</h1>
            <p className="mt-3 text-slate-300">{error}</p>
          </>
        ) : !data ? (
          <div className="flex flex-col items-center gap-3 py-8 text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-[#7eb3e8]" aria-hidden />
            <p>Vérification du paiement…</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" aria-hidden />
            </div>
            <h1 className="mt-4 text-center text-2xl font-bold">
              {data.paid ? 'Paiement confirmé' : 'Paiement en cours'}
            </h1>
            <p className="mt-2 text-center text-slate-300">
              Merci
              {data.reservation.clientFirstName ? ` ${data.reservation.clientFirstName}` : ''}, votre réservation est
              bien enregistrée.
            </p>
            <div className="mt-8 space-y-3 rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm">
              <p>
                <span className="text-slate-400">Bateau · </span>
                <span className="font-semibold">{data.reservation.boatName}</span>
              </p>
              <p>
                <span className="text-slate-400">Départ · </span>
                <span className="font-semibold">{formatWhen(data.reservation.startAt)}</span>
              </p>
              <p>
                <span className="text-slate-400">Retour · </span>
                <span className="font-semibold">{formatWhen(data.reservation.endAt)}</span>
              </p>
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">
              Une empreinte bancaire pour la caution a été enregistrée le cas échéant ; elle ne constitue pas un débit
              immédiat. Vous recevrez un récapitulatif par email.
            </p>
            {data.paid && data.contract && !data.contract.signed ? (
              <a
                href={data.contract.signUrl}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                <FileText className="h-4 w-4" aria-hidden />
                Signer le contrat n°{data.contract.number}
              </a>
            ) : !data.paid ? (
              <p className="mt-4 text-center text-sm text-amber-200">
                Paiement en cours de confirmation — le lien de signature du contrat sera disponible une fois le
                règlement validé.
              </p>
            ) : data.contract?.signed ? (
              <p className="mt-4 text-center text-sm text-emerald-300">Contrat n°{data.contract.number} déjà signé.</p>
            ) : null}
          </>
        )}
        <p className="mt-8 text-center">
          <Link to="/login" className="text-sm font-semibold text-[#7eb3e8] hover:underline">
            Retour à l’espace Bleu Calanque
          </Link>
        </p>
      </div>
    </div>
  );
}
