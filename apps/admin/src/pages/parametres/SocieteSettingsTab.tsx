import { useMemo, useState } from 'react';
import {
  Anchor,
  Building2,
  Globe,
  Landmark,
  Mail,
  MapPin,
  Percent,
  Phone,
  Store,
} from 'lucide-react';
import { DEFAULT_RENTAL_ARRIVAL_LOCATION, DEFAULT_RENTAL_DEPARTURE_LOCATION } from '@bleu-calanque/shared';
import { useSettingsStore, type CompanySettings } from '@/stores/settings';

type SectionId = 'identity' | 'address' | 'locations' | 'contact' | 'legal' | 'vat';

const SECTIONS: { id: SectionId; label: string; Icon: typeof Building2 }[] = [
  { id: 'identity', label: 'Identité', Icon: Building2 },
  { id: 'address', label: 'Adresse', Icon: MapPin },
  { id: 'locations', label: 'Départ & arrivée', Icon: Anchor },
  { id: 'contact', label: 'Contact & web', Icon: Mail },
  { id: 'legal', label: 'Mentions légales', Icon: Landmark },
  { id: 'vat', label: 'TVA', Icon: Percent },
];

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

function parsePercent(raw: string): number {
  const v = Number(raw.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

export function SocieteSettingsTab() {
  const company = useSettingsStore((s) => s.company);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [section, setSection] = useState<SectionId>('identity');

  function patch(p: Partial<CompanySettings>) {
    setSettings({ company: p });
  }

  function patchRentalLocations(departureLocation: string, arrivalLocation: string) {
    const dep = departureLocation.trim();
    const arr = arrivalLocation.trim();
    setSettings({
      company: { departureLocation: dep, arrivalLocation: arr },
      booking: {
        departureLocation: dep,
        arrivalLocation: arr,
        defaultNavalBase: dep || DEFAULT_RENTAL_DEPARTURE_LOCATION,
      },
      publicSite: { departureLocation: dep, arrivalLocation: arr },
    });
  }

  const addressLine = useMemo(() => {
    const parts = [company.addressLine, company.postalCode, company.city, company.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }, [company]);

  const legalComplete = useMemo(() => {
    const keys = [company.siret, company.vatNumber, company.rcsRegistration] as const;
    return keys.filter((k) => k.trim()).length;
  }, [company]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Informations société</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Ces données alimentent les documents (contrats, factures), le site public et les communications clients. Les
          modifications sont enregistrées automatiquement.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200/80">
            <Store className="h-3.5 w-3.5 text-[#416B9F]" />
            {company.tradeName || company.legalName || 'Nom non renseigné'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200/80">
            <MapPin className="h-3.5 w-3.5" />
            {addressLine}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200/80">
            <Landmark className="h-3.5 w-3.5" />
            {legalComplete}/3 mentions clés
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/10 ring-offset-2">
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 px-3 sm:px-4">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={[
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-semibold transition',
                section === id
                  ? 'border-[#416B9F] text-[#416B9F]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {section === 'identity' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <FieldLabel>Raison sociale</FieldLabel>
                <input
                  value={company.legalName}
                  onChange={(e) => patch({ legalName: e.target.value })}
                  className={inputCls()}
                  placeholder="Dénomination légale"
                />
              </label>
              <label className="block">
                <FieldLabel>Nom commercial</FieldLabel>
                <input
                  value={company.tradeName}
                  onChange={(e) => patch({ tradeName: e.target.value })}
                  className={inputCls()}
                  placeholder="Bleu Calanque"
                />
              </label>
              <label className="block">
                <FieldLabel>Marque affichée</FieldLabel>
                <input
                  value={company.brandName}
                  onChange={(e) => patch({ brandName: e.target.value })}
                  className={inputCls()}
                  placeholder="Nom sur le site et les mails"
                />
              </label>
              <label className="block">
                <FieldLabel>Forme juridique</FieldLabel>
                <input
                  value={company.companyType}
                  onChange={(e) => patch({ companyType: e.target.value })}
                  className={inputCls()}
                  placeholder="SARL, SAS, EURL…"
                />
              </label>
              <label className="block">
                <FieldLabel>Capital social</FieldLabel>
                <input
                  value={company.shareCapital}
                  onChange={(e) => patch({ shareCapital: e.target.value })}
                  className={inputCls()}
                  placeholder="ex. 10 000 €"
                />
              </label>
            </div>
          ) : null}

          {section === 'address' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <FieldLabel>Domiciliation (si différente)</FieldLabel>
                <input
                  value={company.domiciliation}
                  onChange={(e) => patch({ domiciliation: e.target.value })}
                  className={inputCls()}
                  placeholder="Adresse de domiciliation du siège"
                />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>Adresse</FieldLabel>
                <input
                  value={company.addressLine}
                  onChange={(e) => patch({ addressLine: e.target.value })}
                  className={inputCls()}
                  placeholder="Numéro et rue"
                />
              </label>
              <label className="block">
                <FieldLabel>Code postal</FieldLabel>
                <input
                  value={company.postalCode}
                  onChange={(e) => patch({ postalCode: e.target.value })}
                  className={inputCls()}
                />
              </label>
              <label className="block">
                <FieldLabel>Ville</FieldLabel>
                <input
                  value={company.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  className={inputCls()}
                />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>Pays</FieldLabel>
                <input
                  value={company.country}
                  onChange={(e) => patch({ country: e.target.value })}
                  className={inputCls()}
                />
              </label>
            </div>
          ) : null}

          {section === 'locations' ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-zinc-600">
                Lieux affichés sur les contrats de location, les emails (départ / retour) et le site public. L’adresse
                du siège (onglet Adresse) reste distincte.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <FieldLabel>Lieu de départ (prise en charge bateau)</FieldLabel>
                  <input
                    value={company.departureLocation}
                    onChange={(e) => patchRentalLocations(e.target.value, company.arrivalLocation)}
                    className={inputCls()}
                    placeholder={DEFAULT_RENTAL_DEPARTURE_LOCATION}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Lieu d’arrivée (retour bateau)</FieldLabel>
                  <input
                    value={company.arrivalLocation}
                    onChange={(e) => patchRentalLocations(company.departureLocation, e.target.value)}
                    className={inputCls()}
                    placeholder={DEFAULT_RENTAL_ARRIVAL_LOCATION}
                  />
                </label>
              </div>
              <p className="text-[11px] text-zinc-500">
                Valeur par défaut conseillée : {DEFAULT_RENTAL_DEPARTURE_LOCATION}. Utilisée aussi comme base navale
                par défaut pour les annonces.
              </p>
            </div>
          ) : null}

          {section === 'contact' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Téléphone professionnel</FieldLabel>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={company.professionalPhone}
                    onChange={(e) => patch({ professionalPhone: e.target.value })}
                    className={`${inputCls()} pl-9`}
                    placeholder="01 …"
                  />
                </div>
              </label>
              <label className="block">
                <FieldLabel>Téléphone contact</FieldLabel>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={company.contactPhone}
                    onChange={(e) => patch({ contactPhone: e.target.value })}
                    className={`${inputCls()} pl-9`}
                    placeholder="06 …"
                  />
                </div>
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>Email contact</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={company.contactEmail}
                    onChange={(e) => patch({ contactEmail: e.target.value })}
                    className={`${inputCls()} pl-9`}
                    placeholder="contact@…"
                  />
                </div>
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>Site public</FieldLabel>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={company.publicSiteUrl}
                    onChange={(e) => patch({ publicSiteUrl: e.target.value })}
                    className={`${inputCls()} pl-9`}
                    placeholder="https://…"
                  />
                </div>
              </label>
            </div>
          ) : null}

          {section === 'legal' ? (
            <div className="space-y-4">
              <p className="text-xs text-zinc-600">Identifiants affichés sur vos documents officiels et factures.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>N° TVA intracommunautaire</FieldLabel>
                  <input
                    value={company.vatNumber}
                    onChange={(e) => patch({ vatNumber: e.target.value })}
                    className={inputCls()}
                    placeholder="FR…"
                  />
                </label>
                <label className="block">
                  <FieldLabel>SIRET</FieldLabel>
                  <input
                    value={company.siret}
                    onChange={(e) => patch({ siret: e.target.value })}
                    className={inputCls()}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Immatriculation RCS</FieldLabel>
                  <input
                    value={company.rcsRegistration}
                    onChange={(e) => patch({ rcsRegistration: e.target.value })}
                    className={inputCls()}
                    placeholder="RCS Marseille…"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Code NAF / APE</FieldLabel>
                  <input
                    value={company.nafCode}
                    onChange={(e) => patch({ nafCode: e.target.value })}
                    className={inputCls()}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {section === 'vat' ? (
            <div className="space-y-4">
              <p className="text-xs text-zinc-600">
                Paramètres de calcul TVA pour les annonces et la facturation (pourcentages).
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <FieldLabel>TVA annonces (%)</FieldLabel>
                  <div className="relative">
                    <input
                      inputMode="decimal"
                      value={String(company.adsVatRatePercent)}
                      onChange={(e) => patch({ adsVatRatePercent: parsePercent(e.target.value) })}
                      className={`${inputCls()} pr-8`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      %
                    </span>
                  </div>
                </label>
                <label className="block">
                  <FieldLabel>Assiette TVA (%)</FieldLabel>
                  <div className="relative">
                    <input
                      inputMode="decimal"
                      value={String(company.vatBasePercent)}
                      onChange={(e) => patch({ vatBasePercent: parsePercent(e.target.value) })}
                      className={`${inputCls()} pr-8`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      %
                    </span>
                  </div>
                </label>
                <label className="block">
                  <FieldLabel>Taux TVA (%)</FieldLabel>
                  <div className="relative">
                    <input
                      inputMode="decimal"
                      value={String(company.vatPercent)}
                      onChange={(e) => patch({ vatPercent: parsePercent(e.target.value) })}
                      className={`${inputCls()} pr-8`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      %
                    </span>
                  </div>
                </label>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-[11px] text-amber-950">
                Exemple : annonce 20 % · assiette 100 % · TVA 20 % → taux effectif aligné sur votre comptabilité.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
