import { useRef, useState } from 'react';
import { FileUp, Upload, X } from 'lucide-react';
import { Portal } from '@/components/Portal';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';
import type { NauticManagerMappedClient } from '@bleu-calanque/shared';
import { decodeCsvBytes } from '@/lib/nauticCsvDecode';

type ImportSummary = {
  total: number;
  ready: number;
  existing: number;
  invalid: number;
  duplicateInFile: number;
  created: number;
  failed: number;
};

type ImportResponse = {
  parseError?: string | null;
  summary: ImportSummary | null;
  rows: NauticManagerMappedClient[];
  errors?: string[];
};

const STATUS_LABEL: Record<NauticManagerMappedClient['status'], string> = {
  ready: 'À créer',
  existing: 'Déjà existant',
  invalid: 'Ignoré',
  duplicate_in_file: 'Doublon fichier',
};

const STATUS_CLASS: Record<NauticManagerMappedClient['status'], string> = {
  ready: 'bg-emerald-500/15 text-emerald-300',
  existing: 'bg-zinc-500/20 text-zinc-400',
  invalid: 'bg-red-500/15 text-red-300',
  duplicate_in_file: 'bg-amber-500/15 text-amber-200',
};

const CIVILITY_LABEL: Record<NonNullable<NauticManagerMappedClient['civility']>, string> = {
  M: 'M.',
  MME: 'Mme',
  MX: 'Mx',
  NONE: '—',
};

const CLIENT_TYPE_LABEL: Record<NonNullable<NauticManagerMappedClient['clientType']>, string> = {
  PARTICULIER: 'Particulier',
  PROFESSIONNEL: 'Pro',
  ASSOCIATION: 'Association',
};

function cell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

function formatBirthDate(iso: string | null) {
  if (!iso) return '—';
  const fr = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (fr) return `${fr[3]}/${fr[2]}/${fr[1]}`;
  return iso;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function MembersNauticImportModal({ open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function loadFile(file: File) {
    setError('');
    setDone(false);
    setPreview(null);
    const buf = await file.arrayBuffer();
    const text = decodeCsvBytes(new Uint8Array(buf));
    setCsv(text);
    setFileName(file.name);
    setLoading(true);
    try {
      const { data } = await api.post<ImportResponse>('/members/import/nautic-manager', {
        csv: text,
        dryRun: true,
      });
      if (data.parseError) {
        setError(data.parseError);
        setPreview(null);
      } else {
        setPreview(data);
      }
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Impossible d’analyser le fichier.'));
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    if (!csv.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<ImportResponse>('/members/import/nautic-manager', {
        csv,
        dryRun: false,
      });
      if (data.parseError) {
        setError(data.parseError);
        return;
      }
      setPreview(data);
      setDone(true);
      onImported();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Import impossible.'));
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setCsv('');
    setFileName('');
    setPreview(null);
    setError('');
    setDone(false);
    onClose();
  }

  const summary = preview?.summary;

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nautic-import-title"
          className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#0f172a] shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 id="nautic-import-title" className="text-lg font-bold text-white">
                Importer depuis Nautic Manager
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Export CSV clients (.csv). L’ID Nautic Manager est ignoré ; les doublons (email déjà sur le site) ne
                sont pas recréés.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!done ? (
              <>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center hover:bg-white/[0.07]">
                  <FileUp className="h-8 w-8 text-[#7eb3e8]" aria-hidden />
                  <span className="text-sm font-semibold text-white">
                    {fileName ? fileName : 'Choisir un fichier CSV'}
                  </span>
                  <span className="text-xs text-slate-500">Séparateur virgule ou point-virgule</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void loadFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>

                {loading ? <p className="text-sm text-slate-400">Analyse en cours…</p> : null}
                {error ? <p className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-200">{error}</p> : null}

                {summary ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Lignes" value={summary.total} />
                    <Stat label="À créer" value={summary.ready} accent="text-emerald-300" />
                    <Stat label="Déjà existants" value={summary.existing} />
                    <Stat label="Ignorés" value={summary.invalid + summary.duplicateInFile} />
                  </div>
                ) : null}

                {preview?.rows && preview.rows.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="min-w-[1100px] text-left text-xs">
                      <thead className="bg-white/5 text-slate-400">
                        <tr>
                          <th className="whitespace-nowrap px-2 py-2">Ligne</th>
                          <th className="whitespace-nowrap px-2 py-2">Statut</th>
                          <th className="whitespace-nowrap px-2 py-2">Civilité</th>
                          <th className="whitespace-nowrap px-2 py-2">Prénom</th>
                          <th className="whitespace-nowrap px-2 py-2">Nom</th>
                          <th className="whitespace-nowrap px-2 py-2">Email</th>
                          <th className="whitespace-nowrap px-2 py-2">Téléphone</th>
                          <th className="whitespace-nowrap px-2 py-2">Type</th>
                          <th className="whitespace-nowrap px-2 py-2">Naissance</th>
                          <th className="whitespace-nowrap px-2 py-2">Nationalité</th>
                          <th className="whitespace-nowrap min-w-[140px] px-2 py-2">Adresse</th>
                          <th className="whitespace-nowrap px-2 py-2">Ville</th>
                          <th className="whitespace-nowrap px-2 py-2">CP</th>
                          <th className="whitespace-nowrap px-2 py-2">Pays</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {preview.rows.slice(0, 80).map((r) => (
                          <tr key={`${r.line}-${r.email ?? 'x'}`}>
                            <td className="whitespace-nowrap px-2 py-2">{r.line}</td>
                            <td className="px-2 py-2">
                              <span
                                className={`inline-block whitespace-nowrap rounded-lg px-2 py-0.5 font-semibold ${STATUS_CLASS[r.status]}`}
                              >
                                {STATUS_LABEL[r.status]}
                              </span>
                              {r.statusReason ? (
                                <p className="mt-1 max-w-[120px] text-[10px] leading-tight text-slate-500">
                                  {r.statusReason}
                                </p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">
                              {r.civility ? CIVILITY_LABEL[r.civility] : '—'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.firstName)}</td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.lastName)}</td>
                            <td className="max-w-[180px] truncate px-2 py-2" title={r.email ?? undefined}>
                              {cell(r.email)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.phone)}</td>
                            <td className="whitespace-nowrap px-2 py-2">
                              {r.clientType ? CLIENT_TYPE_LABEL[r.clientType] : '—'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">{formatBirthDate(r.birthDate)}</td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.nationality)}</td>
                            <td className="max-w-[160px] truncate px-2 py-2" title={r.address ?? undefined}>
                              {cell(r.address)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.city)}</td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.postalCode)}</td>
                            <td className="whitespace-nowrap px-2 py-2">{cell(r.country)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.rows.length > 80 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        Aperçu limité aux 80 premières lignes ({preview.rows.length} au total).
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-100">
                <p className="font-semibold text-emerald-50">Import terminé</p>
                {summary ? (
                  <ul className="mt-2 space-y-1">
                    <li>{summary.created} client(s) créé(s)</li>
                    <li>{summary.existing} déjà existant(s) (ignorés)</li>
                    <li>{summary.invalid + summary.duplicateInFile} ligne(s) ignorée(s)</li>
                    {summary.failed > 0 ? <li className="text-red-200">{summary.failed} échec(s)</li> : null}
                  </ul>
                ) : null}
                {preview?.errors && preview.errors.length > 0 ? (
                  <ul className="mt-3 max-h-32 overflow-y-auto text-xs text-red-200">
                    {preview.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-4">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-300"
            >
              {done ? 'Fermer' : 'Annuler'}
            </button>
            {!done && summary && summary.ready > 0 ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void runImport()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Importer {summary.ready} client{summary.ready > 1 ? 's' : ''}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Stat(props: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className={`text-lg font-bold ${props.accent ?? 'text-white'}`}>{props.value}</p>
    </div>
  );
}
