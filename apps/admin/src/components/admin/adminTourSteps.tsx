import type { InteractiveTourStep } from '@/components/ui/InteractiveSpotlightTour';

export const ADMIN_ONBOARDING_KEY = 'admin-backoffice-onboarding-v1';

export const ADMIN_TOUR_STEPS: InteractiveTourStep[] = [
  {
    title: 'Bienvenue',
    placement: 'center',
    body: (
      <>
        Voici le <strong>back-office Azur</strong> pour gérer locations, flotte, clients et finances. Ce guide
        interactif vous montre chaque section — suivez les zones surlignées. Vous pouvez{' '}
        <strong>Ignorer</strong> à tout moment.
      </>
    ),
  },
  {
    title: 'Tableau de bord',
    target: '[data-tour="admin-nav-dashboard"]',
    route: '/dashboard',
    placement: 'right',
    body: (
      <>
        Le <strong>Dashboard</strong> est votre page d’accueil : locations du jour, météo marine, aperçu financier,
        membres et check-in/out.
      </>
    ),
  },
  {
    title: 'Vue d’ensemble',
    target: '[data-tour="admin-dashboard-main"]',
    route: '/dashboard',
    placement: 'top',
    spotlightPadding: 8,
    body: (
      <>
        Basculez entre <strong>aujourd’hui</strong> et <strong>demain</strong>, consultez les départs/retours et les
        widgets de synthèse.
      </>
    ),
  },
  {
    title: 'Planning',
    target: '[data-tour="admin-nav-calendar-planning"]',
    route: '/calendrier',
    placement: 'right',
    body: (
      <>
        Le <strong>planning</strong> affiche toute la flotte : réservations colorées par statut, indisponibilités et
        création de locations.
      </>
    ),
  },
  {
    title: 'Grille calendrier',
    target: '[data-tour="admin-calendar-planning"]',
    route: '/calendrier',
    placement: 'top',
    spotlightPadding: 6,
    body: (
      <>
        Cliquez sur un créneau pour <strong>créer une réservation</strong>, sur une réservation pour la modifier, ou
        sur une date pour bloquer un bateau.
      </>
    ),
  },
  {
    title: 'Réservations',
    target: '[data-tour="admin-nav-reservations"]',
    route: '/reservations',
    placement: 'right',
    body: (
      <>
        La liste <strong>Réservations</strong> centralise toutes les locations : recherche, filtres par statut et fiche
        détail complète.
      </>
    ),
  },
  {
    title: 'Liste des locations',
    target: '[data-tour="admin-reservations-list"]',
    route: '/reservations',
    placement: 'right',
    body: (
      <>
        Sélectionnez une ligne pour ouvrir le panneau détail : client, tarifs, extras, paiements, contrat et actions
        (annulation, relance…).
      </>
    ),
  },
  {
    title: 'Annonces',
    target: '[data-tour="admin-nav-annonces"]',
    route: '/annonces',
    placement: 'right',
    body: (
      <>
        Publiez des <strong>annonces</strong> sur le site public : promotions, nouveautés flotte, liens vers des
        bateaux ou pages.
      </>
    ),
  },
  {
    title: 'Bateaux',
    target: '[data-tour="admin-nav-bateaux"]',
    route: '/bateaux',
    placement: 'right',
    body: (
      <>
        Gérez la <strong>flotte</strong> : fiches techniques, photos, flottilles, propriétaires, tarifs de base et
        disponibilité.
      </>
    ),
  },
  {
    title: 'Coupons',
    target: '[data-tour="admin-nav-coupons"]',
    route: '/coupons',
    placement: 'right',
    body: (
      <>
        Créez des <strong>codes promo</strong> : remise en %, période de validité, limites d’usage et ciblage par
        bateau ou saison.
      </>
    ),
  },
  {
    title: 'Membres',
    target: '[data-tour="admin-nav-membres"]',
    route: '/clients',
    placement: 'right',
    body: (
      <>
        La page <strong>Membres</strong> regroupe clients, propriétaires, agents et administrateurs. Créez des comptes,
        attribuez les rôles et les permissions.
      </>
    ),
  },
  {
    title: 'Extras',
    target: '[data-tour="admin-nav-extras"]',
    route: '/extras',
    placement: 'right',
    body: (
      <>
        Définissez les <strong>extras</strong> proposés à la réservation : skipper, wakeboard, stock, tarification et
        icônes.
      </>
    ),
  },
  {
    title: 'Finances',
    target: '[data-tour="admin-nav-finances"]',
    route: '/finances',
    placement: 'right',
    body: (
      <>
        Consultez le <strong>rapport financier</strong> : chiffre d&apos;affaires, encaissements Stripe, acomptes et
        détail par réservation.
      </>
    ),
  },
  {
    title: 'Check-in / Check-out',
    target: '[data-tour="admin-nav-checkflow"]',
    route: '/check-flow/formulaires',
    placement: 'right',
    body: (
      <>
        Configurez les <strong>formulaires tablette</strong> pour les agents : état des lieux au départ et au retour,
        questions et historique.
      </>
    ),
  },
  {
    title: 'Paramètres',
    target: '[data-tour="admin-nav-parametres"]',
    route: '/parametres',
    placement: 'right',
    scrollBlock: 'end',
    body: (
      <>
        Les <strong>Paramètres</strong> centralisent la société, les saisons tarifaires, les contrats, les partenaires,
        les notifications et le check-in/out.
      </>
    ),
  },
  {
    title: 'Notifications',
    target: '[data-tour="admin-header-notifications"]',
    route: '/reservations',
    placement: 'bottom',
    body: (
      <>
        La cloche en haut à droite affiche les <strong>notifications internes</strong> : nouvelles réservations,
        paiements, signatures de contrat…
      </>
    ),
  },
  {
    title: 'Filtres de page',
    target: '[data-tour="admin-header-filters"]',
    route: '/reservations',
    placement: 'bottom',
    body: (
      <>
        Le bouton <strong>filtres</strong> ouvre un panneau latéral adapté à chaque page (bateaux, statuts, dates…).
        Un point bleu indique des filtres actifs.
      </>
    ),
  },
  {
    title: 'Votre profil',
    target: '[data-tour="admin-footer-profile"]',
    placement: 'right',
    scrollBlock: 'end',
    spotlightPadding: 8,
    body: (
      <>
        En bas du menu : votre <strong>photo, nom et e-mail</strong>. Cliquez pour mettre à jour vos coordonnées et
        votre mot de passe.
      </>
    ),
  },
  {
    title: 'Fiche profil',
    target: '[data-tour="admin-profile-main"]',
    route: '/profil',
    placement: 'bottom',
    body: (
      <>
        Mettez à jour vos <strong>coordonnées</strong>, votre photo et votre mot de passe. Ces informations servent
        pour les échanges internes et les documents.
      </>
    ),
  },
  {
    title: 'C’est parti !',
    placement: 'center',
    body: (
      <>
        Vous connaissez maintenant l’essentiel du back-office. Explorez librement et bonne gestion !
      </>
    ),
  },
];
