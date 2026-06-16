import { createLucideIcon, type LucideIcon } from 'lucide-react';
import {
  Anchor,
  Binoculars,
  Compass,
  Droplets,
  Fish,
  Fuel,
  LifeBuoy,
  Package,
  Sailboat,
  Shell,
  Ship,
  ShipWheel,
  Sun,
  Umbrella,
  Waves,
} from 'lucide-react';
import { EXTRA_ICON_KEYS, resolveExtraIcon, type ExtraIconKey } from '@bleu-calanque/shared';

/** Bouée tractée (ski nautique / wake). */
const TowBuoy = createLucideIcon('TowBuoy', [
  ['circle', { cx: '12', cy: '14', r: '5', key: 'ring' }],
  ['path', { d: 'M12 9V5', key: 'rope' }],
  ['path', { d: 'M10 5h4', key: 'rope-knot' }],
]);

/** Planche de wakeboard. */
const Wakeboard = createLucideIcon('Wakeboard', [
  ['path', { d: 'M5 17c4-8 10-10 14-6s2 10-2 12-10 2-14-6', key: 'board' }],
  ['path', { d: 'M9 13h2', key: 'bind' }],
]);

/** Skis nautiques. */
const WaterSki = createLucideIcon('WaterSki', [
  ['path', { d: 'M7 19 11 5', key: 'ski-l' }],
  ['path', { d: 'M13 19 17 5', key: 'ski-r' }],
  ['path', { d: 'M10 9h4', key: 'bar' }],
]);

/** Scooter des mers. */
const SeaScooter = createLucideIcon('SeaScooter', [
  ['path', { d: 'M4 12a8 8 0 0 1 16 0', key: 'body' }],
  ['path', { d: 'M4 12v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2', key: 'hull' }],
  ['path', { d: 'M20 10v4', key: 'handle' }],
  ['path', { d: 'M22 11v2', key: 'grip' }],
  ['circle', { cx: '8', cy: '14', r: '1', key: 'jet' }],
]);

const ICON_MAP: Record<ExtraIconKey, LucideIcon> = {
  anchor: Anchor,
  lifebuoy: LifeBuoy,
  'tow-buoy': TowBuoy,
  waves: Waves,
  sailboat: Sailboat,
  ship: Ship,
  compass: Compass,
  skipper: ShipWheel,
  wakeboard: Wakeboard,
  'water-ski': WaterSki,
  'sea-scooter': SeaScooter,
  fish: Fish,
  shell: Shell,
  droplets: Droplets,
  fuel: Fuel,
  sun: Sun,
  umbrella: Umbrella,
  binoculars: Binoculars,
  package: Package,
};

export const EXTRA_ICON_LABELS: Record<ExtraIconKey, string> = {
  anchor: 'Ancre',
  lifebuoy: 'Bouée tractée',
  'tow-buoy': 'Bouée tractée',
  waves: 'Mer / vagues',
  sailboat: 'Wake Board',
  ship: 'Bateau',
  compass: 'Navigation',
  skipper: 'Skipper',
  wakeboard: 'Wakeboard',
  'water-ski': 'Ski nautique',
  'sea-scooter': 'Scooter des mers',
  fish: 'Sea scooter',
  shell: 'Plage / coquillage',
  droplets: 'Eau',
  fuel: 'Carburant',
  sun: 'Soleil',
  umbrella: 'Parasol',
  binoculars: 'Ski nautique',
  package: 'Extra générique',
};

/** Composant lucide associé à une clé d'icône d'extra. */
export function extraIconComponent(icon: string | null | undefined): LucideIcon {
  return ICON_MAP[resolveExtraIcon(icon)];
}

export const EXTRA_ICON_OPTIONS: { key: ExtraIconKey; label: string; Icon: LucideIcon }[] =
  EXTRA_ICON_KEYS.map((key) => ({
    key,
    label: EXTRA_ICON_LABELS[key],
    Icon: ICON_MAP[key],
  }));
