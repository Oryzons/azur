import { Link, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export function PaymentCancelPage() {
  const [params] = useSearchParams();
  const reservationId = params.get('reservation_id');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e3a5f] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur text-center">
        <XCircle className="mx-auto h-14 w-14 text-amber-400" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Paiement annulé</h1>
        <p className="mt-3 text-slate-300">
          Votre réservation reste enregistrée. Vous pouvez finaliser le paiement plus tard via le lien reçu par email.
        </p>
        {reservationId ? (
          <p className="mt-4 text-xs text-slate-500">Référence : {reservationId}</p>
        ) : null}
        <p className="mt-8">
          <Link to="/login" className="text-sm font-semibold text-[#7eb3e8] hover:underline">
            Retour à l’espace Bleu Calanque
          </Link>
        </p>
      </div>
    </div>
  );
}
