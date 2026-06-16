import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Portal } from '@/components/Portal';
import { api } from '@/lib/api';
import { useMembersStore, type MemberClient } from '@/stores/members';
import { formatPhoneInput } from '@/lib/phone';
import type {
  BoatOption,
  ReservationWizardDetails,
  ReservationWizardSubmitPayload,
  WizardPricingRecap,
} from '@/pages/calendar/reservationWizardTypes';
import { emptyWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import { couponRequiresAirbusBadge } from '@/lib/airbusCoupon';
import { applyCouponToRentalAndExtrasEuros } from '@bleu-calanque/shared';
import { reservationsToCouponCountables } from '@/lib/couponReservation';
import { getEffectiveCouponDiscount, isCouponActiveNow, useCouponsStore } from '@/stores/coupons';
import { deserializeReservation, useReservationsStore } from '@/stores/reservations';
import { birthDateIsoToDisplay, WizardStep1, WizardStep2, WizardStep3, WizardStep4 } from '@/pages/calendar/ReservationWizardSteps';
import { splitExtrasByPaymentChannel, sumExtrasEuros } from '@/lib/extraPricing';
import { useExtrasStore } from '@/stores/extras';
import { useBoatPricingStore } from '@/stores/boatPricing';
import { useBoatsStore } from '@/stores/boats';
import { computeCatalogLocationEuros, mergeBoatFleetRates } from '@/lib/calendarRentalPricing';
import { resolvePricingSeasonCode } from '@/lib/pricingSeasons';
import { searchMemberClients } from '@/lib/searchMemberClients';
import { ensureReservationClient, reservationTitleFromDetails } from '@/lib/ensureReservationClient';
import { clientDisplayNameFromDetails } from '@/pages/calendar/reservationWizardTypes';

export type { ReservationWizardDetails, ReservationWizardSubmitPayload } from '@/pages/calendar/reservationWizardTypes';

const STEPS = 4;

function emptyPricingRecap(manualDiscPct = 0): WizardPricingRecap {
  return {
    hasPrice: false,
    priceNum: Number.NaN,
    extrasTotal: 0,
    extrasOnlineTotal: 0,
    extrasOfflineTotal: 0,
    subtotal: Number.NaN,
    locationNet: null,
    extrasNet: null,
    manualDiscPct,
    afterManual: null,
    couponLine: null,
    finalPrice: null,
    priceLabelFinal: 'À définir',
    storeCreditAvailableCents: 0,
    storeCreditAppliedCents: 0,
  };
}

export function ReservationCreateWizard(props: Readonly<{
  presence: { present: boolean; phase: 'enter' | 'exit' };
  onClose: () => void;
  boats: BoatOption[];
  initialBoatId: string;
  initialDateIso: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialDetails?: ReservationWizardDetails;
  titleLabel?: string;
  submitLabel?: string;
  /** Si vrai (ex. édition d’une réservation), ne pas réécraser prix/caution depuis le catalogue. */
  lockCatalogPricing?: boolean;
  /** Exclure cette réservation du calcul de stock (édition). */
  excludeReservationId?: string;
  onAddUnavailability?: (payload: { boatId: string; dateIso: string; startTime: string; endTime: string }) => void;
  onSubmit: (payload: ReservationWizardSubmitPayload) => void;
}>) {
  const {
    presence,
    onClose,
    boats,
    initialBoatId,
    initialDateIso,
    initialStartTime,
    initialEndTime,
    initialDetails,
    titleLabel,
    submitLabel,
    lockCatalogPricing = false,
    excludeReservationId,
    onAddUnavailability,
    onSubmit,
  } = props;
  const members = useMembersStore((s) => s.members);
  const membersHydrated = useMembersStore((s) => s.hydrated);
  const refreshMembers = useMembersStore((s) => s.refresh);
  const addMember = useMembersStore((s) => s.addMember);
  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const reservationItems = useReservationsStore((s) => s.items);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);
  const allReservations = useMemo(
    () => reservationItems.map((s) => deserializeReservation(s)),
    [reservationItems],
  );
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const pricingPeriods = useBoatPricingStore((s) => s.periods);
  const pricesByPeriodId = useBoatPricingStore((s) => s.pricesByPeriodId);
  const fleetPricesByPeriodId = useBoatPricingStore((s) => s.fleetPricesByPeriodId);
  const pricingHydrated = useBoatPricingStore((s) => s.hydrated);
  const refreshPricing = useBoatPricingStore((s) => s.refresh);
  const catalogBoats = useBoatsStore((s) => s.boats);

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  const [boatId, setBoatId] = useState(initialBoatId);
  const [dateIso, setDateIso] = useState(initialDateIso);
  const [startTime, setStartTime] = useState(initialStartTime ?? '09:00');
  const [endTime, setEndTime] = useState(initialEndTime ?? '17:00');
  const [details, setDetails] = useState<ReservationWizardDetails>(() => initialDetails ?? emptyWizardDetails());
  const [clientSearch, setClientSearch] = useState(() => {
    const d = initialDetails ?? emptyWizardDetails();
    return clientDisplayNameFromDetails(d) || '';
  });
  const [submitting, setSubmitting] = useState(false);
  const [availableCreditCents, setAvailableCreditCents] = useState(0);

  const clients = useMemo(() => members.filter((m): m is MemberClient => m.role === 'client'), [members]);

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
  }, [reservationsHydrated, refreshReservations]);

  useEffect(() => {
    const memberId = details.linkedMemberId?.trim() || '';
    const email = details.clientEmail.trim().toLowerCase();
    if (!memberId && !email.includes('@')) {
      setAvailableCreditCents(0);
      return;
    }
    const ac = new AbortController();
    void api
      .get<{ availableCents: number }>('/members/credits/available', {
        params: {
          ...(memberId ? { memberId } : {}),
          ...(email ? { email } : {}),
        },
        signal: ac.signal,
      })
      .then((res) => setAvailableCreditCents(Math.max(0, res.data.availableCents ?? 0)))
      .catch(() => setAvailableCreditCents(0));
    return () => ac.abort();
  }, [details.linkedMemberId, details.clientEmail]);

  useEffect(() => {
    if (!pricingHydrated) void refreshPricing();
  }, [pricingHydrated, refreshPricing]);

  useEffect(() => {
    if (!membersHydrated) void refreshMembers();
  }, [membersHydrated, refreshMembers]);

  useEffect(() => {
    if (lockCatalogPricing || !boatId || !dateIso || !startTime || !endTime || !pricingHydrated) return;

    const month = new Date(`${dateIso}T12:00:00.000`).getMonth();
    const seasonCode = resolvePricingSeasonCode(month);
    const period = pricingPeriods.find((p) => p.code === seasonCode);
    if (!period) return;

    const rows = pricesByPeriodId[period.id]?.rows ?? [];
    const boatRow = rows.find((r) => r.boatId === boatId);
    const boat = catalogBoats.find((b) => b.id === boatId);
    const fleetRows = fleetPricesByPeriodId[period.id]?.rows ?? [];
    const fleetRow = boat?.fleetId ? fleetRows.find((r) => r.fleetId === boat.fleetId) : undefined;
    const merged = mergeBoatFleetRates(boatRow, fleetRow);
    const computed = computeCatalogLocationEuros(merged, dateIso, startTime, endTime);

    setDetails((d) => {
      const next = { ...d };
      if (computed) {
        next.rentalPrice = computed.euros.toLocaleString('fr-FR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      if (boat) {
        next.depositAmount = String(boat.depositEuros);
      }
      return next;
    });
  }, [
    lockCatalogPricing,
    boatId,
    dateIso,
    startTime,
    endTime,
    pricingHydrated,
    pricingPeriods,
    pricesByPeriodId,
    fleetPricesByPeriodId,
    catalogBoats,
  ]);

  const clientMatches = useMemo(
    () => searchMemberClients(clients, clientSearch, 10),
    [clientSearch, clients],
  );

  function applyMember(m: MemberClient) {
    setClientSearch(`${m.firstName} ${m.lastName}`.trim());
    setDetails((d) => ({
      ...d,
      linkedMemberId: m.id,
      clientEmail: m.email,
      clientFirstName: m.firstName,
      clientLastName: m.lastName,
      clientPhone: m.phone ? formatPhoneInput(String(m.phone)) : '',
      clientType: m.clientType,
      civility: m.civility,
      clientBirthDateDisplay: birthDateIsoToDisplay(m.birthDate),
      clientAddress: m.address ?? '',
      clientPostalCode: m.postalCode ?? '',
      clientCity: m.city ?? '',
      clientCountry: m.country ?? 'France',
      airbusBadge: m.airbusBadge?.trim() ? m.airbusBadge.trim().toUpperCase() : '',
    }));
  }

  function validateStep1() {
    if (!boatId) return 'Choisis un bateau.';
    if (!dateIso) return 'Choisis une date.';
    if (!startTime || !endTime) return 'Renseigne les horaires.';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const day = new Date(`${dateIso}T00:00:00`);
    const s = new Date(day);
    s.setHours(sh, sm, 0, 0);
    const e = new Date(day);
    e.setHours(eh, em, 0, 0);
    if (s >= e) return 'L’heure de fin doit être après le début.';
    return '';
  }

  function validateStep2() {
    if (!Number.isFinite(details.passengerCount) || details.passengerCount < 1) return 'Nombre de passagers invalide.';
    if (details.hasChildren && (!Number.isFinite(details.childrenCount) || details.childrenCount < 1)) {
      return 'Indique le nombre d’enfants.';
    }
    return '';
  }

  function validateStep3() {
    if (!details.clientEmail.trim()) return 'Email requis.';
    if (!details.clientEmail.includes('@')) return 'Email invalide.';
    if (!details.clientFirstName.trim() || !details.clientLastName.trim()) return 'Prénom et nom requis.';
    return '';
  }

  function validateAirbusBadge(): string {
    const codeNorm = details.couponCode.trim().replaceAll(/\s+/g, '').toUpperCase();
    if (!codeNorm) return '';
    const matched = couponsCatalog.find((c) => c.code === codeNorm);
    if (!matched || !couponRequiresAirbusBadge(matched)) return '';
    if (!details.airbusBadge.trim()) return 'Le numéro de badge Airbus est requis pour ce coupon.';
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(details.airbusBadge.trim())) {
      return 'Format badge invalide (ex. A345678).';
    }
    return '';
  }

  function next() {
    setError('');
    let msg = '';
    if (step === 1) msg = validateStep1();
    else if (step === 2) msg = validateStep2();
    else if (step === 3) msg = validateStep3();
    if (msg) {
      setError(msg);
      return;
    }
    setStep((s) => Math.min(STEPS, s + 1));
  }

  function prev() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  function submit() {
    const msg1 = validateStep1();
    if (msg1) {
      setError(msg1);
      setStep(1);
      return;
    }
    const msg2 = validateStep2();
    if (msg2) {
      setError(msg2);
      setStep(2);
      return;
    }
    const msg3 = validateStep3();
    if (msg3) {
      setError(msg3);
      setStep(3);
      return;
    }
    const msgBadge = validateAirbusBadge();
    if (msgBadge) {
      setError(msgBadge);
      setStep(4);
      return;
    }

    void (async () => {
      setSubmitting(true);
      setError('');
      const ensured = await ensureReservationClient(details, clients, addMember);
      if (ensured.error) {
        setError(ensured.error);
        setStep(3);
        setSubmitting(false);
        return;
      }
      const finalDetails = ensured.details;
      const title = reservationTitleFromDetails(finalDetails);
      if (finalDetails.linkedMemberId && !clientSearch.trim()) {
        const linked = clients.find((c) => c.id === finalDetails.linkedMemberId);
        if (linked) setClientSearch(clientDisplayNameFromDetails(finalDetails));
      }
      onSubmit({
        boatId,
        dateIso,
        startTime,
        endTime,
        bookerName: title,
        details: finalDetails,
        totalDueCents:
          pricingRecap.finalPrice != null && Number.isFinite(pricingRecap.finalPrice)
            ? Math.round(pricingRecap.finalPrice * 100)
            : null,
      });
      setSubmitting(false);
    })();
  }

  const pricingRecap = useMemo((): WizardPricingRecap => {
    const rawPrice = Number.parseFloat(details.rentalPrice.replace(',', '.'));
    const rawManual = Number.parseFloat(details.discountPercent.replace(',', '.'));
    const manualDiscPct = Number.isFinite(rawManual) ? Math.min(100, Math.max(0, rawManual)) : 0;

    const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;
    if (!hasPrice) {
      return emptyPricingRecap(manualDiscPct);
    }

    const priceNum = rawPrice;
    const selectedExtraIds = new Set(Object.entries(details.extras).filter(([, v]) => Boolean(v)).map(([id]) => id));
    const selectedExtras = extrasCatalog.filter((e) => e.enabled && selectedExtraIds.has(e.id));

    // Durée (jours) dérivée du créneau. Pour l’instant, le wizard ne gère qu’un jour,
    // mais ça permet déjà d’avoir des unités `jour` / `semaine` cohérentes si on étend plus tard.
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const baseDay = new Date(`${dateIso}T00:00:00.000`);
    const start = new Date(baseDay);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(baseDay);
    end.setHours(eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
    const rentalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

    const { online: onlineExtras, offline: offlineExtras } = splitExtrasByPaymentChannel(selectedExtras);
    const extrasOnlineTotal = sumExtrasEuros(priceNum, onlineExtras, rentalDays);
    const extrasOfflineTotal = sumExtrasEuros(priceNum, offlineExtras, rentalDays);
    const extrasTotal = Math.round((extrasOnlineTotal + extrasOfflineTotal) * 100) / 100;

    // Seuls location + extras en ligne entrent dans le total à payer et l'avoir.
    const payableSubtotal = Math.round((priceNum + extrasOnlineTotal) * 100) / 100;
    const manualFactor = 1 - manualDiscPct / 100;
    const afterManual = Math.round(payableSubtotal * manualFactor * 100) / 100;
    const locationAfterManual = Math.round(priceNum * manualFactor * 100) / 100;
    const extrasAfterManual = Math.round(extrasOnlineTotal * manualFactor * 100) / 100;
    const subtotal = payableSubtotal;

    const codeNorm = details.couponCode.trim().replaceAll(/\s+/g, '').toUpperCase();
    const clientKey = details.linkedMemberId?.trim() || details.clientEmail.trim().toLowerCase() || '__guest__';
    const evalDate = new Date(`${dateIso}T12:00:00.000`);

    let final = afterManual;
    let couponLine: WizardPricingRecap['couponLine'] = null;
    let locationNet = locationAfterManual;
    let extrasNet = extrasAfterManual;

    if (codeNorm) {
      const matched = couponsCatalog.find((c) => c.code === codeNorm);
      if (!matched) {
        couponLine = {
          code: codeNorm,
          applies: false,
          kind: 'percent',
          effectiveValue: 0,
          tier: 'full',
          inactiveReason: 'Code inconnu dans Coupons',
        };
      } else if (!matched.enabled || !isCouponActiveNow(matched)) {
        couponLine = {
          code: codeNorm,
          applies: false,
          kind: matched.discountKind,
          effectiveValue: matched.discountValue,
          tier: 'full',
          inactiveReason: 'Coupon désactivé ou hors période de validité',
        };
      } else {
        const couponReservations = excludeReservationId
          ? allReservations.filter((r) => r.id !== excludeReservationId)
          : allReservations;
        const eff = getEffectiveCouponDiscount(
          matched,
          clientKey,
          reservationsToCouponCountables(couponReservations),
          evalDate,
        );
        couponLine = {
          code: codeNorm,
          applies: true,
          kind: eff.discountKind,
          effectiveValue: eff.discountValue,
          tier: eff.tier,
        };
        const priced = applyCouponToRentalAndExtrasEuros(locationAfterManual, extrasAfterManual, {
          discountKind: eff.discountKind,
          discountValue: eff.discountValue,
        });
        locationNet = priced.locationNet;
        extrasNet = priced.extrasNet;
        final = priced.final;
      }
    }

    final = Math.round(final * 100) / 100;

    const finalCents = Math.round(final * 100);
    const storeCreditAppliedCents = Math.min(availableCreditCents, finalCents);
    const netCents = Math.max(0, finalCents - storeCreditAppliedCents);
    const netFinal = netCents / 100;

    let priceLabelFinal = `${netFinal.toFixed(2)} €`;
    if (storeCreditAppliedCents > 0 && netCents === 0) {
      priceLabelFinal = '0,00 € (couvert par l\'avoir)';
    } else if (storeCreditAppliedCents > 0) {
      priceLabelFinal = `${netFinal.toFixed(2)} €`;
    }

    return {
      hasPrice: true,
      priceNum,
      extrasTotal,
      extrasOnlineTotal,
      extrasOfflineTotal,
      subtotal,
      locationNet,
      extrasNet,
      manualDiscPct,
      afterManual,
      couponLine,
      finalPrice: netFinal,
      priceLabelFinal,
      storeCreditAvailableCents: availableCreditCents,
      storeCreditAppliedCents,
    };
  }, [
    availableCreditCents,
    couponsCatalog,
    allReservations,
    excludeReservationId,
    dateIso,
    endTime,
    details.couponCode,
    details.discountPercent,
    details.extras,
    details.clientEmail,
    details.linkedMemberId,
    details.rentalPrice,
    extrasCatalog,
    startTime,
  ]);

  const catalogPricingNote = useMemo(() => {
    if (lockCatalogPricing || !boatId || !dateIso || !pricingHydrated) return null;
    const month = new Date(`${dateIso}T12:00:00.000`).getMonth();
    const seasonCode = resolvePricingSeasonCode(month);
    const period = pricingPeriods.find((p) => p.code === seasonCode);
    if (!period) return 'Période tarifaire introuvable — vérifie les paramètres ou saisis le prix à la main.';
    const rows = pricesByPeriodId[period.id]?.rows ?? [];
    const boatRow = rows.find((r) => r.boatId === boatId);
    const boat = catalogBoats.find((b) => b.id === boatId);
    const fleetRows = fleetPricesByPeriodId[period.id]?.rows ?? [];
    const fleetRow = boat?.fleetId ? fleetRows.find((r) => r.fleetId === boat.fleetId) : undefined;
    const merged = mergeBoatFleetRates(boatRow, fleetRow);
    const computed = computeCatalogLocationEuros(merged, dateIso, startTime, endTime);
    if (computed) {
      const src =
        boatRow && (boatRow.demiJournee != null || boatRow.journee != null || boatRow.semaine != null)
          ? 'bateau'
          : fleetRow && (fleetRow.demiJournee != null || fleetRow.journee != null || fleetRow.semaine != null)
            ? 'flotille'
            : 'catalogue';
      return `Tarif ${src} (${computed.note}). Tu peux l’ajuster ci-dessous.`;
    }
    return 'Tarif catalogue incomplet pour ce créneau — renseigne les prix par flotille ou par bateau dans Paramètres → Périodes, ou saisis un montant manuellement.';
  }, [
    lockCatalogPricing,
    boatId,
    dateIso,
    startTime,
    endTime,
    pricingHydrated,
    pricingPeriods,
    pricesByPeriodId,
    fleetPricesByPeriodId,
    catalogBoats,
  ]);

  function renderStep() {
    if (step === 1)
      return (
        <WizardStep1
          dateIso={dateIso}
          setDateIso={setDateIso}
          boatId={boatId}
          setBoatId={setBoatId}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          boats={boats}
          onAddUnavailability={
            onAddUnavailability
              ? () => onAddUnavailability({ boatId, dateIso, startTime, endTime })
              : undefined
          }
        />
      );
    if (step === 2) return <WizardStep2 details={details} setDetails={setDetails} />;
    if (step === 3)
      return (
        <WizardStep3
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          clientMatches={clientMatches}
          clientsLoading={!membersHydrated}
          applyMember={applyMember}
          details={details}
          setDetails={setDetails}
        />
      );
    return (
      <WizardStep4
        details={details}
        setDetails={setDetails}
        pricing={pricingRecap}
        catalogPricingNote={catalogPricingNote}
        dateIso={dateIso}
        startTime={startTime}
        endTime={endTime}
        excludeReservationId={excludeReservationId}
      />
    );
  }

  function onBackPress() {
    if (step === 1) onClose();
    else prev();
  }

  if (!presence.present) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className={['absolute inset-0 bg-black/30 bc-animate', presence.phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit'].join(' ')}
          aria-label="Fermer"
          onClick={onClose}
        />
        <div
          className={[
            'absolute right-0 top-0 h-full w-full max-w-xl overflow-auto bg-white shadow-2xl bc-animate',
            presence.phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
          ].join(' ')}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/90 px-6 py-5 backdrop-blur">
            <div>
              <p className="text-lg font-bold tracking-tight text-zinc-900">{titleLabel ?? 'Nouvelle réservation'}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Étape {step} / {STEPS}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
              aria-label="Fermer"
            >
              <ChevronRight className="h-5 w-5 rotate-180" strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          <div className="flex gap-2 border-b border-zinc-100 px-6 py-3">
            {Array.from({ length: STEPS }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className={['h-1.5 flex-1 rounded-full transition-colors', n <= step ? 'bg-[#416B9F]' : 'bg-zinc-200'].join(' ')}
              />
            ))}
          </div>

          <div className="space-y-5 px-6 py-6">
            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            ) : null}

            {renderStep()}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onBackPress}
                className="rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
              >
                {step === 1 ? 'Annuler' : 'Précédent'}
              </button>
              <div className="flex gap-3">
                {step < STEPS ? (
                  <button
                    type="button"
                    onClick={next}
                    className="rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 transition-colors hover:bg-[#365b87]"
                  >
                    Suivant
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 transition-colors hover:bg-[#365b87] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Enregistrement…' : (submitLabel ?? 'Créer la réservation')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
