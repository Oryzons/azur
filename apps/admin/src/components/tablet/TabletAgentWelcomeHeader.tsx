import { Bell, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { TB } from '@/lib/tabletTheme';

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

type Props = {
  onRefresh?: () => void;
  refreshing?: boolean;
  onLogout?: () => void;
};

export function TabletAgentWelcomeHeader({ onRefresh, refreshing, onLogout }: Props) {
  const user = useAuthStore((s) => s.user);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={TB.avatar}
          aria-hidden
        >
          {initials(user.firstName, user.lastName)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500">Bon retour !</p>
          <p className="truncate text-base font-bold text-zinc-900">{name}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={TB.iconBtnRound}
            aria-label="Actualiser"
          >
            <Bell className={`h-5 w-5 ${refreshing ? 'animate-pulse' : ''}`} strokeWidth={1.9} />
          </button>
        ) : null}
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className={TB.iconBtnRound}
            aria-label="Déconnexion"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.9} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
