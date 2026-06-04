import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  Megaphone,
  PackagePlus,
  Settings,
  Ship,
  TicketPercent,
  Users,
  Wallet,
} from 'lucide-react';

export type DashboardQuickLink = {
  to: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  accent?: 'default' | 'primary';
};

export const DASHBOARD_QUICK_LINKS: DashboardQuickLink[] = [
  {
    to: '/calendrier',
    label: 'Calendrier',
    description: 'Planning et créneaux',
    Icon: Calendar,
    accent: 'primary',
  },
  {
    to: '/reservations',
    label: 'Réservations',
    description: 'Liste et fiches',
    Icon: CalendarDays,
  },
  {
    to: '/finances',
    label: 'Finances',
    description: 'CA et paiements',
    Icon: Wallet,
  },
  {
    to: '/bateaux',
    label: 'Bateaux',
    description: 'Catalogue et flotilles',
    Icon: Ship,
  },
  {
    to: '/clients',
    label: 'Membres',
    description: 'Clients et équipe',
    Icon: Users,
  },
  {
    to: '/annonces',
    label: 'Annonces',
    description: 'Site public',
    Icon: Megaphone,
  },
  {
    to: '/extras',
    label: 'Extras',
    description: 'Options location',
    Icon: PackagePlus,
  },
  {
    to: '/coupons',
    label: 'Coupons',
    description: 'Codes promo',
    Icon: TicketPercent,
  },
  {
    to: '/check-flow/formulaires',
    label: 'Check-in / out',
    description: 'Formulaires tablette',
    Icon: ClipboardList,
  },
  {
    to: '/parametres',
    label: 'Paramètres',
    description: 'Société et réglages',
    Icon: Settings,
  },
];
