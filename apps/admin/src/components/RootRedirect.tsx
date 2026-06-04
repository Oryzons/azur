import { Navigate } from 'react-router-dom';
import { homePathForRole } from '@/lib/userRoles';
import { useAuthStore } from '@/stores/auth';

export function RootRedirect() {
  const role = useAuthStore((s) => s.user.role);
  return <Navigate to={homePathForRole(role)} replace />;
}
