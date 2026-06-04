import { FileText } from 'lucide-react';

export function isPdfDataUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('data:application/pdf');
}

export const CONTRACT_DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf';

type Props = Readonly<{
  url: string;
  label: string;
}>;

export function DocumentFilePreview(props: Props) {
  const { url, label } = props;
  if (!url.trim()) return null;

  if (isPdfDataUrl(url)) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200/80 bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <FileText className="h-4 w-4 text-[#416B9F]" aria-hidden />
          PDF — {label}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-[#416B9F] underline"
        >
          Ouvrir le PDF
        </a>
        <object
          data={url}
          type="application/pdf"
          title={label}
          className="mt-2 h-36 w-full rounded-lg border border-zinc-200/90"
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={label}
      className="mt-2 max-h-36 w-full rounded-xl border border-emerald-200/80 object-contain"
    />
  );
}
