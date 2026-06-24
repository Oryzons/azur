import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, CalendarDays, ClipboardList } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TB } from '@/lib/tabletTheme';

const navItems = [
  { to: '/tablette/aujourdhui', label: "Aujourd'hui", Icon: ClipboardList, end: true },
  { to: '/tablette/reservations', label: 'Réservations', Icon: CalendarDays, end: false },
  { to: '/tablette/calendrier', label: 'Calendrier', Icon: Calendar, end: false },
] as const;

function activeIndex(pathname: string): number {
  if (pathname.startsWith('/tablette/calendrier')) return 2;
  if (pathname.startsWith('/tablette/reservations')) return 1;
  return 0;
}

export function TabletFloatingNav() {
  const location = useLocation();
  const index = activeIndex(location.pathname);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const [indicatorPop, setIndicatorPop] = useState(false);
  const prevIndex = useRef(index);

  useEffect(() => {
    if (prevIndex.current === index) return;
    prevIndex.current = index;
    setIndicatorPop(true);
    const t = window.setTimeout(() => setIndicatorPop(false), 480);
    return () => window.clearTimeout(t);
  }, [index]);

  return (
    <div className={TB.floatingNavWrap} aria-label="Navigation principale">
      <nav className={TB.floatingNav}>
        <div className="pointer-events-none absolute inset-y-2 left-3 right-3" aria-hidden>
          <span
            className="bc-nav-indicator absolute top-0 bottom-0 w-1/3"
            style={{ transform: `translateX(${index * 100}%)` }}
          >
            <span
              className={[
                'block h-full w-full rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.18)]',
                indicatorPop ? 'bc-nav-indicator-pop' : '',
              ].join(' ')}
            />
          </span>
        </div>

        {navItems.map(({ to, label, Icon, end }, i) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            aria-current={index === i ? 'page' : undefined}
            onPointerDown={() => setPressedIndex(i)}
            onPointerUp={() => setPressedIndex(null)}
            onPointerLeave={() => setPressedIndex(null)}
            onPointerCancel={() => setPressedIndex(null)}
            className={({ isActive }) =>
              [
                TB.floatingNavItem,
                isActive ? TB.floatingNavItemActive : TB.floatingNavItemIdle,
                pressedIndex === i ? 'bc-nav-item-press' : '',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <span
                className={[
                  'bc-nav-icon-wrap',
                  isActive ? 'bc-nav-icon-active' : 'bc-nav-icon-idle',
                ].join(' ')}
              >
                <Icon className="h-5 w-5" aria-hidden strokeWidth={isActive ? 2.35 : 1.85} />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
