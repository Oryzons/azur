import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export function ContractDownloadPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Lien de téléchargement invalide.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get(`/public/rental-contracts/${encodeURIComponent(token)}/download`, {
          responseType: 'blob',
        });
        if (cancelled) return;
        const disposition = res.headers['content-disposition'];
        const match = typeof disposition === 'string' ? /filename="([^"]+)"/.exec(disposition) : null;
        const filename = match?.[1] ?? 'contrat-location.pdf';
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Contrat introuvable ou lien expiré.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 text-zinc-600">
            <Loader2 className="h-8 w-8 animate-spin text-[#416B9F]" aria-hidden />
            <p className="text-sm">Téléchargement du contrat…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <FileDown className="h-10 w-10 text-emerald-600" aria-hidden />
            <p className="text-sm font-medium text-zinc-800">Téléchargement lancé</p>
            <p className="text-xs text-zinc-500">Si le fichier ne s&apos;ouvre pas, vérifiez vos téléchargements.</p>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-zinc-400">Bleu Calanque</p>
      </div>
    </div>
  );
}
