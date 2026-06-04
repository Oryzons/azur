import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Portal } from '@/components/Portal';

export function ConfirmDialog(props: Readonly<{
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}>) {
  const {
    open,
    title,
    description,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    onConfirm,
    onCancel,
    loading = false,
  } = props;

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
          aria-labelledby="confirm-dialog-title"
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
        >
          <div className="flex gap-3 border-b border-zinc-100 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id="confirm-dialog-title" className="text-base font-bold text-zinc-900">
                {title}
              </h2>
            </div>
          </div>
          <div className="px-5 py-4 text-sm leading-relaxed text-zinc-600">{description}</div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-5 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Suppression…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
