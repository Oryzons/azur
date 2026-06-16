import { Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { HomePage } from '@/pages/dashboard/HomePage';
import { AnnoncesPage } from '@/pages/annonces/AnnoncesPage';
import { ExtrasPage } from '@/pages/extras/ExtrasPage';
import { ReservationsPage } from '@/pages/reservations/ReservationsPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { CalendarPage } from '@/pages/calendar/CalendarPage';
import { BoatsPage } from '@/pages/boats/BoatsPage';
import { MembersPage } from '@/pages/members/MembersPage';
import { CouponsPage } from '@/pages/coupons/CouponsPage';
import { FinancesPage } from '@/pages/finances/FinancesPage';
import { ComptabilitePage } from '@/pages/comptabilite/ComptabilitePage';
import { ParametresRoute } from '@/components/ParametresRoute';
import { AgentOnlyRoute } from '@/components/AgentOnlyRoute';
import { DafOnlyRoute } from '@/components/DafOnlyRoute';
import { DeskOnlyRoute } from '@/components/DeskOnlyRoute';
import { OwnerOnlyRoute } from '@/components/OwnerOnlyRoute';
import { OwnerContactPage } from '@/pages/owner/OwnerContactPage';
import { PlanningAccessRoute } from '@/components/PlanningAccessRoute';
import { TabletLayout } from '@/layouts/TabletLayout';
import { TabletTodayPage } from '@/pages/tablet/TabletTodayPage';
import { TabletReservationsPage } from '@/pages/tablet/TabletReservationsPage';
import { TabletCheckFlowPage } from '@/pages/tablet/TabletCheckFlowPage';
import { TabletCalendarPage } from '@/pages/tablet/TabletCalendarPage';
import { TabletProfilePage } from '@/pages/tablet/TabletProfilePage';
import { RootRedirect } from '@/components/RootRedirect';
import { CheckFlowHistoryPage } from '@/pages/check-flow/CheckFlowHistoryPage';
import { CheckFlowFormsPage } from '@/pages/check-flow/CheckFlowFormsPage';
import { PaymentSuccessPage } from '@/pages/payment/PaymentSuccessPage';
import { PaymentCancelPage } from '@/pages/payment/PaymentCancelPage';
import { ContractSignPage } from '@/pages/contract/ContractSignPage';
import { ContractDownloadPage } from '@/pages/contract/ContractDownloadPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/paiement/succes" element={<PaymentSuccessPage />} />
      <Route path="/paiement/annule" element={<PaymentCancelPage />} />
      <Route path="/contrat/signer" element={<ContractSignPage />} />
      <Route path="/contrat/telecharger" element={<ContractDownloadPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/tablette" element={<AgentOnlyRoute />}>
          <Route path="profil" element={<TabletProfilePage />} />
          <Route element={<TabletLayout />}>
            <Route index element={<Navigate to="aujourdhui" replace />} />
            <Route path="aujourdhui" element={<TabletTodayPage />} />
            <Route path="reservations" element={<TabletReservationsPage />} />
            <Route path="calendrier" element={<TabletCalendarPage />} />
            <Route path="check-in/:reservationId" element={<TabletCheckFlowPage />} />
            <Route path="check-out/:reservationId" element={<TabletCheckFlowPage />} />
          </Route>
        </Route>

        <Route element={<DashboardLayout />}>
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/parametres" element={<ParametresRoute />} />

          {/* Calendrier / réservations : admin + propriétaire (avant OwnerOnlyRoute) */}
          <Route element={<PlanningAccessRoute />}>
            <Route path="/calendrier" element={<CalendarPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
          </Route>

          {/* Accueil propriétaire */}
          <Route element={<OwnerOnlyRoute />}>
            <Route index element={<Navigate to="/calendrier" replace />} />
            <Route path="/contact" element={<OwnerContactPage />} />
          </Route>

          {/* Comptabilité : DAF uniquement */}
          <Route element={<DafOnlyRoute />}>
            <Route path="/comptabilite" element={<ComptabilitePage />} />
          </Route>

          {/* Back-office admin */}
          <Route element={<DeskOnlyRoute />}>
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/annonces" element={<AnnoncesPage />} />
            <Route path="/bateaux" element={<BoatsPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/clients" element={<MembersPage />} />
            <Route path="/extras" element={<ExtrasPage />} />
            <Route path="/finances" element={<FinancesPage />} />
            <Route path="/check-flow" element={<Navigate to="/check-flow/formulaires" replace />} />
            <Route path="/check-flow/formulaires" element={<CheckFlowFormsPage />} />
            <Route path="/check-flow/historique" element={<CheckFlowHistoryPage />} />
            <Route index element={<RootRedirect />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
