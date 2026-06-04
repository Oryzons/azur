import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Ship, Tags, X, Trash2, Pencil } from 'lucide-react';
import { usePresence } from '@/lib/presence';
import { BOAT_TYPES_UI, useBoatsStore, defaultBoatDetails, type Boat, type BoatDetails, type BoatType, type WindlassType } from '@/stores/boats';
import { Portal } from '@/components/Portal';
import { useMembersStore } from '@/stores/members';
import { usePageFiltersPanel, type PageFiltersConfig } from '@/contexts/PageFiltersContext';
import { PresentationPhotosField } from '@/components/media/PresentationPhotosField';
import { BoatCoverAvatar } from '@/components/media/BoatCoverAvatar';
import { coverPhotoUrl } from '@/lib/mediaPhotos';
import { boatSearchHaystack, boatTypeLabel } from '@/lib/boatUi';
import { BoatDetailPanel } from '@/components/boats/BoatDetailPanel';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { ThreeStepGuide } from '@/components/ui/ThreeStepGuide';
import { BoatsPageSkeleton } from '@/components/skeletons/BoatsPageSkeleton';

type FleetRowProps = Readonly<{
  name: string;
  boatsCount: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}>;

function FleetRow(props: FleetRowProps) {
  const { name, boatsCount, selected, onSelect, onEdit, onRemove } = props;
  return (
    <div
      className={[
        'flex gap-2 justify-between items-stretch rounded-2xl border shadow-sm transition-colors',
        selected
          ? 'border-[#416B9F]/50 bg-[#416B9F]/6 ring-2 ring-[#416B9F]/20'
          : 'border-zinc-200/90 bg-white',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 px-3 py-2 text-left rounded-2xl outline-none hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#416B9F]/30"
        aria-current={selected ? 'true' : undefined}
        aria-label={`Afficher les bateaux de la flotille ${name}`}
      >
        <p className="text-sm font-semibold truncate text-zinc-900">{name}</p>
        <p className="text-xs text-zinc-500">{boatsCount + ' bateau(x)'}</p>
      </button>
      <div className="flex gap-0.5 items-center pr-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex justify-center items-center w-9 h-9 rounded-2xl text-zinc-500 hover:bg-zinc-50"
          aria-label="Modifier la flotille"
          title="Modifier"
        >
          <Pencil className="w-4 h-4" strokeWidth={1.9} aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex justify-center items-center w-9 h-9 rounded-2xl text-zinc-500 hover:bg-zinc-50"
          aria-label="Supprimer la flotille"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" strokeWidth={1.9} aria-hidden />
        </button>
      </div>
    </div>
  );
}

const BOAT_TYPES = BOAT_TYPES_UI;

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold tracking-wide uppercase text-zinc-500">{children}</span>;
}

function inputBase(disabled?: boolean, noMarginTop?: boolean) {
  return [
    noMarginTop ? 'w-full' : 'mt-2 w-full',
    'rounded-2xl border bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors',
    'border-zinc-200/90 focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15',
    disabled ? 'opacity-60' : '',
  ].join(' ');
}

type BoatsPageViewProps = Readonly<{
  owners: { id: string; label: string }[];
  fleets: { id: string; name: string }[];
  search: string;
  setSearch: (v: string) => void;
  selectedFleetId: string | null;
  onSelectFleet: (fleetId: string | null) => void;
  searchMatchCount: number;
  boatsByFleetSidebar: Map<string, any[]>;
  boats: Boat[];
  catalogBoats: Boat[];
  fleetNameById: Map<string, string>;

  // Create fleet
  fleetName: string;
  setFleetName: (v: string) => void;
  addFleet: () => void;

  // Boats
  selectedBoatId: string | null;
  onSelectBoat: (id: string | null) => void;
  openForm: () => void;
  openEditBoat: (id: string) => void;
  removeBoat: (id: string) => void;

  // Fleets
  openEditFleet: (id: string) => void;
  removeFleet: (id: string) => void;

  // Panels
  formPresence: { present: boolean; phase: 'enter' | 'exit' };
  fleetEditPresence: { present: boolean; phase: 'enter' | 'exit' };
  closeForm: () => void;
  closeEditFleet: () => void;
  saveFleetEdit: () => void;

  editingBoatId: string | null;
  brand: string;
  setBrand: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  boatType: BoatType;
  setBoatType: (v: BoatType) => void;
  maxPassengers: string;
  setMaxPassengers: (v: string) => void;
  depositEuros: string;
  setDepositEuros: (v: string) => void;
  ownerId: string;
  setOwnerId: (v: string) => void;
  fleetId: string;
  setFleetId: (v: string) => void;
  presentationPhotos: string[];
  setPresentationPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  extra: BoatDetails;
  setExtra: React.Dispatch<React.SetStateAction<BoatDetails>>;
  submitBoat: () => void;

  editingFleetId: string | null;
  fleetEditName: string;
  setFleetEditName: (v: string) => void;

  error: string;
  success: string;
}>;

type FleetsPanelProps = Readonly<{
  fleets: { id: string; name: string }[];
  boatsByFleet: Map<string, any[]>;
  selectedFleetId: string | null;
  onSelectFleet: (fleetId: string | null) => void;
  searchMatchCount: number;
  fleetName: string;
  setFleetName: (v: string) => void;
  addFleet: () => void;
  openEditFleet: (id: string) => void;
  removeFleet: (id: string) => void;
  error: string;
  success: string;
}>;

function FleetsPanel(props: FleetsPanelProps) {
  const {
    fleets,
    boatsByFleet,
    selectedFleetId,
    onSelectFleet,
    searchMatchCount,
    fleetName,
    setFleetName,
    addFleet,
    openEditFleet,
    removeFleet,
    error,
    success,
  } = props;
  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-sm">
      <div className="flex gap-3 justify-between items-center">
        <div className="flex gap-2 items-center">
          <Tags className="w-5 h-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
          <h2 className="text-sm font-semibold text-zinc-900">Flotilles</h2>
        </div>
      </div>

      <div className="mt-4">
        <FieldLabel>Créer une flotille</FieldLabel>
        <div className="flex gap-2 mt-2">
          <input
            value={fleetName}
            onChange={(e) => setFleetName(e.target.value)}
            placeholder="Ex: Premium, École, Charter…"
            className={[
              'w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors',
              'focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={addFleet}
            className="px-4 py-3 text-sm font-semibold bg-white rounded-2xl border shadow-sm transition-colors shrink-0 border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
          >
            Ajouter
          </button>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-medium text-emerald-700">{success}</p> : null}
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex justify-between items-center">
          <FieldLabel>Flotilles existantes</FieldLabel>
          <span className="text-xs font-semibold text-zinc-400">{fleets.length}</span>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onSelectFleet(null)}
            className={[
              'flex gap-3 justify-between items-center px-3 py-2.5 w-full text-left rounded-2xl border shadow-sm transition-colors',
              selectedFleetId === null
                ? 'border-[#416B9F]/50 bg-[#416B9F]/6 ring-2 ring-[#416B9F]/20'
                : 'border-zinc-200/90 bg-white hover:bg-zinc-50/80',
            ].join(' ')}
            aria-current={selectedFleetId === null ? 'true' : undefined}
          >
            <p className="text-sm font-semibold text-zinc-900">Toutes les flotilles</p>
            <span className="text-xs font-semibold tabular-nums text-zinc-400">{searchMatchCount}</span>
          </button>
          {fleets.map((f) => (
            <FleetRow
              key={f.id}
              name={f.name}
              boatsCount={boatsByFleet.get(f.id)?.length ?? 0}
              selected={selectedFleetId === f.id}
              onSelect={() => onSelectFleet(f.id)}
              onEdit={() => openEditFleet(f.id)}
              onRemove={() => removeFleet(f.id)}
            />
          ))}
          {fleets.length === 0 ? (
            <div className="px-4 py-6 text-sm rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-zinc-500">
              Aucune flotille pour le moment.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type BoatEditorModalProps = Readonly<{
  present: boolean;
  phase: 'enter' | 'exit';
  editingBoatId: string | null;
  fleets: { id: string; name: string }[];
  owners: { id: string; label: string }[];
  error: string;
  brand: string;
  setBrand: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  boatType: BoatType;
  setBoatType: (v: BoatType) => void;
  maxPassengers: string;
  setMaxPassengers: (v: string) => void;
  depositEuros: string;
  setDepositEuros: (v: string) => void;
  ownerId: string;
  setOwnerId: (v: string) => void;
  fleetId: string;
  setFleetId: (v: string) => void;
  presentationPhotos: string[];
  setPresentationPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  extra: BoatDetails;
  setExtra: React.Dispatch<React.SetStateAction<BoatDetails>>;
  onClose: () => void;
  onSubmit: () => void;
}>;

type BoatExtraTab = 'generales' | 'dimensions' | 'motorisation' | 'equipements' | 'assurance';

type ExtraInfoPanelProps = Readonly<{
  tab: BoatExtraTab;
  setTab: (t: BoatExtraTab) => void;
  boatName: string;
  setBoatName: (v: string) => void;
  brand: string;
  setBrand: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  extra: BoatDetails;
  setExtra: React.Dispatch<React.SetStateAction<BoatDetails>>;
}>;

const EQUIPMENT_GROUPS: { key: string; title: string; items: { id: string; label: string }[] }[] = [
  {
    key: 'mouillage',
    title: 'Mouillage',
    items: [
      { id: 'mouillage_annexe', label: 'Annexe' },
      { id: 'mouillage_ancre', label: 'Ancre' },
      { id: 'mouillage_guindeau', label: 'Guindeau' },
    ],
  },
  {
    key: 'armement',
    title: 'Armement',
    items: [
      { id: 'armement_basique', label: 'Basique' },
      { id: 'armement_fluvial', label: 'Fluvial' },
      { id: 'armement_hauturier', label: 'Hauturier' },
      { id: 'armement_semi_hauturier', label: 'Semi-hauturier' },
      { id: 'armement_cotier', label: 'Côtier' },
    ],
  },
  {
    key: 'securite',
    title: 'Sécurité',
    items: [
      { id: 'securite_pompe_cale', label: 'Pompe de cale' },
      { id: 'securite_vhf', label: 'VHF' },
      { id: 'securite_filet', label: 'Filet de sécurité' },
      { id: 'securite_harnais', label: 'Harnais de sécurité' },
    ],
  },
  {
    key: 'navigation',
    title: 'Navigation',
    items: [
      { id: 'nav_propulseur_etrave', label: "Propulseur d’étrave" },
      { id: 'nav_propulseur_poupe', label: 'Propulseur de poupe' },
      { id: 'nav_gps', label: 'GPS' },
      { id: 'nav_traceur', label: 'Traceur' },
      { id: 'nav_loch', label: 'Loch' },
      { id: 'nav_sondeur', label: 'Sondeur' },
      { id: 'nav_anemometre', label: 'Anémomètre' },
      { id: 'nav_pilote_auto', label: 'Pilote Automatique' },
      { id: 'nav_ordinateur_bord', label: 'Ordinateur de bord' },
      { id: 'nav_forward_scan', label: 'Forward Scan' },
      { id: 'nav_radar', label: 'Radar' },
      { id: 'nav_detecteur_radar', label: 'Détecteur de radar' },
      { id: 'nav_compteur_heures', label: 'Compteur heures moteur' },
      { id: 'nav_compteur_conso', label: 'Compteur de consommation digital' },
      { id: 'nav_feux', label: 'Feux de navigation' },
      { id: 'nav_ais', label: 'AIS' },
      { id: 'nav_winch_elec', label: 'Winch électrique' },
      { id: 'nav_speedometre', label: 'Speedomètre' },
      { id: 'nav_compas', label: 'Compas' },
      { id: 'nav_flaps', label: 'Flaps / Stabilisateurs' },
    ],
  },
  {
    key: 'eau_sanitaires',
    title: 'Eau & sanitaires',
    items: [
      { id: 'eau_reservoir_douce', label: "Réservoir d'eau douce" },
      { id: 'eau_eau_chaude', label: 'Eau chaude' },
      { id: 'eau_noires', label: 'Réservoir à eaux noires' },
      { id: 'eau_grises', label: 'Réservoir à eaux grises' },
      { id: 'eau_lave_linge', label: 'Lave-linge' },
      { id: 'eau_seche_linge', label: 'Sèche-linge' },
      { id: 'eau_dessal', label: 'Déssalinisateur' },
    ],
  },
  {
    key: 'divertissement',
    title: 'Divertissement',
    items: [
      { id: 'div_tv', label: 'Télévision' },
      { id: 'div_radio', label: 'Radio / CD / MP3' },
      { id: 'div_bt', label: 'Connexion Bluetooth' },
      { id: 'div_hp_int', label: 'Haut-parleurs intérieurs' },
      { id: 'div_lecteur_mp3', label: 'Lecteur mp3' },
      { id: 'div_dvd', label: 'Lecteur DVD' },
    ],
  },
  {
    key: 'electricite',
    title: 'Électricité',
    items: [
      { id: 'elec_batteries', label: 'Batteries' },
      { id: 'elec_chargeur', label: 'Chargeur de batteries' },
      { id: 'elec_wifi', label: 'Wifi et internet' },
      { id: 'elec_prise_220', label: 'Prise 220V' },
      { id: 'elec_usb', label: 'Prise USB' },
      { id: 'elec_panneau_solaire', label: 'Panneau solaire' },
      { id: 'elec_eolienne', label: 'Eolienne' },
      { id: 'elec_groupe', label: 'Groupe électrogène' },
    ],
  },
  {
    key: 'pont',
    title: 'Équipement de pont',
    items: [
      { id: 'pont_table_cockpit', label: 'Table de cockpit' },
      { id: 'pont_douche', label: 'Douche de pont' },
      { id: 'pont_plateforme_bain', label: 'Plateforme de bain' },
      { id: 'pont_enceintes_ext', label: 'Enceintes extérieures' },
      { id: 'pont_taud', label: 'Taud de soleil' },
      { id: 'pont_bimini', label: 'Bimini' },
      { id: 'pont_toit_ouvrant_elec', label: 'Toit ouvrant électrique' },
      { id: 'pont_capote_roof', label: 'Capote de roof' },
      { id: 'pont_cockpit_teck', label: 'Cockpit en teck' },
      { id: 'pont_pont_teck', label: 'Pont en teck' },
      { id: 'pont_coffre_rangement', label: 'Coffre de rangement' },
      { id: 'pont_echelle_bain', label: 'Échelle de bain' },
      { id: 'pont_leaning_post', label: 'Leaning Post' },
      { id: 'pont_siege_pilote', label: 'Siège Pilote' },
      { id: 'pont_siege_jockey', label: 'Siège Jockey' },
      { id: 'pont_carre_convertible', label: 'Carré convertible' },
      { id: 'pont_flybridge', label: 'Flybridge' },
      { id: 'pont_passerelle', label: 'Passerelle' },
      { id: 'pont_frigo_ext', label: 'Réfrigérateur extérieur' },
      { id: 'pont_coussins', label: 'Coussins' },
      { id: 'pont_coussins_bain_avant', label: 'Coussins bain de soleil avant' },
      { id: 'pont_coussins_bain_arriere', label: 'Coussins bain de soleil arrière' },
      { id: 'pont_coussins_bain_central', label: 'Coussins bain de soleil central' },
    ],
  },
  {
    key: 'accessibilite',
    title: 'Accessibilité',
    items: [
      { id: 'acc_parking_gratuit', label: 'Parking gratuit hors ligne' },
      { id: 'acc_parking_payant', label: 'Parking payant hors ligne' },
      { id: 'acc_handicap', label: 'Accessibilité Handicapé' },
    ],
  },
  {
    key: 'cuisine',
    title: 'Cuisine',
    items: [
      { id: 'cuisine_evier', label: 'Évier' },
      { id: 'cuisine_rechaud_mobile', label: 'Réchaud mobile' },
      { id: 'cuisine_glaciere', label: 'Glacière' },
      { id: 'cuisine_table', label: 'Table' },
      { id: 'cuisine_plancha', label: 'Plancha' },
      { id: 'cuisine_barbecue', label: 'Barbecue' },
      { id: 'cuisine_frigo', label: 'Réfrigérateur' },
      { id: 'cuisine_cafetiere', label: 'Cafetière' },
      { id: 'cuisine_machine_glacons', label: 'Machine à glaçons' },
      { id: 'cuisine_cuisiniere', label: 'Cuisinière' },
      { id: 'cuisine_four', label: 'Four' },
      { id: 'cuisine_micro_ondes', label: 'Micro-Ondes' },
      { id: 'cuisine_plaques', label: 'Plaques de cuisson' },
      { id: 'cuisine_congelateur', label: 'Congélateur' },
      { id: 'cuisine_lave_vaisselle', label: 'Lave-vaisselle' },
    ],
  },
  {
    key: 'confort',
    title: 'Confort',
    items: [
      { id: 'confort_draps', label: 'Draps' },
      { id: 'confort_clim', label: 'Climatiseur' },
      { id: 'confort_ventilateurs', label: 'Ventilateurs' },
      { id: 'confort_chauffage', label: 'Chauffage' },
      { id: 'confort_serviettes', label: 'Serviettes' },
      { id: 'confort_couvertures', label: 'Couverture(s)' },
    ],
  },
  {
    key: 'loisirs',
    title: 'Loisirs et sports nautiques',
    items: [
      { id: 'loi_rollbar', label: 'Rollbar' },
      { id: 'loi_sup', label: 'Stand-up paddle' },
      { id: 'loi_kayak', label: 'Canoe ou kayak' },
      { id: 'loi_jetski', label: 'Jet-ski' },
      { id: 'loi_sports', label: 'Équipement de sports nautiques' },
      { id: 'loi_wakeboard', label: 'Wakeboard' },
      { id: 'loi_bouee', label: 'Bouée tractée' },
      { id: 'loi_skis', label: 'Skis nautiques' },
      { id: 'loi_turbo_swing', label: 'Turbo Swing' },
      { id: 'loi_tour_wake', label: 'Tour de wake' },
      { id: 'loi_mat_ski', label: 'Mât de ski' },
      { id: 'loi_plongee', label: 'Équipement de plongée / snorkeling' },
      { id: 'loi_rack_bouteille', label: 'Rack à bouteille de plongée' },
      { id: 'loi_echelle_perroquet', label: 'Echelle perroquet' },
      { id: 'loi_snorkeling', label: 'Matériel de snorkeling' },
      { id: 'loi_peche', label: 'Équipement de pêche' },
    ],
  },
];

function windlassLabel(t: WindlassType): string {
  if (t === 'electrique') return 'Électrique';
  if (t === 'hydraulique') return 'Hydraulique';
  if (t === 'manuel') return 'Manuel';
  return '';
}

function boatExtraDetailRows(boat: Boat): { label: string; value: string }[] {
  const d = boat.details;
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | undefined) => {
    const v = (value ?? '').trim();
    if (v) rows.push({ label, value: v });
  };
  push('Immatriculation', d.generales.registrationNumber);
  push('Zone de navigation', d.generales.authorizedNavigationZone);
  push('Année de construction', d.generales.constructionYear);
  push('Année de rénovation', d.generales.renovationYear);
  if (d.dimensions.longueur) push('Longueur', `${d.dimensions.longueur} m`);
  if (d.dimensions.largeur) push('Largeur', `${d.dimensions.largeur} m`);
  if (d.dimensions.tirantEau) push('Tirant d’eau', `${d.dimensions.tirantEau} m`);
  const m = d.motorisation;
  if (m.engineCount || m.manufacturer || m.engineModel) {
    const parts = [m.engineCount ? `${m.engineCount} moteur(s)` : '', m.manufacturer, m.engineModel].filter(Boolean);
    push('Motorisation', parts.join(' · '));
  }
  push('Puissance totale', m.totalPowerCv ? `${m.totalPowerCv} CV` : '');
  push('Consommation', m.consumptionLh ? `${m.consumptionLh} L/h` : '');
  const equipped = EQUIPMENT_GROUPS.flatMap((g) => g.items)
    .filter((it) => d.equipements.selected[it.id])
    .map((it) => it.label);
  if (equipped.length) rows.push({ label: 'Équipements', value: equipped.join(', ') });
  push('Eau douce', d.equipements.waterCapacityL ? `${d.equipements.waterCapacityL} L` : '');
  push('Batteries', d.equipements.batteryCount);
  push('Guindeau', windlassLabel(d.equipements.windlassType));
  push('Assureur', d.assurance.assureurActuel);
  push('N° contrat', d.assurance.numeroContrat);
  push('Franchise', d.assurance.montantFranchise);
  push('Valeur assurée', d.assurance.valeurAssuree);
  if (d.assurance.locationCouverte) rows.push({ label: 'Assurance', value: 'Location couverte' });
  return rows;
}

function EquipmentChecklist(props: Readonly<{
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  waterCapacityL: string;
  setWaterCapacityL: (v: string) => void;
  batteryCount: string;
  setBatteryCount: (v: string) => void;
  windlassType: WindlassType;
  setWindlassType: (v: WindlassType) => void;
}>) {
  const { selected, onToggle, waterCapacityL, setWaterCapacityL, batteryCount, setBatteryCount, windlassType, setWindlassType } = props;
  return (
    <div className="mt-4 space-y-4">
      {EQUIPMENT_GROUPS.map((g) => (
        <div key={g.key} className="px-3 py-3 rounded-2xl bg-zinc-50">
          <p className="text-xs font-semibold tracking-wide uppercase text-zinc-600">{g.title}</p>
          <div className="grid grid-cols-1 gap-2 mt-3 sm:grid-cols-2">
            {g.items.map((it) => (
              <label key={it.id} className="flex gap-3 items-center px-3 py-2 bg-white rounded-2xl border shadow-sm border-zinc-200/80">
                <span className="inline-flex relative justify-center items-center w-5 h-5 shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[it.id])}
                    onChange={() => onToggle(it.id)}
                    className="sr-only peer"
                  />
                  <span className="h-5 w-5 rounded-full border border-zinc-300 bg-white shadow-sm transition-colors peer-checked:border-[#416B9F] peer-checked:bg-[#416B9F]" />
                  <span className="pointer-events-none absolute text-[12px] font-black leading-none text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    ✓
                  </span>
                </span>
                <span className="text-sm font-semibold text-zinc-800">{it.label}</span>
              </label>
            ))}
          </div>

          {g.key === 'mouillage' && selected['mouillage_guindeau'] ? (
            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Type de guindeau</FieldLabel>
                <select value={windlassType} onChange={(e) => setWindlassType(e.target.value as any)} className={inputBase()}>
                  <option value="">—</option>
                  <option value="electrique">Électrique</option>
                  <option value="hydraulique">Hydraulique</option>
                  <option value="manuel">Manuel</option>
                </select>
              </label>
            </div>
          ) : null}

          {g.key === 'eau_sanitaires' ? (
            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Capacité eau douce (L)</FieldLabel>
                <input
                  value={waterCapacityL}
                  onChange={(e) => setWaterCapacityL(e.target.value)}
                  className={inputBase()}
                  inputMode="numeric"
                  placeholder="Ex: 100"
                />
              </label>
            </div>
          ) : null}

          {g.key === 'electricite' ? (
            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Nombre de batteries</FieldLabel>
                <input
                  value={batteryCount}
                  onChange={(e) => setBatteryCount(e.target.value)}
                  className={inputBase()}
                  inputMode="numeric"
                  placeholder="Ex: 4"
                />
              </label>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ExtraInfoPanel(props: ExtraInfoPanelProps) {
  const { tab, setTab, boatName, setBoatName, brand, setBrand, model, setModel, extra, setExtra } = props;
  return (
    <div className="p-4 bg-white rounded-2xl border shadow-sm border-zinc-200/90">
      <p className="text-xs font-semibold tracking-wide uppercase text-zinc-500">Informations supplémentaires</p>
      <p className="mt-1 text-xs text-zinc-400">
        Ces champs sont liés au bateau sélectionné et enregistrés en base lors de l’enregistrement.
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {[
          { k: 'generales', label: 'Info générales' },
          { k: 'dimensions', label: 'Dimensions' },
          { k: 'motorisation', label: 'Motorisation' },
          { k: 'equipements', label: 'Équipements' },
          { k: 'assurance', label: 'Assurance' },
        ].map((t) => {
          const active = tab === (t.k as BoatExtraTab);
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k as BoatExtraTab)}
              className={[
                'rounded-2xl px-3 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/20'
                  : 'border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50',
              ].join(' ')}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'generales' ? (
        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Nom du bateau</FieldLabel>
            <input
              value={boatName}
              onChange={(e) => setBoatName(e.target.value)}
              className={inputBase()}
              placeholder="Ex: Bleu Calanque I"
            />
          </label>
          <label className="block">
            <FieldLabel>N° d’immatriculation</FieldLabel>
            <input
              value={extra.generales.registrationNumber}
              onChange={(e) =>
                setExtra((p) => ({ ...p, generales: { ...p.generales, registrationNumber: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex. FR-1234567"
            />
          </label>
          <label className="block">
            <FieldLabel>Marque</FieldLabel>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputBase()} placeholder="Ex: Jeanneau" />
          </label>
          <label className="block">
            <FieldLabel>Modèle</FieldLabel>
            <input value={model} onChange={(e) => setModel(e.target.value)} className={inputBase()} placeholder="Ex: Sun Odyssey 37" />
          </label>
          <label className="block">
            <FieldLabel>Année de construction</FieldLabel>
            <input
              value={extra.generales.constructionYear}
              onChange={(e) =>
                setExtra((p) => ({ ...p, generales: { ...p.generales, constructionYear: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 2016"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Année de rénovation</FieldLabel>
            <input
              value={extra.generales.renovationYear}
              onChange={(e) =>
                setExtra((p) => ({ ...p, generales: { ...p.generales, renovationYear: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 2023"
              inputMode="numeric"
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Zone de navigation autorisée</FieldLabel>
            <input
              value={extra.generales.authorizedNavigationZone}
              onChange={(e) =>
                setExtra((p) => ({
                  ...p,
                  generales: { ...p.generales, authorizedNavigationZone: e.target.value },
                }))
              }
              className={inputBase()}
              placeholder="Ex. Côtier 6 milles, fluvial, semi-hauturier…"
            />
          </label>
        </div>
      ) : null}

      {tab === 'dimensions' ? (
        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-3">
          <label className="block">
            <FieldLabel>Longueur (m)</FieldLabel>
            <input
              value={extra.dimensions.longueur}
              onChange={(e) => setExtra((p) => ({ ...p, dimensions: { ...p.dimensions, longueur: e.target.value } }))}
              className={inputBase()}
              placeholder="Ex: 11.2"
            />
          </label>
          <label className="block">
            <FieldLabel>Largeur (m)</FieldLabel>
            <input
              value={extra.dimensions.largeur}
              onChange={(e) => setExtra((p) => ({ ...p, dimensions: { ...p.dimensions, largeur: e.target.value } }))}
              className={inputBase()}
              placeholder="Ex: 3.7"
            />
          </label>
          <label className="block">
            <FieldLabel>Tirant d’eau (m)</FieldLabel>
            <input
              value={extra.dimensions.tirantEau}
              onChange={(e) => setExtra((p) => ({ ...p, dimensions: { ...p.dimensions, tirantEau: e.target.value } }))}
              className={inputBase()}
              placeholder="Ex: 1.9"
            />
          </label>
        </div>
      ) : null}

      {tab === 'motorisation' ? (
        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Nombre de moteurs</FieldLabel>
            <input
              value={extra.motorisation.engineCount}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, engineCount: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 1"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Type de carburant</FieldLabel>
            <input
              value={extra.motorisation.fuelType}
              onChange={(e) => setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, fuelType: e.target.value } }))}
              className={inputBase()}
              placeholder="Ex: diesel"
            />
          </label>
          <label className="block">
            <FieldLabel>Inboard / Hors-board</FieldLabel>
            <select
              value={extra.motorisation.drivetrain}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, drivetrain: e.target.value as any } }))
              }
              className={inputBase()}
            >
              <option value="">—</option>
              <option value="inboard">Inboard</option>
              <option value="hors-board">Hors-board</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Année d’achat des moteurs</FieldLabel>
            <input
              value={extra.motorisation.enginePurchaseYear}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, enginePurchaseYear: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 2020"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Constructeur</FieldLabel>
            <input
              value={extra.motorisation.manufacturer}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, manufacturer: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: Yamaha"
            />
          </label>
          <label className="block">
            <FieldLabel>Modèle</FieldLabel>
            <input
              value={extra.motorisation.engineModel}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, engineModel: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: F300"
            />
          </label>
          <label className="block">
            <FieldLabel>Puissance totale (CV)</FieldLabel>
            <input
              value={extra.motorisation.totalPowerCv}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, totalPowerCv: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 300"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Consommation (L/h)</FieldLabel>
            <input
              value={extra.motorisation.consumptionLh}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, consumptionLh: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 28"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Capacité (L)</FieldLabel>
            <input
              value={extra.motorisation.capacityL}
              onChange={(e) =>
                setExtra((p) => ({ ...p, motorisation: { ...p.motorisation, capacityL: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 200"
              inputMode="numeric"
            />
          </label>
        </div>
      ) : null}

      {tab === 'equipements' ? (
        <EquipmentChecklist
          selected={extra.equipements.selected}
          onToggle={(id) =>
            setExtra((p) => ({
              ...p,
              equipements: { ...p.equipements, selected: { ...p.equipements.selected, [id]: !p.equipements.selected[id] } },
            }))
          }
          waterCapacityL={extra.equipements.waterCapacityL}
          setWaterCapacityL={(v) => setExtra((p) => ({ ...p, equipements: { ...p.equipements, waterCapacityL: v } }))}
          batteryCount={extra.equipements.batteryCount}
          setBatteryCount={(v) => setExtra((p) => ({ ...p, equipements: { ...p.equipements, batteryCount: v } }))}
          windlassType={extra.equipements.windlassType}
          setWindlassType={(v) => setExtra((p) => ({ ...p, equipements: { ...p.equipements, windlassType: v } }))}
        />
      ) : null}

      {tab === 'assurance' ? (
        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Assureur actuel</FieldLabel>
            <input
              value={extra.assurance.assureurActuel}
              onChange={(e) =>
                setExtra((p) => ({ ...p, assurance: { ...p.assurance, assureurActuel: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: AXA"
            />
          </label>
          <label className="block">
            <FieldLabel>Numéro du contrat</FieldLabel>
            <input
              value={extra.assurance.numeroContrat}
              onChange={(e) =>
                setExtra((p) => ({ ...p, assurance: { ...p.assurance, numeroContrat: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: POL-12345"
            />
          </label>
          <label className="block">
            <FieldLabel>Montant de la franchise</FieldLabel>
            <input
              value={extra.assurance.montantFranchise}
              onChange={(e) =>
                setExtra((p) => ({ ...p, assurance: { ...p.assurance, montantFranchise: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 1500"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Valeur assurée du bateau</FieldLabel>
            <input
              value={extra.assurance.valeurAssuree}
              onChange={(e) =>
                setExtra((p) => ({ ...p, assurance: { ...p.assurance, valeurAssuree: e.target.value } }))
              }
              className={inputBase()}
              placeholder="Ex: 120000"
              inputMode="numeric"
            />
          </label>
          <label className="flex gap-3 items-center px-3 py-3 bg-white rounded-2xl border shadow-sm border-zinc-200/80 sm:col-span-2">
            <span className="inline-flex relative justify-center items-center w-5 h-5 shrink-0">
              <input
                type="checkbox"
                checked={Boolean(extra.assurance.locationCouverte)}
                onChange={() =>
                  setExtra((p) => ({
                    ...p,
                    assurance: { ...p.assurance, locationCouverte: !p.assurance.locationCouverte },
                  }))
                }
                className="sr-only peer"
              />
              <span className="h-5 w-5 rounded-full border border-zinc-300 bg-white shadow-sm transition-colors peer-checked:border-[#416B9F] peer-checked:bg-[#416B9F]" />
              <span className="pointer-events-none absolute text-[12px] font-black leading-none text-white opacity-0 transition-opacity peer-checked:opacity-100">
                ✓
              </span>
            </span>
            <span className="text-sm font-semibold text-zinc-800">Je suis assuré pour l’activité de location</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function BoatEditorModal(props: BoatEditorModalProps) {
  const {
    present,
    phase,
    editingBoatId,
    fleets,
    owners,
    error,
    brand,
    setBrand,
    name,
    setName,
    model,
    setModel,
    boatType,
    setBoatType,
    maxPassengers,
    setMaxPassengers,
    depositEuros,
    setDepositEuros,
    ownerId,
    setOwnerId,
    fleetId,
    setFleetId,
    presentationPhotos,
    setPresentationPhotos,
    extra,
    setExtra,
    onClose,
    onSubmit,
  } = props;

  const [showExtra, setShowExtra] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [extraTab, setExtraTab] = useState<BoatExtraTab>('generales');

  if (!present) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className={['absolute inset-0 bg-black/30 bc-animate', phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit'].join(' ')}
          aria-label="Fermer"
          onClick={onClose}
        />
        <div
          className={[
            'absolute right-0 top-0 h-full w-full max-w-xl overflow-auto bg-white shadow-2xl bc-animate',
            phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
          ].join(' ')}
        >
          <div className="flex sticky top-0 z-10 gap-4 justify-between items-center px-6 py-5 border-b backdrop-blur border-zinc-200/80 bg-white/90">
            <div>
              <p className="text-lg font-bold tracking-tight text-zinc-900">
                {editingBoatId ? 'Modifier le bateau' : 'Ajouter un bateau'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {editingBoatId ? 'Modifie les informations principales du bateau.' : 'Renseigne les informations principales du bateau.'}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setShowExtra((v) => !v)}
                className="px-3 py-2 text-sm font-semibold bg-white rounded-2xl border shadow-sm transition-colors border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
              >
                Voir plus
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex justify-center items-center w-10 h-10 bg-white rounded-2xl border shadow-sm border-zinc-200/90 text-zinc-600 hover:bg-zinc-50"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" strokeWidth={1.9} aria-hidden />
              </button>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            {error ? (
              <p className="px-4 py-3 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl border border-red-200">{error}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Marque</FieldLabel>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputBase()} placeholder="Ex: Jeanneau" />
              </label>
              <label className="block">
                <FieldLabel>Nom du bateau</FieldLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputBase()} placeholder="Ex: Bleu Calanque I" />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>Modèle</FieldLabel>
                <input value={model} onChange={(e) => setModel(e.target.value)} className={inputBase()} placeholder="Ex: Sun Odyssey 37" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Type d’embarcation</FieldLabel>
                <select value={boatType} onChange={(e) => setBoatType(e.target.value as BoatType)} className={inputBase()}>
                  {BOAT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <FieldLabel>Passagers max</FieldLabel>
                <input
                  value={maxPassengers}
                  onChange={(e) => setMaxPassengers(e.target.value)}
                  className={inputBase()}
                  inputMode="numeric"
                  placeholder="Ex: 8"
                />
              </label>

              <label className="block">
                <FieldLabel>Caution (€)</FieldLabel>
                <input
                  value={depositEuros}
                  onChange={(e) => setDepositEuros(e.target.value)}
                  className={inputBase()}
                  inputMode="decimal"
                  placeholder="2500"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Flotille (catégorie)</FieldLabel>
                <select value={fleetId} onChange={(e) => setFleetId(e.target.value)} className={inputBase()}>
                  <option value="">Sans flotille</option>
                  {fleets.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <FieldLabel>Propriétaire</FieldLabel>
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputBase()}>
                  <option value="">Sans propriétaire</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">
                    Si le propriétaire n’existe pas encore dans <span className="font-semibold text-zinc-700">Membres</span>, ajoute-le d’abord.
                  </p>
                  <a
                    href={`/clients?${new URLSearchParams({ create: '1', role: 'proprietaire', ownerSince: new Date().toISOString().slice(0, 10) }).toString()}`}
                    className="text-xs font-semibold text-[#416B9F] hover:underline"
                  >
                    Ajouter un propriétaire
                  </a>
                </div>
              </label>
            </div>

            <PresentationPhotosField
              photos={presentationPhotos}
              setPhotos={setPresentationPhotos}
              photoError={photoError}
              setPhotoError={setPhotoError}
            />
            {showExtra ? (
              <ExtraInfoPanel
                tab={extraTab}
                setTab={setExtraTab}
                boatName={name}
                setBoatName={setName}
                brand={brand}
                setBrand={setBrand}
                model={model}
                setModel={setModel}
                extra={extra}
                setExtra={setExtra}
              />
            ) : null}

            <div className="flex gap-3 justify-end items-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-sm font-semibold bg-white rounded-2xl border shadow-sm transition-colors border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 transition-colors hover:bg-[#365b87]"
              >
                {editingBoatId ? 'Enregistrer' : 'Ajouter le bateau'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

type FleetEditorModalProps = Readonly<{
  present: boolean;
  phase: 'enter' | 'exit';
  editingFleetId: string | null;
  fleetEditName: string;
  setFleetEditName: (v: string) => void;
  boats: BoatsPageViewProps['boats'];
  error: string;
  onRemoveBoat: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}>;

function FleetEditorModal(props: FleetEditorModalProps) {
  const { present, phase, editingFleetId, fleetEditName, setFleetEditName, boats, error, onRemoveBoat, onClose, onSubmit } = props;
  if (!present) return null;

  const associated = editingFleetId ? boats.filter((b) => b.fleetId === editingFleetId) : [];
  const visible = associated.slice(0, 6);

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className={['absolute inset-0 bg-black/30 bc-animate', phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit'].join(' ')}
          aria-label="Fermer"
          onClick={onClose}
        />
        <div
          className={[
            'absolute right-0 top-0 h-full w-full max-w-md overflow-auto bg-white shadow-2xl bc-animate',
            phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
          ].join(' ')}
        >
          <div className="flex sticky top-0 z-10 gap-4 justify-between items-center px-6 py-5 border-b backdrop-blur border-zinc-200/80 bg-white/90">
            <div>
              <p className="text-lg font-bold tracking-tight text-zinc-900">Modifier la flotille</p>
              <p className="mt-1 text-sm text-zinc-500">Renomme la catégorie et garde tes bateaux associés.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex justify-center items-center w-10 h-10 bg-white rounded-2xl border shadow-sm border-zinc-200/90 text-zinc-600 hover:bg-zinc-50"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" strokeWidth={1.9} aria-hidden />
            </button>
          </div>

          <div className="px-6 py-6 space-y-5">
            {error ? (
              <p className="px-4 py-3 text-sm font-semibold text-red-700 bg-red-50 rounded-2xl border border-red-200">{error}</p>
            ) : null}

            <label className="block">
              <FieldLabel>Nom de la flotille</FieldLabel>
              <input value={fleetEditName} onChange={(e) => setFleetEditName(e.target.value)} className={inputBase()} />
            </label>

            <div className="p-4 bg-white rounded-2xl border shadow-sm border-zinc-200/90">
              <p className="text-xs font-semibold tracking-wide uppercase text-zinc-500">Bateaux associés</p>
              <div className="mt-2 space-y-1">
                {visible.map((b) => (
                  <div key={b.id} className="flex gap-2 justify-between items-center">
                    <p className="min-w-0 text-sm font-semibold truncate text-zinc-800">
                      {b.name}{' '}
                      <span className="text-xs font-medium text-zinc-500">
                        · {b.brand} {b.model}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => onRemoveBoat(b.id)}
                      className="flex justify-center items-center w-8 h-8 rounded-2xl shrink-0 text-zinc-500 hover:bg-red-50 hover:text-red-700"
                      aria-label="Supprimer le bateau"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.9} aria-hidden />
                    </button>
                  </div>
                ))}
                {associated.length > 6 ? <p className="text-xs font-semibold text-zinc-400">+{associated.length - 6} autre(s)</p> : null}
                {associated.length === 0 ? <p className="text-sm text-zinc-500">Aucun bateau dans cette flotille.</p> : null}
              </div>
            </div>

            <div className="flex gap-3 justify-end items-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-sm font-semibold bg-white rounded-2xl border shadow-sm transition-colors border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 transition-colors hover:bg-[#365b87]"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function BoatsPageView(props: BoatsPageViewProps) {
  const {
    owners,
    fleets,
    search,
    setSearch,
    selectedFleetId,
    onSelectFleet,
    searchMatchCount,
    boatsByFleetSidebar,
    boats,
    catalogBoats,
    fleetNameById,
    fleetName,
    setFleetName,
    addFleet,
    selectedBoatId,
    onSelectBoat,
    openForm,
    openEditBoat,
    removeBoat,
    openEditFleet,
    removeFleet,
    formPresence,
    fleetEditPresence,
    closeForm,
    closeEditFleet,
    saveFleetEdit,
    editingBoatId,
    brand,
    setBrand,
    name,
    setName,
    model,
    setModel,
    boatType,
    setBoatType,
    maxPassengers,
    setMaxPassengers,
    depositEuros,
    setDepositEuros,
    ownerId,
    setOwnerId,
    fleetId,
    setFleetId,
    presentationPhotos,
    setPresentationPhotos,
    extra,
    setExtra,
    submitBoat,
    editingFleetId,
    fleetEditName,
    setFleetEditName,
    error,
    success,
  } = props;

  const ownerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of owners) m.set(o.id, o.label);
    return m;
  }, [owners]);

  const selectedBoat = useMemo(
    () => (selectedBoatId ? boats.find((b) => b.id === selectedBoatId) ?? null : null),
    [boats, selectedBoatId],
  );

  const stats = useMemo(
    () => ({
      total: catalogBoats.length,
      fleets: fleets.length,
      withOwner: catalogBoats.filter((b) => b.ownerId).length,
    }),
    [catalogBoats, fleets.length],
  );

  const sortedBoats = useMemo(
    () => [...boats].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [boats],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Bateaux</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
          Catalogue des embarcations, flotilles et fiches techniques — utilisés sur le calendrier et les réservations.
        </p>
      </div>

      <ThreeStepGuide
        guideKey="boats"
        title="Configurer un bateau en 3 étapes"
        steps={[
          <>Créez ou choisissez une <strong className="font-semibold text-zinc-800">flotille</strong> pour organiser le catalogue.</>,
          <>Ajoutez le bateau : marque, modèle, type, passagers, caution et photos de présentation.</>,
          <>Complétez via <strong className="font-semibold text-zinc-800">Modifier → Voir plus</strong> : dimensions, équipements et assurance.</>,
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
          <span className="font-semibold text-zinc-900">{stats.total}</span> bateau{stats.total !== 1 ? 'x' : ''}
        </span>
        <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
          <span className="font-semibold text-zinc-800">{stats.fleets}</span> flotille{stats.fleets !== 1 ? 's' : ''}
        </span>
        <span className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
          <span className="font-semibold text-emerald-800">{stats.withOwner}</span> avec propriétaire
        </span>
        <button
          type="button"
          onClick={openForm}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
        >
          <Plus className="h-4 w-4" />
          Nouveau bateau
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <FleetsPanel
            fleets={fleets}
            boatsByFleet={boatsByFleetSidebar}
            selectedFleetId={selectedFleetId}
            onSelectFleet={onSelectFleet}
            searchMatchCount={searchMatchCount}
            fleetName={fleetName}
            setFleetName={setFleetName}
            addFleet={addFleet}
            openEditFleet={openEditFleet}
            removeFleet={removeFleet}
            error={error}
            success={success}
          />

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un bateau…"
              className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
            />
          </div>

          <div className="max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto pr-0.5">
            {sortedBoats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                {catalogBoats.length === 0
                  ? 'Aucun bateau. Créez le premier via le bouton ci-dessus.'
                  : 'Aucun résultat pour cette recherche ou flotille.'}
              </div>
            ) : (
              sortedBoats.map((b) => {
                const active = b.id === selectedBoatId;
                const fleetLabel = b.fleetId ? (fleetNameById.get(b.fleetId) ?? '—') : 'Sans flotille';
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBoat(b.id)}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                        : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    <BoatCoverAvatar url={coverPhotoUrl(b.presentationPhotos ?? [])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">{b.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {b.brand} · {b.model}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                        {boatTypeLabel(b.boatType)} · {fleetLabel}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {!selectedBoat ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
              <Ship className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-zinc-700">Aucun bateau sélectionné</p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">
                Choisissez un bateau dans la liste ou créez-en un nouveau.
              </p>
              <button
                type="button"
                onClick={openForm}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Ajouter un bateau
              </button>
            </div>
          ) : (
            <BoatDetailPanel
              boat={selectedBoat}
              fleetLabel={
                selectedBoat.fleetId ? (fleetNameById.get(selectedBoat.fleetId) ?? '—') : 'Sans flotille'
              }
              ownerLabel={
                selectedBoat.ownerId ? (ownerLabelById.get(selectedBoat.ownerId) ?? '—') : '—'
              }
              typeLabel={boatTypeLabel(selectedBoat.boatType)}
              extraRows={boatExtraDetailRows(selectedBoat)}
              onEdit={() => openEditBoat(selectedBoat.id)}
              onDelete={() => {
                const ok = globalThis.confirm(`Supprimer le bateau « ${selectedBoat.name} » ?`);
                if (!ok) return;
                removeBoat(selectedBoat.id);
                onSelectBoat(null);
              }}
            />
          )}
        </div>
      </div>

      <BoatEditorModal
        present={formPresence.present}
        phase={formPresence.phase}
        editingBoatId={editingBoatId}
        fleets={fleets}
        owners={owners}
        error={error}
        brand={brand}
        setBrand={setBrand}
        name={name}
        setName={setName}
        model={model}
        setModel={setModel}
        boatType={boatType}
        setBoatType={setBoatType}
        maxPassengers={maxPassengers}
        setMaxPassengers={setMaxPassengers}
        depositEuros={depositEuros}
        setDepositEuros={setDepositEuros}
        ownerId={ownerId}
        setOwnerId={setOwnerId}
        fleetId={fleetId}
        setFleetId={setFleetId}
        presentationPhotos={presentationPhotos}
        setPresentationPhotos={setPresentationPhotos}
        extra={extra}
        setExtra={setExtra}
        onClose={closeForm}
        onSubmit={submitBoat}
      />

      <FleetEditorModal
        present={fleetEditPresence.present}
        phase={fleetEditPresence.phase}
        editingFleetId={editingFleetId}
        fleetEditName={fleetEditName}
        setFleetEditName={setFleetEditName}
        boats={catalogBoats}
        error={error}
        onRemoveBoat={removeBoat}
        onClose={closeEditFleet}
        onSubmit={saveFleetEdit}
      />
    </div>
  );
}

export function BoatsPage() {
  const members = useMembersStore((s) => s.members);
  const owners = useMemo<{ id: string; label: string }[]>(() => {
    return members
      .filter((m) => m.role === 'proprietaire')
      .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}`.trim() || m.email }));
  }, [members]);

  const fleets = useBoatsStore((s) => s.fleets);
  const boats = useBoatsStore((s) => s.boats);
  const hydrated = useBoatsStore((s) => s.hydrated);
  const refresh = useBoatsStore((s) => s.refresh);
  const addFleetToStore = useBoatsStore((s) => s.addFleet);
  const updateFleetInStore = useBoatsStore((s) => s.updateFleet);
  const removeFleetFromStore = useBoatsStore((s) => s.removeFleet);
  const addBoatToStore = useBoatsStore((s) => s.addBoat);
  const updateBoatInStore = useBoatsStore((s) => s.updateBoat);
  const removeBoatFromStore = useBoatsStore((s) => s.removeBoat);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  const [showForm, setShowForm] = useState(false);
  const formPresence = usePresence(showForm, 180);
  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null);
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFleetId != null && !fleets.some((f) => f.id === selectedFleetId)) {
      setSelectedFleetId(null);
    }
  }, [fleets, selectedFleetId]);

  const [fleetName, setFleetName] = useState('');
  const [fleetEditOpen, setFleetEditOpen] = useState(false);
  const fleetEditPresence = usePresence(fleetEditOpen, 180);
  const [editingFleetId, setEditingFleetId] = useState<string | null>(null);
  const [fleetEditName, setFleetEditName] = useState('');

  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [boatType, setBoatType] = useState<BoatType>('voilier');
  const [maxPassengers, setMaxPassengers] = useState('8');
  const [ownerId, setOwnerId] = useState<string>('');
  const [fleetId, setFleetId] = useState<string>('');
  const [presentationPhotos, setPresentationPhotos] = useState<string[]>([]);
  const [extra, setExtra] = useState<BoatDetails>(() => defaultBoatDetails());
  const [depositEuros, setDepositEuros] = useState('2500');

  function resetForm() {
    setBrand('');
    setName('');
    setModel('');
    setBoatType('voilier');
    setMaxPassengers('8');
    setOwnerId('');
    setFleetId('');
    setPresentationPhotos([]);
    setExtra(defaultBoatDetails());
    setDepositEuros('2500');
  }

  function openForm() {
    setError('');
    setSuccess('');
    resetForm();
    setEditingBoatId(null);
    setShowForm(true);
  }

  function openEditBoat(id: string) {
    const b = boats.find((x) => x.id === id);
    if (!b) return;
    setError('');
    setSuccess('');
    setEditingBoatId(id);
    setBrand(b.brand);
    setName(b.name);
    setModel(b.model);
    setBoatType(b.boatType);
    setMaxPassengers(String(b.maxPassengers));
    setOwnerId(b.ownerId ?? '');
    setFleetId(b.fleetId ?? '');
    setPresentationPhotos(b.presentationPhotos ?? []);
    setExtra(b.details ?? defaultBoatDetails());
    setDepositEuros(String(b.depositEuros ?? 2500));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingBoatId(null);
  }

  function addFleet() {
    setError('');
    setSuccess('');
    const res = addFleetToStore(fleetName);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFleetName('');
    setSuccess('Flotille créée.');
  }

  function removeFleet(id: string) {
    removeFleetFromStore(id);
    if (fleetId === id) setFleetId('');
    if (selectedFleetId === id) setSelectedFleetId(null);
  }

  function addBoat() {
    setError('');
    setSuccess('');

    const b = brand.trim();
    const n = name.trim();
    const m = model.trim();
    const max = Number(maxPassengers);

    if (!b || !n || !m) {
      setError('Marque, nom du bateau et modèle sont requis.');
      return;
    }
    if (!Number.isFinite(max) || max < 1 || max > 200) {
      setError('Le nombre de passagers doit être un nombre entre 1 et 200.');
      return;
    }

    const payload = {
      brand: b,
      name: n,
      model: m,
      boatType,
      maxPassengers: max,
      ownerId: ownerId || null,
      fleetId: fleetId || null,
      presentationPhotos,
      details: extra,
      depositEuros: Number(depositEuros.replace(',', '.')) || 2500,
    };

    if (editingBoatId) {
      void (async () => {
        const res = await updateBoatInStore(editingBoatId, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSuccess('Bateau modifié.');
        setShowForm(false);
        setEditingBoatId(null);
      })();
      return;
    }

    const res = addBoatToStore(payload);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess('Bateau ajouté.');
    setShowForm(false);
    setEditingBoatId(null);
  }

  function removeBoat(id: string) {
    removeBoatFromStore(id);
  }

  function openEditFleet(id: string) {
    const f = fleets.find((x) => x.id === id);
    if (!f) return;
    setError('');
    setSuccess('');
    setEditingFleetId(id);
    setFleetEditName(f.name);
    setFleetEditOpen(true);
  }

  function closeEditFleet() {
    setFleetEditOpen(false);
    setEditingFleetId(null);
    setFleetEditName('');
  }

  function saveFleetEdit() {
    setError('');
    setSuccess('');
    if (!editingFleetId) return;
    const res = updateFleetInStore(editingFleetId, fleetEditName);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess('Flotille modifiée.');
    closeEditFleet();
  }

  const fleetNameFor = useMemo(() => new Map(fleets.map((f) => [f.id, f.name])), [fleets]);
  const ownerLabelFor = useMemo(() => new Map(owners.map((o) => [o.id, o.label])), [owners]);

  const searchFilteredBoats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boats;

    return boats.filter((b) => {
      const fleetName = b.fleetId ? (fleetNameFor.get(b.fleetId) ?? '') : '';
      const ownerLabel = b.ownerId ? (ownerLabelFor.get(b.ownerId) ?? b.ownerId) : '';
      return boatSearchHaystack(b, fleetName, ownerLabel).includes(q);
    });
  }, [boats, fleetNameFor, ownerLabelFor, search]);

  const searchMatchCount = searchFilteredBoats.length;

  const boatsByFleetSidebar = useMemo(() => {
    const map = new Map<string, typeof boats>();
    for (const b of searchFilteredBoats) {
      const k = b.fleetId ?? '__none__';
      const arr = map.get(k);
      if (arr) arr.push(b);
      else map.set(k, [b]);
    }
    return map;
  }, [searchFilteredBoats]);

  const displayBoats = useMemo(() => {
    if (!selectedFleetId) return searchFilteredBoats;
    return searchFilteredBoats.filter((b) => b.fleetId === selectedFleetId);
  }, [searchFilteredBoats, selectedFleetId]);

  const fleetNameById = fleetNameFor;

  useEffect(() => {
    if (displayBoats.length === 0) {
      setSelectedBoatId(null);
      return;
    }
    if (!selectedBoatId || !displayBoats.some((b) => b.id === selectedBoatId)) {
      setSelectedBoatId(displayBoats[0]?.id ?? null);
    }
  }, [displayBoats, selectedBoatId]);

  const boatsFiltersActiveCount = (search.trim() ? 1 : 0) + (selectedFleetId ? 1 : 0);

  const boatsFiltersPanel = useMemo(
    () => (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-600">
          La recherche et la sélection de flotille sont sur la page. Ce panneau permet de tout réinitialiser.
        </p>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setSelectedFleetId(null);
          }}
          className="w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          Réinitialiser recherche et flotille
        </button>
      </div>
    ),
    [setSearch, setSelectedFleetId],
  );

  usePageFiltersPanel(
    useMemo(
      () =>
        ({
          title: 'Bateaux',
          subtitle: 'Synchronisé avec les contrôles de la page.',
          activeFilterCount: boatsFiltersActiveCount,
          panelBody: boatsFiltersPanel,
        }) as PageFiltersConfig,
      [boatsFiltersActiveCount, boatsFiltersPanel],
    ),
  );

  return (
    <ContentReveal ready={hydrated} skeleton={<BoatsPageSkeleton />}>
    <BoatsPageView
      owners={owners}
      fleets={fleets}
      search={search}
      setSearch={setSearch}
      selectedFleetId={selectedFleetId}
      onSelectFleet={setSelectedFleetId}
      searchMatchCount={searchMatchCount}
      boatsByFleetSidebar={boatsByFleetSidebar}
      boats={displayBoats}
      catalogBoats={boats}
      fleetNameById={fleetNameById}
      selectedBoatId={selectedBoatId}
      onSelectBoat={setSelectedBoatId}
      fleetName={fleetName}
      setFleetName={setFleetName}
      addFleet={addFleet}
      openForm={openForm}
      openEditBoat={openEditBoat}
      removeBoat={removeBoat}
      openEditFleet={openEditFleet}
      removeFleet={removeFleet}
      formPresence={formPresence}
      fleetEditPresence={fleetEditPresence}
      closeForm={closeForm}
      closeEditFleet={closeEditFleet}
      saveFleetEdit={saveFleetEdit}
      editingBoatId={editingBoatId}
      brand={brand}
      setBrand={setBrand}
      name={name}
      setName={setName}
      model={model}
      setModel={setModel}
      boatType={boatType}
      setBoatType={setBoatType}
      maxPassengers={maxPassengers}
      setMaxPassengers={setMaxPassengers}
      depositEuros={depositEuros}
      setDepositEuros={setDepositEuros}
      ownerId={ownerId}
      setOwnerId={setOwnerId}
      fleetId={fleetId}
      setFleetId={setFleetId}
      presentationPhotos={presentationPhotos}
      setPresentationPhotos={setPresentationPhotos}
      extra={extra}
      setExtra={setExtra}
      submitBoat={addBoat}
      editingFleetId={editingFleetId}
      fleetEditName={fleetEditName}
      setFleetEditName={setFleetEditName}
      error={error}
      success={success}
    />
    </ContentReveal>
  );
}

