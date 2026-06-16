import { Globe } from 'lucide-react';
import { useSettingsStore, type SeoSettings } from '@/stores/settings';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

export function SeoSettingsTab() {
  const seo = useSettingsStore((s) => s.seo);
  const setSettings = useSettingsStore((s) => s.setSettings);

  function patch(p: Partial<SeoSettings>) {
    setSettings({ seo: p });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <Globe className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Référencement (SEO)</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Métadonnées par défaut du site public (titre, description, image de partage).
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <label className="block">
          <FieldLabel>Titre meta (balise title)</FieldLabel>
          <input value={seo.metaTitle} onChange={(e) => patch({ metaTitle: e.target.value })} className={inputCls()} />
        </label>
        <label className="block">
          <FieldLabel>Description meta</FieldLabel>
          <textarea
            value={seo.metaDescription}
            onChange={(e) => patch({ metaDescription: e.target.value })}
            rows={3}
            className={inputCls()}
          />
        </label>
        <label className="block">
          <FieldLabel>Image Open Graph (URL HTTPS)</FieldLabel>
          <input
            value={seo.ogImageUrl}
            onChange={(e) => patch({ ogImageUrl: e.target.value })}
            className={inputCls()}
            placeholder="https://…"
          />
        </label>
      </div>
    </div>
  );
}
