import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { homePathForRole, isDeskUser, isOwnerUser } from '@/lib/userRoles';
import { ParametresPage } from '@/pages/parametres/ParametresPage';
import { OwnerSettingsPage } from '@/pages/owner/OwnerSettingsPage';

/** Paramètres admin ou propriétaire — une seule route pour éviter les conflits de matching. */
export function ParametresRoute() {
  const role = useAuthStore((s) => s.user.role);
  const mustChangePassword = useAuthStore((s) => s.user.mustChangePassword);

  if (isOwnerUser(role)) {
    if (mustChangePassword) return <Navigate to="/login" replace />;
    return <OwnerSettingsPage />;
  }
  if (isDeskUser(role)) return <ParametresPage />;
  return <Navigate to={homePathForRole(role)} replace />;
}
