import { NavLink } from 'react-router-dom';
import { ClipboardList, Tablet } from 'lucide-react';

const tabs = [
  { to: '/check-flow/formulaires', label: 'Formulaires', Icon: Tablet, end: true },
  { to: '/check-flow/historique', label: 'Historique', Icon: ClipboardList, end: false },
] as const;

export function CheckFlowSubNav() {
  return (
    <nav
      className="mt-6 flex flex-wrap gap-1 border-b border-zinc-200/90"
      aria-label="Sections check-in / check-out"
    >
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition -mb-px',
              isActive
                ? 'border-[#416B9F] text-[#416B9F]'
                : 'border-transparent text-zinc-500 hover:text-zinc-800',
            ].join(' ')
          }
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
