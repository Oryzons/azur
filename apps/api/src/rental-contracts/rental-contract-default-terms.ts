export type CgvSection = {
  title: string;
  /** Paragraphes ou listes à puces (chaque string = un <p> ou bloc <ul>). */
  blocks: { type: 'p' | 'ul'; content: string | string[] }[];
};

import { DEFAULT_BRAND_NAME } from '@bleu-calanque/shared';

/** Conditions générales Bleu Calanque (texte de référence). */
export function buildDefaultCgvSections(companyName: string): CgvSection[] {
  const co = companyName.trim() || DEFAULT_BRAND_NAME;

  return [
    {
      title: 'Prise en charge du bateau à la location',
      blocks: [
        {
          type: 'p',
          content: `Le Propriétaire s'engage à confier au Locataire un Bateau équipé et armé conformément aux lois et règlementations en vigueur pour la catégorie de navigation. Le Propriétaire s'engage à louer son Bateau dans un parfait état de fonctionnement et de propreté. Tous les instruments nécessaires à la navigation et à la sécurité du Bateau et de ses passagers doivent obligatoirement être présents à bord du Bateau. La prise en charge du Bateau par le Locataire se réalise suite à la signature de l'état des lieux contradictoire du Bateau et lorsque le Propriétaire lui remet les clés du Bateau. La sous-location et/ou le prêt du Bateau sont strictement interdits. La participation à des régates, des courses croisières ou toutes autres compétitions est strictement interdite.`,
        },
        {
          type: 'p',
          content:
            "Toute annulation d'une réservation non encore réglée entraînera des frais de dossier de 100 € TTC.",
        },
      ],
    },
    {
      title: "Conditions d'annulation",
      blocks: [
        {
          type: 'p',
          content: `Avant la prise en charge du bateau, si le locataire renonce à la location et résilie le contrat, la perception de frais d'annulation par le loueur se fera dans les conditions suivantes :`,
        },
        {
          type: 'ul',
          content: [
            'Pour une annulation de moins de 7 jour(s) avant la location : remboursement de 0 % des montants déjà versés',
            'Pour une annulation entre 7 et 21 jours avant la location : remboursement de 50 % des montants déjà versés (Frais de dossier de 0,00 €)',
            'Pour une annulation de plus de 21 jours avant la location : remboursement de 100 % des montants déjà versés (Frais de dossier de 0,00 €)',
          ],
        },
      ],
    },
    {
      title: 'États des lieux contradictoire du bateau',
      blocks: [
        {
          type: 'p',
          content: `Chaque inspection doit être effectuée en deux (2) exemplaires identiques, un (1) conservé par l'affréteur et un (1) conservé par le Propriétaire. Chaque exemplaire est signé par le Locataire et le Propriétaire. Chaque inspection doit comprendre les éléments suivants : l'état et les observations de la situation du Navire et de tout dommage, blessure, avarie, panne, inconvénient et/ou problème de toute nature présent sur et dans le Navire. Il s'agit d'éléments visibles, apparents, non visibles et mécaniques relatifs à l'embarcation. Les Propriétaires et les Locataires sont les seuls responsables de la réalisation, du montage et de l'entretien de l'inspection de l'équipement du Bateau. De même, ils ne sont pas autorisés à procéder à un inventaire séparé des équipements et à effectuer des modifications unilatérales. La signature de chaque état des lieux contradictoire par le Propriétaire et l'affréteur constitue une reconnaissance de l'état du Bateau à l'exception des vices cachés et des défaillances mécaniques normales qui peuvent survenir lors d'une utilisation normale du Bateau.`,
        },
      ],
    },
    {
      title: 'Restitution du bateau',
      blocks: [
        {
          type: 'p',
          content: `Le Locataire restitue obligatoirement le Bateau au port de départ où ledit Bateau lui a été remis, sauf demande particulière effectuée par le Propriétaire stipulé dans le contrat. Le Locataire restitue obligatoirement le Bateau avec tous les équipements qu'il contient au jour et à l'heure convenus entre les Parties lors de la réservation du Bateau. Tout retard dans la restitution du Bateau est susceptible d'engendrer une majoration du prix de la Location. En ce sens, toute heure entamée de dépassement de Location est facturée au prix horaire du tarif en vigueur majoré de pénalités correspondant à cinquante pourcents (50 %) du taux horaire. En cas de retard dans la restitution du Bateau, le Locataire s'oblige à en avertir le Propriétaire et ${co}. Le Locataire s'oblige à restituer le Bateau et ses équipements en l'état qu'il a reçu lors de la prise en Location, ceci concernant notamment son état de fonctionnement et de propreté au jour et à l'heure prévue au contrat pour éviter toute majoration de prix horaire. Le Bateau est obligatoirement restitué avec le même niveau de réservoir du carburant que celui constaté lors de la prise en Location du Bateau. Si le niveau constaté lors de la restitution du Bateau est plus faible, le Propriétaire est en droit de facturer la différence de niveau de carburant au locataire. Toute(s) détérioration(s) et/ou perte(s) constatée(s), même partielle(s), du Bateau loué et/ou de ses équipements lors de la restitution du Bateau sont obligatoirement indiquées dans l'état des lieux contradictoire de remise du Bateau. Elles sont fortement susceptibles d'être imputées au Locataire et sont fortement susceptibles d'induire des frais supplémentaires déduits de la caution. Si pour une raison quelconque, le locataire n'est pas en mesure de ramener lui-même le bateau à son port de départ, il devra à ses frais en assurer le retour après en avoir avisé le propriétaire.`,
        },
      ],
    },
    {
      title: 'Caution',
      blocks: [
        {
          type: 'p',
          content: `Lors de la réservation du Bateau, le Locataire accepte une pré-autorisation sur sa carte bleue qui pourra être débitée en cas de dommage ou non respect des conditions de location. Lors de la prise du Bateau et de manière optionnelle, le Propriétaire est en droit de demander une caution supplémentaire au Locataire. Cette caution supplémentaire doit être notifiée au locataire avant la confirmation de la réservation et acceptée par le locataire. En cas d'urgence, contactez le CROSS (196) (toute demande non critique ne sera pas traitée). La caution a pour objet de garantir les détériorations et/ou de pertes constatées, même partielles, du Bateau loué qui sont imputables au Locataire. Le montant de la caution ne constitue pas une quelconque limite de responsabilité opposable. Les Parties conservent tout pouvoir pour jouir de leurs droits à exercer un quelconque recours en réparation des dommages subis.`,
        },
      ],
    },
    {
      title: 'Utilisation du bateau',
      blocks: [
        {
          type: 'p',
          content: `Par défaut, le Locataire est déclaré en tant que Chef de bord du Bateau. À ce titre, il est responsable tant du Bateau, que de ses équipements et de ses passagers, conformément aux lois et règlements en vigueur. Le Locataire est en droit de désigner toute autre personne en tant que Chef de bord du Bateau. En ce cas, le nom de ladite personne doit obligatoirement être indiqué dans le Contrat de Location du Bateau. Quant au Bateau, le Chef de bord est soumis aux obligations suivantes :`,
        },
        {
          type: 'ul',
          content: [
            "disposer d'un permis mer en cours de validité correspondant à la zone de navigation",
            'être capable de piloter le Bateau loué',
            'assurer le Propriétaire de ses connaissances en matière maritime',
            "assurer la responsabilité d'un navire, de ses équipements et de ses passagers",
            'être capable de diriger un équipage',
            'embarquer uniquement le nombre de personnes autorisées',
            'utiliser le Bateau pour une navigation de plaisance dans le cadre des législations en vigueur',
            "n'accomplir, à l'aide du Bateau, aucune opération de commerces, de pêche professionnelle, de transport, de régate ou autres",
          ],
        },
        {
          type: 'p',
          content: `Si le propriétaire juge que le Chef de bord désigné, quel qu'il soit, ne dispose pas des compétences propres à prendre en charge le Bateau ou à assurer la sécurité du Bateau et/ou de ses passagers, il est unilatéralement en droit d'annuler la réservation du Bateau ou de ne pas accomplir la Location du Bateau.`,
        },
      ],
    },
    {
      title: 'Avaries ou pertes',
      blocks: [
        {
          type: 'p',
          content: `En cas d'avarie(s) et/ou de perte(s) de matériel réalisée(s) au cours de la Location, le Locataire et/ou le Chef de bord doit obligatoirement :`,
        },
        {
          type: 'ul',
          content: [
            "si l'avarie ou la perte est légère et n'empêche pas la poursuite de la Location ou de la croisière : faire réparer ou remplacer le matériel endommagé, perdu ou manquant à condition que la dépense ne dépasse pas trente euros (30 €)",
            `si l'avarie ou la perte est plus importante et/ou empêche la poursuite de la Location : le locataire doit prendre immédiatement contact avec le Propriétaire et ${co} pour recevoir des instructions qu'il devra suivre exactement. En aucun cas, la perte de jouissance du Bateau pour cause d'avarie ou mauvais temps ne peut donner lieu à un dédommagement au profit de qui que ce soit`,
          ],
        },
      ],
    },
    {
      title: 'Matières consommables',
      blocks: [
        {
          type: 'p',
          content:
            "Sont à la charge du locataire : les carburants moteur, lubrifiants, combustibles pour cuisine, piles électriques, et toutes matières consommables nécessaires à la bonne marche et à l'entretien du bateau pendant la durée de la location.",
        },
      ],
    },
    {
      title: 'Litiges',
      blocks: [
        {
          type: 'p',
          content: `En cas de litige, le Propriétaire et le Locataire s'obligent à se rapprocher pour trouver une solution amiable. Si le Propriétaire et le Locataire ne parviennent pas à trouver un terrain d'entente, ledit litige sera automatiquement soumis à l'appréciation des tribunaux compétents.`,
        },
      ],
    },
    {
      title: 'Loi et langue applicables',
      blocks: [
        {
          type: 'p',
          content: `Les présentes Conditions Générales de Location sont soumises au droit français, seul applicable en la matière. Les présentes Conditions Générales de Location sont rédigées en français, seule langue applicable. Toute traduction des présentes conditions générales de location ne peut avoir qu'un caractère purement informatif.`,
        },
      ],
    },
  ];
}

function sectionBlocksToPlain(blocks: CgvSection['blocks']): string {
  return blocks
    .map((b) => {
      if (b.type === 'ul') {
        const items = Array.isArray(b.content) ? b.content : [b.content];
        return items.map((li) => `- ${li}`).join('\n');
      }
      return b.content as string;
    })
    .join('\n\n');
}

function plainTextToBlocks(text: string): CgvSection['blocks'] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  return paragraphs.map((p) => {
    const lines = p
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0 && lines.every((l) => l.startsWith('- '))) {
      return { type: 'ul' as const, content: lines.map((l) => l.replace(/^-\s*/, '')) };
    }
    return { type: 'p' as const, content: p.replace(/\s*\n\s*/g, ' ').trim() };
  });
}

export const DEFAULT_CONTRACT_REQUIRED_DOCUMENTS = [
  "Pièce d'identité en cours de validité",
  'Permis bateau ou certificat côtier',
];

/** Texte à enregistrer dans Paramètres → Contrats (champs annulation + location). */
export function serializeDefaultTermsForTemplate(companyName: string): {
  cancellationTerms: string;
  rentalTerms: string;
  description: string;
  requiredDocuments: string[];
} {
  const sections = buildDefaultCgvSections(companyName);
  const cancel = sections.find((s) => s.title === "Conditions d'annulation");
  const cancellationTerms = cancel ? sectionBlocksToPlain(cancel.blocks) : '';
  const rentalTerms = sections
    .filter((s) => s !== cancel)
    .map((s) => `## ${s.title}\n\n${sectionBlocksToPlain(s.blocks)}`)
    .join('\n\n');

  return {
    cancellationTerms,
    rentalTerms,
    description:
      'Modèle de contrat de location utilisé pour les réservations (PDF client et conditions générales).',
    requiredDocuments: DEFAULT_CONTRACT_REQUIRED_DOCUMENTS,
  };
}

function parseRentalTermsSections(text: string): CgvSection[] {
  const normalized = text.trim().replace(/^## /, '');
  if (!normalized.includes('## ')) {
    return normalized
      ? [{ title: 'Conditions de location', blocks: plainTextToBlocks(normalized) }]
      : [];
  }
  const chunks = normalized.split(/\n## /).filter(Boolean);
  return chunks.map((chunk) => {
    const nl = chunk.indexOf('\n');
    const title = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
    const body = nl === -1 ? '' : chunk.slice(nl + 1).trim();
    return { title, blocks: plainTextToBlocks(body) };
  });
}

export function parseStoredTermsToSections(template: {
  rentalTerms: string;
  cancellationTerms: string;
}): CgvSection[] {
  const sections: CgvSection[] = [];
  const cancel = template.cancellationTerms.trim();
  if (cancel) {
    sections.push({
      title: "Conditions d'annulation",
      blocks: plainTextToBlocks(cancel),
    });
  }
  sections.push(...parseRentalTermsSections(template.rentalTerms));
  return sections;
}

/** Utilise le modèle Paramètres si renseigné, sinon le texte par défaut intégré. */
export function resolveCgvSections(
  template: { rentalTerms: string; cancellationTerms: string },
  companyName: string,
): CgvSection[] {
  const cancel = template.cancellationTerms.trim();
  const rental = template.rentalTerms.trim();
  if (cancel.length < 40 && rental.length < 80) {
    return buildDefaultCgvSections(companyName);
  }
  const parsed = parseStoredTermsToSections(template);
  return parsed.length > 0 ? parsed : buildDefaultCgvSections(companyName);
}
