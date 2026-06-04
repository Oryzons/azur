import {
  CONTRACT_DOCUMENT_ACCEPT,
  DocumentFilePreview,
} from '@/components/contract/DocumentFilePreview';
import { fileToDataUrl } from '@/lib/memberUi';

type Props = Readonly<{
  label: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
}>;

export function ContractDocumentPhotoSlot(props: Props) {
  const { label, value, onChange, required } = props;
  const done = Boolean(value?.trim());

  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        type="file"
        accept={CONTRACT_DOCUMENT_ACCEPT}
        capture="environment"
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-[#416B9F]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#416B9F]"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void fileToDataUrl(f).then(onChange);
        }}
      />
      {done ? <DocumentFilePreview url={value} label={label} /> : null}
      {!done ? (
        <p className="mt-1 text-[11px] text-zinc-500">Photo (JPEG, PNG, WebP) ou PDF — fichier lisible</p>
      ) : null}
    </label>
  );
}
