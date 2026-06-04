import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Ban, TicketPercent, ChevronDown, ChevronUp } from 'lucide-react';
import type { ClientType, Civility, MemberClient } from '@/stores/members';
import { formatPhoneInput } from '@/lib/phone';
import { couponRequiresAirbusBadge } from '@/lib/airbusCoupon';
import type { BoatOption, ReservationWizardDetails, WizardPricingRecap } from '@/pages/calendar/reservationWizardTypes';
import { clientDisplayNameFromDetails } from '@/pages/calendar/reservationWizardTypes';
import { isCouponActiveNow, useCouponsStore } from '@/stores/coupons';
import { formatExtraPriceLine, useExtrasStore } from '@/stores/extras';

export function formatBirthDateInput(value: string) {
  const digits = value.replaceAll(/\D/g, '').slice(0, 8);
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  if (digits.length <= 2) return d;
  if (digits.length <= 4) return `${d}/${m}`;
  return `${d}/${m}/${y}`;
}

export function birthDateIsoToDisplay(iso?: string | null) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function birthDateDisplayToIso(display: string): string | null {
  const s = display.trim();
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (yyyy < 1900 || yyyy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold tracking-wide uppercase text-zinc-500">{children}</span>;
}

/** Corps commun des champs texte / liste (même arrondi gris que le reste du wizard). */
const RESA_FIELD_CLASS =
  'w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';

function inputBase() {
  return `mt-2 ${RESA_FIELD_CLASS}`;
}

const COUPON_SELECT_MANUAL = '__manual__';

export function RoundCheck(props: Readonly<{ checked: boolean; onToggle: () => void; label: string }>) {
  const { checked, onToggle, label } = props;
  return (
    <label className="flex gap-3 items-center px-3 py-3 bg-white rounded-2xl border shadow-sm cursor-pointer border-zinc-200/80">
      <span className="inline-flex relative justify-center items-center w-5 h-5 shrink-0">
        <input type="checkbox" checked={checked} onChange={() => onToggle()} className="sr-only peer" />
        <span className="h-5 w-5 rounded-full border border-zinc-300 bg-white shadow-sm transition-colors peer-checked:border-[#416B9F] peer-checked:bg-[#416B9F]" />
        <span className="pointer-events-none absolute text-[12px] font-black leading-none text-white opacity-0 transition-opacity peer-checked:opacity-100">
          ✓
        </span>
      </span>
      <span className="text-sm font-semibold text-zinc-800">{label}</span>
    </label>
  );
}

function CouponBadgeInline(props: Readonly<{ discountLabel: string }>) {
  const { discountLabel } = props;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
      <TicketPercent className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {discountLabel}
    </span>
  );
}

function getCouponDiscountLabel(couponLine: WizardPricingRecap['couponLine']): string | null {
  if (couponLine?.applies !== true) return null;
  if (couponLine.kind === 'percent') return `−${couponLine.effectiveValue}%`;
  return `−${couponLine.effectiveValue.toFixed(2)} €`;
}

function LocationLineValue(props: Readonly<{ hasPrice: boolean; priceNum: number; couponLine: WizardPricingRecap['couponLine'] }>) {
  const { hasPrice, priceNum, couponLine } = props;
  if (!hasPrice) return <span className="font-semibold text-zinc-500">À définir</span>;
  const discountLabel = getCouponDiscountLabel(couponLine);
  return (
    <span className="inline-flex gap-2 items-center">
      <span className="font-semibold text-zinc-900">{priceNum.toFixed(2)} €</span>
      {couponLine?.applies === true && discountLabel ? (
        <>
          <CouponBadgeInline discountLabel={discountLabel} />
          <span className="font-mono text-xs font-semibold text-emerald-800">{couponLine.code}</span>
        </>
      ) : null}
    </span>
  );
}

function ExtrasLineValue(
  props: Readonly<{
    extrasTotal: number;
    extrasNet: number | null;
    manualDiscPct: number;
    couponLine: WizardPricingRecap['couponLine'];
  }>,
) {
  const { extrasTotal, extrasNet, manualDiscPct } = props;
  const hasManual = manualDiscPct > 0;
  const showManualNet =
    hasManual &&
    extrasNet != null &&
    Number.isFinite(extrasNet) &&
    Math.abs(extrasNet - extrasTotal) > 0.005;
  const main = showManualNet ? extrasNet : extrasTotal;
  return (
    <span className="font-semibold text-zinc-900">
      {main.toFixed(2)} €
      {showManualNet ? (
        <span className="ml-1 text-xs font-normal text-zinc-500 line-through">{extrasTotal.toFixed(2)} €</span>
      ) : null}
    </span>
  );
}

function PricingLineWithToggle(props: Readonly<{
  label: string;
  value: React.ReactNode;
  canToggle: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  netValueLabel?: string | null;
}>) {
  const { label, value, canToggle, open, setOpen, netValueLabel } = props;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span>
          {label} : {value}
        </span>
        {canToggle ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 hover:bg-white"
            aria-label={`Voir le prix après remise (${label.toLowerCase()})`}
            title="Voir le prix après remise"
          >
            {open ? <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden /> : <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />}
          </button>
        ) : null}
      </div>
      {canToggle && open && netValueLabel ? (
        <div className="mt-1 text-xs text-zinc-500">
          Après remise : <span className="font-semibold text-zinc-900">{netValueLabel}</span>
        </div>
      ) : null}
    </>
  );
}

export function WizardStep1(props: Readonly<{
  dateIso: string;
  setDateIso: (v: string) => void;
  boatId: string;
  setBoatId: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  boats: BoatOption[];
  onAddUnavailability?: () => void;
}>) {
  const { dateIso, setDateIso, boatId, setBoatId, startTime, setStartTime, endTime, setEndTime, boats, onAddUnavailability } = props;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-zinc-800">Étape 1 — Créneau</p>
      <p className="text-xs leading-relaxed text-zinc-500">
        Le nom affiché sur le calendrier sera celui du client renseigné à l’étape 3.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Date</FieldLabel>
          <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} className={inputBase()} />
        </label>
        <label className="block">
          <FieldLabel>Bateau</FieldLabel>
          <select value={boatId} onChange={(e) => setBoatId(e.target.value)} className={inputBase()}>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Début</FieldLabel>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputBase()} />
        </label>
        <label className="block">
          <FieldLabel>Fin</FieldLabel>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputBase()} />
        </label>
      </div>

      {onAddUnavailability ? (
        <div className="rounded-2xl border border-[#416B9F]/20 bg-gradient-to-br from-[#416B9F]/10 to-white p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/20">
              <Ban className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">Indisponibilité</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Si tu veux <span className="font-semibold text-zinc-800">bloquer ce créneau</span> (réparation, usage privé, météo…)
                sans créer de réservation, crée plutôt une indisponibilité.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onAddUnavailability}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 transition-colors hover:bg-[#365b87]"
                >
                  <Ban className="h-4 w-4" aria-hidden />
                  Bloquer ce créneau
                </button>
                <span className="text-[11px] text-zinc-500">
                  Tu pourras choisir une raison et ajouter une note.
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WizardStep2(props: Readonly<{
  details: ReservationWizardDetails;
  setDetails: Dispatch<SetStateAction<ReservationWizardDetails>>;
}>) {
  const { details, setDetails } = props;
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-zinc-800">Étape 2 — Passagers & note</p>
      <label className="block">
        <FieldLabel>Nombre de passagers</FieldLabel>
        <input
          type="number"
          min={1}
          max={200}
          value={details.passengerCount}
          onChange={(e) => setDetails((d) => ({ ...d, passengerCount: Number(e.target.value) }))}
          className={inputBase()}
        />
      </label>
      <RoundCheck
        checked={details.hasChildren}
        onToggle={() => setDetails((d) => ({ ...d, hasChildren: !d.hasChildren }))}
        label="Présence d’enfants"
      />
      {details.hasChildren ? (
        <label className="block">
          <FieldLabel>Nombre d’enfants</FieldLabel>
          <input
            type="number"
            min={1}
            max={50}
            value={details.childrenCount || ''}
            onChange={(e) => setDetails((d) => ({ ...d, childrenCount: Number(e.target.value) }))}
            className={inputBase()}
          />
        </label>
      ) : null}
      <label className="block">
        <FieldLabel>Note interne</FieldLabel>
        <textarea
          value={details.internalNote}
          onChange={(e) => setDetails((d) => ({ ...d, internalNote: e.target.value }))}
          rows={4}
          className={inputBase()}
          placeholder="Optionnel"
        />
      </label>
    </div>
  );
}

export function WizardStep3(props: Readonly<{
  clientSearch: string;
  setClientSearch: (v: string) => void;
  clientMatches: MemberClient[];
  clientsLoading?: boolean;
  applyMember: (m: MemberClient) => void;
  details: ReservationWizardDetails;
  setDetails: Dispatch<SetStateAction<ReservationWizardDetails>>;
}>) {
  const { clientSearch, setClientSearch, clientMatches, clientsLoading = false, applyMember, details, setDetails } = props;
  const query = clientSearch.trim();
  const linkedId = details.linkedMemberId?.trim();
  const showDropdown = query.length > 0 && (clientsLoading || clientMatches.length > 0);
  const calendarLabel = clientDisplayNameFromDetails(details);

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-zinc-800">Étape 3 — Client & paiement (réservation)</p>
      {calendarLabel ? (
        <p className="rounded-xl border border-zinc-200/90 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          Nom sur le calendrier : <span className="font-semibold text-zinc-900">{calendarLabel}</span>
        </p>
      ) : null}
      <label className="block">
        <FieldLabel>Rechercher un client existant</FieldLabel>
        <input
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          className={inputBase()}
          placeholder="Nom, prénom, email ou téléphone…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />
        <p className="mt-1.5 text-xs text-zinc-400">Résultats mis à jour à chaque caractère saisi.</p>
      </label>
      {clientsLoading && query.length > 0 ? (
        <p className="text-sm text-zinc-500">Chargement des clients…</p>
      ) : null}
      {!clientsLoading && query.length > 0 && clientMatches.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucun client trouvé dans l’annuaire.</p>
      ) : null}
      {!linkedId && details.clientEmail.trim() && details.clientFirstName.trim() && details.clientLastName.trim() ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          Aucun client sélectionné : une fiche client sera créée automatiquement à l’enregistrement avec les informations ci-dessous.
        </p>
      ) : null}
      {clientMatches.length > 0 ? (
        <div
          role="listbox"
          className="max-h-48 space-y-1 overflow-auto rounded-2xl border border-zinc-200/90 bg-zinc-50 p-2 shadow-sm"
        >
          {clientMatches.map((m) => {
            const selected = linkedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => applyMember(m)}
                className={[
                  'flex w-full flex-col rounded-xl px-3 py-2 text-left text-sm transition-colors',
                  selected ? 'bg-[rgba(65,107,159,.12)] ring-1 ring-[#416B9F]/30' : 'hover:bg-white',
                ].join(' ')}
              >
                <span className="font-semibold text-zinc-900">
                  {m.firstName} {m.lastName}
                </span>
                <span className="text-xs text-zinc-500">
                  {m.email}
                  {m.phone ? ` · ${m.phone}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <label className="block">
        <FieldLabel>Type de client</FieldLabel>
        <select
          value={details.clientType}
          onChange={(e) => setDetails((d) => ({ ...d, clientType: e.target.value as ClientType }))}
          className={inputBase()}
        >
          <option value="particulier">Particulier</option>
          <option value="professionnel">Professionnel</option>
          <option value="association">Association</option>
        </select>
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Civilité</FieldLabel>
          <select
            value={details.civility}
            onChange={(e) => setDetails((d) => ({ ...d, civility: e.target.value as Civility }))}
            className={inputBase()}
          >
            <option value="">—</option>
            <option value="M.">M.</option>
            <option value="Mme">Mme</option>
            <option value="Mx">Mx</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Email</FieldLabel>
          <input
            value={details.clientEmail}
            onChange={(e) => setDetails((d) => ({ ...d, clientEmail: e.target.value }))}
            className={inputBase()}
          />
        </label>
        <label className="block">
          <FieldLabel>Prénom</FieldLabel>
          <input
            value={details.clientFirstName}
            onChange={(e) => setDetails((d) => ({ ...d, clientFirstName: e.target.value }))}
            className={inputBase()}
          />
        </label>
        <label className="block">
          <FieldLabel>Nom</FieldLabel>
          <input value={details.clientLastName} onChange={(e) => setDetails((d) => ({ ...d, clientLastName: e.target.value }))} className={inputBase()} />
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Téléphone</FieldLabel>
          <input
            value={details.clientPhone}
            onChange={(e) => setDetails((d) => ({ ...d, clientPhone: formatPhoneInput(e.target.value) }))}
            className={inputBase()}
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
          />
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Date de naissance</FieldLabel>
          <input
            value={details.clientBirthDateDisplay}
            onChange={(e) => setDetails((d) => ({ ...d, clientBirthDateDisplay: formatBirthDateInput(e.target.value) }))}
            className={inputBase()}
            inputMode="numeric"
            placeholder="JJ/MM/AAAA"
          />
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Adresse</FieldLabel>
          <input value={details.clientAddress} onChange={(e) => setDetails((d) => ({ ...d, clientAddress: e.target.value }))} className={inputBase()} />
        </label>
        <label className="block">
          <FieldLabel>Code postal</FieldLabel>
          <input
            value={details.clientPostalCode}
            onChange={(e) => setDetails((d) => ({ ...d, clientPostalCode: e.target.value }))}
            className={inputBase()}
          />
        </label>
        <label className="block">
          <FieldLabel>Ville</FieldLabel>
          <input value={details.clientCity} onChange={(e) => setDetails((d) => ({ ...d, clientCity: e.target.value }))} className={inputBase()} />
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Pays</FieldLabel>
          <input value={details.clientCountry} onChange={(e) => setDetails((d) => ({ ...d, clientCountry: e.target.value }))} className={inputBase()} />
        </label>
      </div>
      <div>
        <FieldLabel>Paiement de la réservation</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {(['online', 'offline'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDetails((d) => ({ ...d, paymentChannel: k }))}
              className={[
                'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                details.paymentChannel === k
                  ? 'bg-[#416B9F] text-white shadow-sm'
                  : 'border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50',
              ].join(' ')}
            >
              {k === 'online' ? 'En ligne' : 'Hors ligne'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WizardCouponRecapLi(props: Readonly<{ couponLine: NonNullable<WizardPricingRecap['couponLine']> }>) {
  const { couponLine } = props;
  const liClass = couponLine.applies === true ? '' : 'text-amber-800';

  if (couponLine.applies === true) {
    return (
      <li className={liClass}>
        Coupon <span className="font-mono font-semibold text-zinc-900">{couponLine.code}</span> : −
        {couponLine.kind === 'percent' ?
          <span className="font-semibold">{couponLine.effectiveValue}%</span>
        : <span className="font-semibold">{couponLine.effectiveValue.toFixed(2)} €</span>}
        {couponLine.tier === 'degraded' ?
          <span className="ml-1 text-xs font-normal text-amber-800"> (remise saison réduite)</span>
        : null}
      </li>
    );
  }

  return (
    <li className={liClass}>
      Coupon <span className="font-mono font-semibold">{couponLine.code}</span> : non appliqué
      {couponLine.inactiveReason ? <span className="text-xs"> — {couponLine.inactiveReason}</span> : null}
    </li>
  );
}

function WizardPricingRecapPanel(props: Readonly<{
  pricing: WizardPricingRecap;
  depositAmount: string;
  paymentChannel: 'online' | 'offline';
  installments: 1 | 2;
}>) {
  const { pricing, depositAmount, paymentChannel, installments } = props;
  const {
    priceNum,
    extrasTotal,
    manualDiscPct,
    hasPrice,
    afterManual,
    couponLine,
    priceLabelFinal,
    locationNet,
    extrasNet,
    storeCreditAppliedCents,
    storeCreditAvailableCents,
  } = pricing;
  const hasDiscounts = hasPrice && (manualDiscPct > 0 || couponLine?.applies === true);
  const showLocationToggle = hasDiscounts && locationNet !== null && Number.isFinite(locationNet);
  const showExtrasToggle = hasDiscounts && extrasTotal > 0 && extrasNet !== null && Number.isFinite(extrasNet);
  const [openLocation, setOpenLocation] = useState(false);
  const [openExtras, setOpenExtras] = useState(false);
  const locationNetLabel = showLocationToggle ? `${locationNet.toFixed(2)} €` : null;
  const extrasNetLabel = showExtrasToggle ? `${extrasNet.toFixed(2)} €` : null;

  return (
    <div className="p-4 text-sm rounded-2xl border border-zinc-200/90 bg-zinc-50 text-zinc-800">
      <p className="font-semibold text-zinc-900">Récapitulatif tarifaire</p>
      <ul className="mt-2 space-y-1 text-zinc-600">
        <li>
          <PricingLineWithToggle
            label="Location"
            value={<LocationLineValue hasPrice={hasPrice} priceNum={priceNum} couponLine={couponLine} />}
            canToggle={showLocationToggle}
            open={openLocation}
            setOpen={setOpenLocation}
            netValueLabel={locationNetLabel}
          />
        </li>
        {hasPrice && extrasTotal > 0 ? (
          <li>
            <PricingLineWithToggle
              label="Extras"
              value={
                <ExtrasLineValue
                  extrasTotal={extrasTotal}
                  extrasNet={extrasNet}
                  manualDiscPct={manualDiscPct}
                  couponLine={couponLine}
                />
              }
              canToggle={showExtrasToggle}
              open={openExtras}
              setOpen={setOpenExtras}
              netValueLabel={extrasNetLabel}
            />
          </li>
        ) : null}
        {hasPrice && manualDiscPct > 0 ? (
          <li>
            Remise manuelle : <span className="font-semibold">{manualDiscPct}%</span>
            {afterManual === null ? null : (
              <>
                {' '}
                → <span className="tabular-nums text-zinc-800">{afterManual.toFixed(2)} €</span>
              </>
            )}
          </li>
        ) : null}
        {couponLine && couponLine.applies !== true ? <WizardCouponRecapLi couponLine={couponLine} /> : null}
        {storeCreditAppliedCents > 0 ? (
          <li className="text-emerald-900">
            Avoir client :{' '}
            <span className="font-semibold">
              −{(storeCreditAppliedCents / 100).toFixed(2).replace('.', ',')} €
            </span>
            {storeCreditAvailableCents > storeCreditAppliedCents ? (
              <span className="ml-1 text-xs font-normal text-emerald-800">
                (solde {(storeCreditAvailableCents / 100).toFixed(2).replace('.', ',')} €)
              </span>
            ) : null}
          </li>
        ) : storeCreditAvailableCents > 0 && hasPrice ? (
          <li className="text-xs text-emerald-800">
            Avoir disponible : {(storeCreditAvailableCents / 100).toFixed(2).replace('.', ',')} € (sera déduit à la
            confirmation)
          </li>
        ) : null}
        <li>
          Caution :{' '}
          {depositAmount.trim() ? (
            <span className="font-semibold text-zinc-900">{depositAmount} €</span>
          ) : (
            <span className="font-semibold text-zinc-500">À définir</span>
          )}
        </li>
        <li>
          Paiement : {paymentChannel === 'online' ? 'en ligne' : 'hors ligne'} · {installments} échéance(s)
        </li>
        <li className="pt-2 text-base font-bold text-[#416B9F]">Tarif final : {priceLabelFinal}</li>
      </ul>
    </div>
  );
}

export function WizardStep4(props: Readonly<{
  details: ReservationWizardDetails;
  setDetails: Dispatch<SetStateAction<ReservationWizardDetails>>;
  pricing: WizardPricingRecap;
  catalogPricingNote?: string | null;
}>) {
  const { details, setDetails, pricing, catalogPricingNote } = props;
  const storeCoupons = useCouponsStore((s) => s.coupons);
  const storeExtras = useExtrasStore((s) => s.extras);
  const couponOptions = useMemo(
    () =>
      [...storeCoupons]
        .filter((c) => c.enabled && isCouponActiveNow(c))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [storeCoupons],
  );

  const couponCodeNorm = details.couponCode.trim().toUpperCase();
  const couponCodesInList = useMemo(() => new Set(couponOptions.map((c) => c.code)), [couponOptions]);
  const couponSelectValue = (() => {
    if (couponCodeNorm === '') return '';
    if (couponCodesInList.has(couponCodeNorm)) return couponCodeNorm;
    return COUPON_SELECT_MANUAL;
  })();

  const matchedCoupon =
    couponCodeNorm === ''
      ? null
      : storeCoupons.find((c) => c.code === couponCodeNorm) ?? null;
  const showAirbusBadge = matchedCoupon != null && couponRequiresAirbusBadge(matchedCoupon);

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-zinc-800">Étape 4 — Tarif, extras & règlement</p>
      <label className="block">
        <FieldLabel>Prix de la location (€)</FieldLabel>
        <input
          value={details.rentalPrice}
          onChange={(e) => setDetails((d) => ({ ...d, rentalPrice: e.target.value }))}
          className={inputBase()}
          placeholder="À définir"
          inputMode="decimal"
        />
        {catalogPricingNote ? <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{catalogPricingNote}</p> : null}
      </label>
      <label className="block">
        <FieldLabel>Remise (%)</FieldLabel>
        <input
          value={details.discountPercent}
          onChange={(e) => setDetails((d) => ({ ...d, discountPercent: e.target.value }))}
          className={inputBase()}
          placeholder="0"
          inputMode="decimal"
        />
      </label>
      <div className="block">
        <FieldLabel>Code coupon</FieldLabel>
        {couponOptions.length > 0 ? (
          <>
            <select
              value={couponSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || v === COUPON_SELECT_MANUAL) {
                  setDetails((d) => ({ ...d, couponCode: '' }));
                } else {
                  setDetails((d) => ({ ...d, couponCode: v }));
                }
              }}
              className={`mt-2 cursor-pointer ${RESA_FIELD_CLASS}`}
              aria-label="Choisir un coupon"
            >
              <option value="">Sans coupon (optionnel)</option>
              {couponOptions.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                  {c.internalLabel ? ` — ${c.internalLabel}` : ''}
                </option>
              ))}
              <option value={COUPON_SELECT_MANUAL}>Autre — saisie libre</option>
            </select>
            {couponSelectValue === COUPON_SELECT_MANUAL ? (
              <input
                type="text"
                value={details.couponCode}
                onChange={(e) => setDetails((d) => ({ ...d, couponCode: e.target.value.toUpperCase() }))}
                className={`mt-2 font-mono ${RESA_FIELD_CLASS}`}
                placeholder="Saisir un code"
                autoComplete="off"
                spellCheck={false}
              />
            ) : null}
            <p className="mt-1.5 text-xs text-zinc-500">
              Codes listés depuis la page <span className="font-medium text-zinc-600">Coupons</span> (actifs à la date
              du jour). « Autre » permet un code hors liste.
            </p>
          </>
        ) : (
          <>
            <input
              type="text"
              value={details.couponCode}
              onChange={(e) => setDetails((d) => ({ ...d, couponCode: e.target.value.toUpperCase() }))}
              className={inputBase()}
              placeholder="Aucun coupon actif — crée-en dans Coupons"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Dès qu’au moins un coupon est actif, une liste déroulante apparaît ici.
            </p>
          </>
        )}
      </div>
      {showAirbusBadge ? (
        <label className="block">
          <FieldLabel>N° badge Airbus</FieldLabel>
          <input
            type="text"
            value={details.airbusBadge}
            onChange={(e) =>
              setDetails((d) => ({
                ...d,
                airbusBadge: e.target.value.toUpperCase().replaceAll(/\s+/g, ''),
              }))
            }
            className={`mt-2 font-mono ${RESA_FIELD_CLASS}`}
            placeholder="Ex. A345678"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Obligatoire pour les coupons partenaire Airbus. Enregistré sur la fiche client si elle est liée.
          </p>
        </label>
      ) : null}
      <label className="block">
        <FieldLabel>Caution (€)</FieldLabel>
        <input
          value={details.depositAmount}
          onChange={(e) => setDetails((d) => ({ ...d, depositAmount: e.target.value }))}
          className={inputBase()}
          placeholder="À définir"
          inputMode="decimal"
        />
      </label>
      <div>
        <FieldLabel>Extras</FieldLabel>
        {storeExtras.filter((e) => e.enabled).length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucun extra actif. Ajoute-en dans la page <span className="font-semibold text-zinc-700">Extras</span>.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 mt-2 sm:grid-cols-2">
            {[...storeExtras]
              .filter((e) => e.enabled)
              .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
              .map((ex) => {
                const label = `${ex.name} · ${formatExtraPriceLine(ex)}`;
                return (
                  <RoundCheck
                    key={ex.id}
                    checked={Boolean(details.extras[ex.id])}
                    onToggle={() =>
                      setDetails((d) => ({
                        ...d,
                        extras: { ...d.extras, [ex.id]: !d.extras[ex.id] },
                      }))
                    }
                    label={label}
                  />
                );
              })}
          </div>
        )}
      </div>
      <div>
        <FieldLabel>Échéancier</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDetails((d) => ({ ...d, installments: n }))}
              className={[
                'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                details.installments === n
                  ? 'bg-[#416B9F] text-white shadow-sm'
                  : 'border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50',
              ].join(' ')}
            >
              Paiement en {n} fois
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <FieldLabel>Détails du règlement & conditions</FieldLabel>
        <textarea
          value={details.settlementNote}
          onChange={(e) => setDetails((d) => ({ ...d, settlementNote: e.target.value }))}
          rows={4}
          className={inputBase()}
          placeholder="Modalités, acompte, solde…"
        />
      </label>
      <WizardPricingRecapPanel
        pricing={pricing}
        depositAmount={details.depositAmount}
        paymentChannel={details.paymentChannel}
        installments={details.installments}
      />
    </div>
  );
}
