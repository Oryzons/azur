import type { CheckFlowQuestion, CheckQuestionType } from '@/stores/checkFlow';

export type CheckFlowGuideKind =
  | 'hull-side'
  | 'bow-front'
  | 'stern-rear'
  | 'cockpit'
  | 'dashboard'
  | 'engine'
  | 'fuel-gauge'
  | 'damage'
  | 'safety'
  | 'keys-docs'
  | 'registration'
  | 'trailer'
  | 'full-boat'
  | 'boolean-check'
  | 'text-note'
  | 'select-choice'
  | 'generic-photo';

export type CheckFlowGuide = {
  kind: CheckFlowGuideKind;
  title: string;
  tips: string[];
  cameraHint?: string;
};

const GUIDE_COPY: Record<CheckFlowGuideKind, Omit<CheckFlowGuide, 'kind'>> = {
  'hull-side': {
    title: 'Coque latérale',
    tips: [
      'Placez-vous perpendiculairement au flanc du bateau.',
      'Cadrez toute la coque visible, de la proue à l’arrière.',
      'Évitez les contre-jours : le soleil doit éclairer la coque.',
    ],
    cameraHint: 'Cadrez le flanc entier du bateau',
  },
  'bow-front': {
    title: 'Proue (avant)',
    tips: [
      'Photographiez l’avant du bateau de face.',
      'Incluez l’étrave et les éléments fixés à la proue.',
      'Reculez si besoin pour tout faire tenir dans le cadre.',
    ],
    cameraHint: 'Vue de face sur la proue',
  },
  'stern-rear': {
    title: 'Arrière du bateau',
    tips: [
      'Cadrez l’arrière : plateforme, moteur(s) ou propulseur.',
      'Montrez l’état de la zone de baignade / passerelle.',
      'Vérifiez que la photo est nette avant de valider.',
    ],
    cameraHint: 'Vue arrière complète',
  },
  cockpit: {
    title: 'Cockpit / poste de pilotage',
    tips: [
      'Photographiez l’intérieur du cockpit en plan large.',
      'Montrez sièges, console et accès.',
      'Ouvrez les rideaux ou capotes si nécessaire pour la visibilité.',
    ],
    cameraHint: 'Plan large de l’intérieur',
  },
  dashboard: {
    title: 'Tableau de bord',
    tips: [
      'Cadrez les instruments et l’écran de navigation.',
      'Allumez le tableau de bord si les indicateurs doivent être visibles.',
      'Approchez-vous pour que les chiffres soient lisibles.',
    ],
    cameraHint: 'Gros plan sur les instruments',
  },
  engine: {
    title: 'Moteur',
    tips: [
      'Ouvrez le capot moteur si applicable.',
      'Photographiez le moteur et les fixations visibles.',
      'Signalez toute trace d’huile ou anomalie en commentaire.',
    ],
    cameraHint: 'Moteur et zone motrice',
  },
  'fuel-gauge': {
    title: 'Jauge d’essence',
    tips: [
      'Cadrez uniquement la jauge, bien éclairée.',
      'Le niveau doit être lisible sur la photo.',
      'Utilisez aussi le curseur ci-dessous pour indiquer le pourcentage.',
    ],
    cameraHint: 'Gros plan sur la jauge',
  },
  damage: {
    title: 'Dommage / anomalie',
    tips: [
      'Approchez-vous du dommage pour un gros plan net.',
      'Ajoutez une photo de contexte si utile.',
      'Décrivez précisément en commentaire.',
    ],
    cameraHint: 'Gros plan sur la zone endommagée',
  },
  safety: {
    title: 'Équipement de sécurité',
    tips: [
      'Montrez gilets, extincteur, trousse ou matériel demandé.',
      'Vérifiez que les quantités sont visibles.',
      'Étalez le matériel si plusieurs pièces sont à montrer.',
    ],
    cameraHint: 'Équipement bien visible',
  },
  'keys-docs': {
    title: 'Clés & documents',
    tips: [
      'Posez clés et documents sur une surface claire.',
      'Évitez les reflets sur les cartes plastifiées.',
      'Masquez les numéros sensibles si nécessaire.',
    ],
    cameraHint: 'Clés et papiers à plat',
  },
  registration: {
    title: 'Immatriculation',
    tips: [
      'Cadrez la plaque ou le numéro d’immatriculation.',
      'Approchez-vous pour que les caractères soient nets.',
      'Essuyez la plaque si elle est salie.',
    ],
    cameraHint: 'Plaque d’immatriculation lisible',
  },
  trailer: {
    title: 'Remorque',
    tips: [
      'Photographiez la remorque et les sangles visibles.',
      'Montrez les roues et le attelage si accessible.',
      'Vérifiez l’état général avant le départ.',
    ],
    cameraHint: 'Vue d’ensemble de la remorque',
  },
  'full-boat': {
    title: 'Vue d’ensemble',
    tips: [
      'Reculez pour cadrer le bateau en entier.',
      'Incluez le ponton ou l’emplacement si possible.',
      'Prenez la photo en lumière naturelle.',
    ],
    cameraHint: 'Bateau entier dans le cadre',
  },
  'boolean-check': {
    title: 'Contrôle oui / non',
    tips: ['Vérifiez visuellement avant de répondre.', 'Ajoutez un commentaire si la réponse est « Non ».'],
  },
  'text-note': {
    title: 'Information à renseigner',
    tips: ['Soyez précis et concis.', 'Utilisez le commentaire pour les détails supplémentaires.'],
  },
  'select-choice': {
    title: 'Choix à sélectionner',
    tips: ['Choisissez l’option correspondant à l’état constaté.', 'Commentez si aucune option ne convient.'],
  },
  'generic-photo': {
    title: 'Photo demandée',
    tips: [
      'Cadrez clairement l’élément demandé.',
      'Utilisez la lumière naturelle et évitez le flou.',
      'Relisez la consigne ci-dessus avant de capturer.',
    ],
    cameraHint: 'Cadrez l’élément demandé',
  },
};

const LABEL_PATTERNS: Array<{ kind: CheckFlowGuideKind; patterns: RegExp[] }> = [
  { kind: 'hull-side', patterns: [/coque/i, /flanc/i, /tribord/i, /babord/i, /lat[ée]ral/i, /ext[ée]rieur/i, /c[ôo]t[ée]/i] },
  { kind: 'bow-front', patterns: [/proue/i, /\bavant\b/i, /\bbow\b/i, /[ée]trave/i] },
  { kind: 'stern-rear', patterns: [/arri[èe]re/i, /poupe/i, /\bstern\b/i, /plateforme/i, /passerelle/i] },
  { kind: 'cockpit', patterns: [/cockpit/i, /int[ée]rieur/i, /poste/i, /banquette/i, /si[èe]ge/i] },
  { kind: 'dashboard', patterns: [/tableau/i, /instrument/i, /console/i, /[ée]cran/i, /gps/i, /vhf/i] },
  { kind: 'engine', patterns: [/moteur/i, /motor/i, /h[ée]lice/i, /propulseur/i, /embase/i] },
  { kind: 'fuel-gauge', patterns: [/essence/i, /carburant/i, /jauge/i, /r[ée]servoir/i, /fuel/i] },
  { kind: 'damage', patterns: [/dommage/i, /rayure/i, /choc/i, /d[ée]g[âa]t/i, /anomal/i, /casse/i] },
  { kind: 'safety', patterns: [/gilet/i, /extincteur/i, /s[ée]curit[ée]/i, /trousse/i, /mat[ée]riel/i, /bou[ée]e/i] },
  { kind: 'keys-docs', patterns: [/cl[ée]/i, /document/i, /permis/i, /passeport/i, /carte/i, /papiers/i] },
  { kind: 'registration', patterns: [/immatric/i, /num[ée]ro/i, /plaque/i, /targa/i] },
  { kind: 'trailer', patterns: [/remorque/i, /trailer/i, /attelage/i] },
  { kind: 'full-boat', patterns: [/ensemble/i, /global/i, /entier/i, /vue d/i, /profil/i, /bateau/i] },
];

function haystack(q: Pick<CheckFlowQuestion, 'label' | 'helpText'>): string {
  return `${q.label} ${q.helpText ?? ''}`.trim();
}

export function resolveCheckFlowGuide(
  q: Pick<CheckFlowQuestion, 'label' | 'helpText' | 'questionType'>,
): CheckFlowGuide {
  if (q.questionType === 'FUEL_GAUGE') {
    return { kind: 'fuel-gauge', ...GUIDE_COPY['fuel-gauge'] };
  }
  if (q.questionType === 'BOOLEAN') {
    return { kind: 'boolean-check', ...GUIDE_COPY['boolean-check'] };
  }
  if (q.questionType === 'TEXT') {
    return { kind: 'text-note', ...GUIDE_COPY['text-note'] };
  }
  if (q.questionType === 'SELECT') {
    return { kind: 'select-choice', ...GUIDE_COPY['select-choice'] };
  }

  const text = haystack(q);
  for (const entry of LABEL_PATTERNS) {
    if (entry.patterns.some((p) => p.test(text))) {
      return { kind: entry.kind, ...GUIDE_COPY[entry.kind] };
    }
  }
  return { kind: 'generic-photo', ...GUIDE_COPY['generic-photo'] };
}

export function isQuestionStepComplete(
  q: CheckFlowQuestion,
  value?: { text?: string; photos?: string[]; comment?: string },
): boolean {
  if (!q.required) return true;
  if (q.questionType === 'PHOTO') {
    return (value?.photos?.length ?? 0) >= q.photoMinCount;
  }
  if (q.questionType === 'BOOLEAN') {
    return value?.text === 'true' || value?.text === 'false';
  }
  if (q.questionType === 'FUEL_GAUGE') {
    return Boolean(value?.text?.trim());
  }
  return Boolean(value?.text?.trim());
}

export function questionTypeLabel(t: CheckQuestionType): string {
  if (t === 'PHOTO') return 'Photo';
  if (t === 'FUEL_GAUGE') return 'Essence';
  if (t === 'BOOLEAN') return 'Contrôle';
  if (t === 'SELECT') return 'Choix';
  return 'Texte';
}
