import type { InteractiveTourStep } from '@/components/ui/InteractiveSpotlightTour';

export const OWNER_PORTAL_ONBOARDING_KEY = 'owner-portal-onboarding-v3';

export const OWNER_PORTAL_TOUR_STEPS: InteractiveTourStep[] = [
  {
    title: 'Bienvenue',
    placement: 'center',
    body: (
      <>
        Voici votre <strong>espace propriétaire</strong> : planning et locations sur <strong>vos bateaux</strong>.
        Ce guide interactif vous montre où cliquer — suivez les zones mises en surbrillance, jusqu’au{' '}
        <strong>profil en bas du menu</strong>.
      </>
    ),
  },
  {
    title: 'Mon calendrier',
    target: '[data-tour="owner-nav-calendar"]',
    route: '/calendrier',
    placement: 'right',
    body: (
      <>
        Ouvrez <strong>Mon calendrier</strong> pour voir le planning : les blocs colorés sont des{' '}
        <strong>réservations clients</strong>, le gris vos <strong>indisponibilités</strong>.
      </>
    ),
  },
  {
    title: 'Le planning',
    target: '[data-tour="owner-calendar-planning"]',
    route: '/calendrier',
    placement: 'top',
    spotlightPadding: 6,
    body: (
      <>
        Chaque ligne est un de vos bateaux. Les blocs colorés = <strong>réservation client</strong> (horaires
        uniquement) — cliquez pour consulter, sans modifier. Le gris = <strong>indisponibilité</strong>.
      </>
    ),
  },
  {
    title: 'Bloquer une date',
    target: '[data-tour="owner-calendar-unavail-hint"]',
    route: '/calendrier',
    placement: 'bottom',
    body: (
      <>
        Pour une <strong>indisponibilité</strong> (entretien, usage perso…) :{' '}
        <strong>cliquez sur la date</strong> dans la grille, choisissez le bateau et les horaires. Le créneau apparaît
        en gris ; recliquez dessus pour modifier ou supprimer.
      </>
    ),
  },
  {
    title: 'Mes réservations',
    target: '[data-tour="owner-nav-reservations"]',
    route: '/reservations',
    placement: 'right',
    body: (
      <>
        <strong>Mes réservations</strong> regroupe toutes les locations des <strong>clients sur vos bateaux</strong>, avec
        dates et statuts.
      </>
    ),
  },
  {
    title: 'Liste des locations',
    target: '[data-tour="owner-reservations-list"]',
    route: '/reservations',
    placement: 'right',
    body: (
      <>
        Sélectionnez une ligne pour voir la <strong>date et les horaires</strong> du créneau. Aucune donnée client
        n’est affichée.
      </>
    ),
  },
  {
    title: 'Nous contacter',
    target: '[data-tour="owner-nav-contact"]',
    route: '/contact',
    placement: 'right',
    body: (
      <>
        Le menu <strong>Contact</strong> regroupe e-mail, téléphone, SMS, adresse et horaires pour joindre Bleu Calanque.
      </>
    ),
  },
  {
    title: 'Profil en bas du menu',
    target: '[data-tour="owner-footer-profile"]',
    placement: 'right',
    scrollBlock: 'end',
    spotlightPadding: 8,
    body: (
      <>
        Tout en bas de la barre latérale : votre <strong>photo, nom et e-mail</strong>. Cliquez sur cette zone pour
        ouvrir votre fiche profil.
      </>
    ),
  },
  {
    title: 'Votre fiche profil',
    target: '[data-tour="owner-profile-main"]',
    route: '/profil',
    placement: 'bottom',
    body: (
      <>
        Mettez à jour vos <strong>coordonnées</strong>, votre photo et votre mot de passe. Ces informations servent
        pour les échanges avec Bleu Calanque. Pour un changement de bateau ou une question : contactez l’équipe.
      </>
    ),
  },
];
