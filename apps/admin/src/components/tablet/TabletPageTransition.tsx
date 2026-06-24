import { useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import {
  resolveTabletPageTransition,
  TABLET_PAGE_TRANSITION_CLASS,
  type TabletPageTransitionKind,
} from '@/lib/tabletPageTransition';

export function TabletPageTransition() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevPath = useRef(location.pathname);
  const transitionKind = useRef<TabletPageTransitionKind>('fade');
  const isFirst = useRef(true);

  if (location.pathname !== prevPath.current) {
    transitionKind.current = resolveTabletPageTransition(
      prevPath.current,
      location.pathname,
      navType,
    );
    prevPath.current = location.pathname;
  }

  const className = isFirst.current
    ? ''
    : TABLET_PAGE_TRANSITION_CLASS[transitionKind.current];

  if (isFirst.current) {
    isFirst.current = false;
  }

  return (
    <div key={location.key} className={['bc-page-layer min-h-full', className].filter(Boolean).join(' ')}>
      <Outlet />
    </div>
  );
}
