import type { CheckFlowGuideKind } from '@/lib/checkFlowPhotoGuide';

export type RibHighlightPart =
  | 'tubes'
  | 'bow'
  | 'stern'
  | 'console'
  | 'engine'
  | 'deck'
  | 'none';

export type RibCameraPreset = {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  highlight: RibHighlightPart;
  shotLabel: string;
  viewHint: string;
};

/** Caméras calibrées pour le modèle Quaternius (bow ≈ +Z, scale 3.6). */
export const RIB_CAMERA_PRESETS: Record<CheckFlowGuideKind, RibCameraPreset> = {
  'hull-side': {
    position: [4.8, 1.6, 0.15],
    lookAt: [0, 0.45, 0],
    fov: 34,
    highlight: 'tubes',
    shotLabel: 'Flanc',
    viewHint: 'Cadrez tout le côté du semi-rigide',
  },
  'bow-front': {
    position: [0.05, 1.35, 4.6],
    lookAt: [0, 0.5, 1.2],
    fov: 32,
    highlight: 'bow',
    shotLabel: 'Proue',
    viewHint: 'Vue de face sur l’avant',
  },
  'stern-rear': {
    position: [0.05, 1.45, -4.8],
    lookAt: [0, 0.5, -1.1],
    fov: 32,
    highlight: 'stern',
    shotLabel: 'Arrière',
    viewHint: 'Vue arrière complète',
  },
  cockpit: {
    position: [2.6, 2.2, -0.4],
    lookAt: [0, 0.75, -0.2],
    fov: 30,
    highlight: 'console',
    shotLabel: 'Cockpit',
    viewHint: 'Intérieur et poste de pilotage',
  },
  dashboard: {
    position: [1.35, 1.25, 0.05],
    lookAt: [0, 0.82, -0.25],
    fov: 26,
    highlight: 'console',
    shotLabel: 'Console',
    viewHint: 'Gros plan sur les instruments',
  },
  engine: {
    position: [0.15, 0.95, -4.2],
    lookAt: [0, 0.42, -1.55],
    fov: 28,
    highlight: 'engine',
    shotLabel: 'Moteur',
    viewHint: 'Moteur et embase visibles',
  },
  'fuel-gauge': {
    position: [1.05, 1.15, 0.25],
    lookAt: [0, 0.78, -0.2],
    fov: 24,
    highlight: 'console',
    shotLabel: 'Jauge',
    viewHint: 'Jauge essence lisible',
  },
  damage: {
    position: [3.8, 1.15, 0.55],
    lookAt: [0.4, 0.48, 0.35],
    fov: 30,
    highlight: 'tubes',
    shotLabel: 'Dommage',
    viewHint: 'Gros plan sur la zone touchée',
  },
  safety: {
    position: [3.1, 2.1, 0.7],
    lookAt: [0, 0.62, 0.1],
    fov: 34,
    highlight: 'deck',
    shotLabel: 'Sécurité',
    viewHint: 'Équipement visible sur le bateau',
  },
  'keys-docs': {
    position: [2.4, 2.6, 1.1],
    lookAt: [0, 0.65, 0],
    fov: 36,
    highlight: 'console',
    shotLabel: 'Documents',
    viewHint: 'Clés et papiers à plat',
  },
  registration: {
    position: [3.5, 0.9, -1.1],
    lookAt: [0, 0.45, -1.35],
    fov: 28,
    highlight: 'stern',
    shotLabel: 'Immatriculation',
    viewHint: 'Plaque ou numéro lisible',
  },
  trailer: {
    position: [4.2, 2.4, 2.4],
    lookAt: [0, 0.25, 0],
    fov: 38,
    highlight: 'none',
    shotLabel: 'Remorque',
    viewHint: 'Remorque et attelage',
  },
  'full-boat': {
    position: [4.8, 3.4, 4.2],
    lookAt: [0, 0.35, 0],
    fov: 36,
    highlight: 'none',
    shotLabel: 'Ensemble',
    viewHint: 'Bateau entier dans le cadre',
  },
  'boolean-check': {
    position: [4.2, 3, 3.6],
    lookAt: [0, 0.4, 0],
    fov: 38,
    highlight: 'none',
    shotLabel: 'Contrôle',
    viewHint: 'Vérifiez visuellement',
  },
  'text-note': {
    position: [4.2, 3, 3.6],
    lookAt: [0, 0.4, 0],
    fov: 38,
    highlight: 'none',
    shotLabel: 'Info',
    viewHint: 'Renseignez le champ',
  },
  'select-choice': {
    position: [4.2, 3, 3.6],
    lookAt: [0, 0.4, 0],
    fov: 38,
    highlight: 'none',
    shotLabel: 'Choix',
    viewHint: 'Sélectionnez l’option',
  },
  'generic-photo': {
    position: [4, 2.5, 3],
    lookAt: [0, 0.45, 0],
    fov: 36,
    highlight: 'deck',
    shotLabel: 'Photo',
    viewHint: 'Cadrez l’élément demandé',
  },
};
