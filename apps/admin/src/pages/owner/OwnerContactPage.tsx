import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Contact,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { mapsSearchUrl, phoneToTelUri } from '@/lib/contactLinks';
import { useDefaultPageFilters } from '@/contexts/PageFiltersContext';
import { OwnerPortalPageShell } from '@/components/owner/OwnerPortalPageShell';

export type OwnerContactInfo = {
  brandName: string;
  legalName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  professionalPhone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  addressFormatted: string | null;
  publicSiteUrl: string | null;
  openingHours: string | null;
};

type ContactAction = {
  label: string;
  href: string;
  external?: boolean;
  primary?: boolean;
};

function ContactChannelCard(props: Readonly<{
  label: string;
  hint: string;
  Icon: LucideIcon;
  empty?: boolean;
  children?: React.ReactNode;
  actions?: ContactAction[];
}>) {
  const { Icon } = props;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{props.label}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{props.hint}</p>
          </div>
        </div>
      </div>
      {props.empty ? (
        <p className="text-[11px] text-zinc-500">Non renseigné — utilisez un autre canal ci-dessous.</p>
      ) : (
        <>
          {props.children ? <div className="text-sm text-zinc-800">{props.children}</div> : null}
          {props.actions && props.actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {props.actions.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  target={a.external ? '_blank' : undefined}
                  rel={a.external ? 'noopener noreferrer' : undefined}
                  className={
                    a.primary
                      ? 'inline-flex items-center gap-1.5 rounded-2xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 hover:bg-[#365b87]'
                      : 'inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200/90 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50'
                  }
                >
                  {a.label}
                  {a.external ? <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden /> : null}
                </a>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function OwnerContactPage() {
  useDefaultPageFilters('Contact');
  const [info, setInfo] = useState<OwnerContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<OwnerContactInfo>('/owner/contact');
      setInfo(data);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setError('Session expirée ou accès refusé. Reconnectez-vous.');
      } else {
        setError('Impossible de charger les coordonnées. Vérifiez que l’API est démarrée, puis réessayez.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mainPhone = info?.contactPhone ?? info?.professionalPhone ?? null;
  const telUri = mainPhone ? phoneToTelUri(mainPhone) : '';
  const showProPhone =
    info?.professionalPhone &&
    info.professionalPhone !== info?.contactPhone &&
    info.professionalPhone.trim().length > 0;
  const brandLabel = info?.brandName ?? 'Bleu Calanque';

  return (
    <OwnerPortalPageShell
      title="Contact"
      subtitle={`Coordonnées ${brandLabel} — planning, bateaux et urgences`}
      sectionTitle="Nous joindre"
      sectionIcon={Contact}
      ready={!loading}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-zinc-900">Coordonnées {brandLabel}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Ces informations sont celles renseignées par l’équipe dans les paramètres société. Utilisez le canal adapté à
            votre demande (planning, réservation, question administrative).
          </p>
          {info ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200/80">
                <Store className="h-3.5 w-3.5 text-[#416B9F]" aria-hidden />
                {brandLabel}
              </span>
              {info.contactEmail ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200/80">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  {info.contactEmail}
                </span>
              ) : null}
              {mainPhone ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-zinc-600 ring-1 ring-zinc-200/80">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {mainPhone}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-red-300/80 bg-white px-4 py-2 text-sm font-semibold text-red-900 shadow-sm hover:bg-red-50"
            >
              Réessayer
            </button>
          </div>
        ) : null}

        {info ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5">
            <div>
              <h4 className="text-sm font-semibold text-sky-800">Canaux de contact</h4>
              <p className="mt-0.5 text-xs text-zinc-600">E-mail, téléphone, SMS, adresse et horaires.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <ContactChannelCard
                label="E-mail"
                hint="Réponse sous 24–48 h ouvrées en général."
                Icon={Mail}
                empty={!info.contactEmail}
                actions={
                  info.contactEmail
                    ? [{ label: 'Écrire', href: `mailto:${info.contactEmail}`, primary: true }]
                    : undefined
                }
              >
                {info.contactEmail ? (
                  <a href={`mailto:${info.contactEmail}`} className="break-all font-medium text-[#416B9F] hover:underline">
                    {info.contactEmail}
                  </a>
                ) : null}
              </ContactChannelCard>

              <ContactChannelCard
                label="Téléphone"
                hint="Appel direct vers l’équipe."
                Icon={Phone}
                empty={!mainPhone}
                actions={
                  telUri
                    ? [
                        { label: 'Appeler', href: `tel:${telUri}`, primary: true },
                        { label: 'SMS', href: `sms:${telUri}` },
                      ]
                    : undefined
                }
              >
                {mainPhone ? <p className="font-medium">{mainPhone}</p> : null}
                {showProPhone ? (
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Ligne pro. :{' '}
                    <a
                      href={`tel:${phoneToTelUri(info.professionalPhone!)}`}
                      className="font-medium text-[#416B9F] hover:underline"
                    >
                      {info.professionalPhone}
                    </a>
                  </p>
                ) : null}
              </ContactChannelCard>

              <ContactChannelCard
                label="SMS"
                hint="Message court depuis votre mobile."
                Icon={MessageSquare}
                empty={!mainPhone}
                actions={telUri ? [{ label: 'Envoyer un SMS', href: `sms:${telUri}`, primary: true }] : undefined}
              >
                {mainPhone && telUri ? (
                  <p className="text-[11px] leading-relaxed text-zinc-600">
                    Au <span className="font-medium text-zinc-800">{mainPhone}</span> via l’app Messages.
                  </p>
                ) : null}
              </ContactChannelCard>

              <ContactChannelCard
                label="Adresse"
                hint="Siège et base — rendez-vous sur place."
                Icon={MapPin}
                empty={!info.addressFormatted}
                actions={
                  info.addressFormatted
                    ? [
                        {
                          label: 'Maps',
                          href: mapsSearchUrl(info.addressFormatted.replaceAll('\n', ', ')),
                          external: true,
                        },
                      ]
                    : undefined
                }
              >
                {info.addressFormatted ? (
                  <p className="whitespace-pre-line text-[11px] leading-relaxed">{info.addressFormatted}</p>
                ) : null}
              </ContactChannelCard>

              <ContactChannelCard
                label="Horaires d’ouverture"
                hint="Créneaux habituels de l’équipe."
                Icon={Clock}
                empty={!info.openingHours}
              >
                {info.openingHours ? (
                  <p className="whitespace-pre-line text-[11px] leading-relaxed">{info.openingHours}</p>
                ) : null}
              </ContactChannelCard>

              {info.publicSiteUrl ? (
                <ContactChannelCard
                  label="Site web"
                  hint="Informations publiques et offres."
                  Icon={Globe}
                  actions={[
                    {
                      label: 'Ouvrir le site',
                      href: info.publicSiteUrl.startsWith('http') ? info.publicSiteUrl : `https://${info.publicSiteUrl}`,
                      external: true,
                      primary: true,
                    },
                  ]}
                >
                  <a
                    href={info.publicSiteUrl.startsWith('http') ? info.publicSiteUrl : `https://${info.publicSiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium text-[#416B9F] hover:underline"
                  >
                    {info.publicSiteUrl}
                  </a>
                </ContactChannelCard>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className="text-[11px] text-zinc-500">
          En cas d’urgence sur une réservation en cours, privilégiez le téléphone.
        </p>
      </div>
    </OwnerPortalPageShell>
  );
}
