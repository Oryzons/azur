import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  CONTRACT_DOCUMENT_ACCEPT,
  DocumentFilePreview,
} from '@/components/contract/DocumentFilePreview';
import {
  downloadBoatLegalDocument,
  downloadFileFromUrl,
  isPersistedBoatId,
  type BoatLegalDocKey,
} from '@/lib/downloadFile';
import { documentUploadErrorMessage, fileToUploadDataUrl } from '@/lib/documentUpload';

type Props = Readonly<{
  label: string;
  fileUrl: string;
  downloadBasename: string;
  boatId?: string | null;
  docKey?: BoatLegalDocKey;
  onChange: (url: string) => void;
  inputClassName: string;
}>;

export function BoatLegalDocumentFile(props: Props) {
  const { label, fileUrl, downloadBasename, boatId, docKey, onChange, inputClassName } = props;
  const [downloading, setDownloading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const hasFile = Boolean(fileUrl.trim());
  const canProxyDownload = Boolean(boatId && docKey && isPersistedBoatId(boatId));

  return (
    <div className="sm:col-span-2">
      <span className="text-xs font-semibold text-zinc-700">Fichier joint</span>
      <input
        type="file"
        accept={CONTRACT_DOCUMENT_ACCEPT}
        className={inputClassName}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setUploadError('');
          void fileToUploadDataUrl(f)
            .then(onChange)
            .catch((err) => setUploadError(documentUploadErrorMessage(err)));
          e.target.value = '';
        }}
      />
      {uploadError ? <p className="mt-1 text-xs font-medium text-red-600">{uploadError}</p> : null}
      {!hasFile ? (
        <p className="mt-1 text-[11px] text-zinc-500">
          PDF ou image (JPEG, PNG, WebP) — max. 20 Mo, images compressées automatiquement
        </p>
      ) : (
        <>
          <DocumentFilePreview url={fileUrl} label={label} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloading}
              onClick={() => {
                setDownloading(true);
                const task =
                  canProxyDownload && boatId && docKey
                    ? downloadBoatLegalDocument(boatId, docKey, downloadBasename)
                    : downloadFileFromUrl(fileUrl, downloadBasename);
                void task
                  .catch(() => {
                    window.alert('Impossible de télécharger le fichier.');
                  })
                  .finally(() => setDownloading(false));
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-[#416B9F] shadow-sm hover:bg-zinc-50 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {downloading ? 'Téléchargement…' : 'Télécharger'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
