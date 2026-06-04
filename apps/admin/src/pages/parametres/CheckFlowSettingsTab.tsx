import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CheckFlowFormEditor } from '@/pages/check-flow/CheckFlowFormEditor';

export function CheckFlowSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
              <ClipboardCheck className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Check-in / Check-out</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Même éditeur que la page dédiée du menu. Idéal pour configurer depuis les paramètres globaux.
              </p>
            </div>
          </div>
          <Link
            to="/check-flow/formulaires"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#416B9F]/30 bg-white px-3 py-2 text-xs font-semibold text-[#416B9F] shadow-sm hover:bg-[#416B9F]/5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Page Check-in/out
          </Link>
        </div>
      </div>
      <CheckFlowFormEditor showPreviewLink={false} />
    </div>
  );
}
