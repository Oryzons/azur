import type { NavigationType } from 'react-router-dom';

export type TabletPageTransitionKind =
  | 'tab-forward'
  | 'tab-back'
  | 'push'
  | 'back'
  | 'push-up'
  | 'pop-down'
  | 'fade';

export function isCheckFlowRoute(pathname: string): boolean {
  return pathname.includes('/check-in/') || pathname.includes('/check-out/');
}

export function isReservationDetailRoute(pathname: string): boolean {
  return pathname.includes('/tablette/reservation/');
}

export function tabletRouteLevel(pathname: string): number {
  if (isCheckFlowRoute(pathname)) return 2;
  if (isReservationDetailRoute(pathname)) return 1;
  return 0;
}

export function tabletTabIndex(pathname: string): number {
  if (pathname.startsWith('/tablette/calendrier')) return 2;
  if (pathname.startsWith('/tablette/reservations')) return 1;
  return 0;
}

export function resolveTabletPageTransition(
  fromPath: string,
  toPath: string,
  navType: NavigationType,
): TabletPageTransitionKind {
  const fromLevel = tabletRouteLevel(fromPath);
  const toLevel = tabletRouteLevel(toPath);

  if (navType === 'POP') {
    if (fromLevel > toLevel) {
      return fromLevel === 1 && toLevel === 0 ? 'pop-down' : 'back';
    }
    if (fromLevel === toLevel && toLevel === 0) {
      return tabletTabIndex(toPath) < tabletTabIndex(fromPath) ? 'tab-back' : 'tab-forward';
    }
    return 'back';
  }

  if (toLevel > fromLevel) {
    return toLevel === 1 ? 'push-up' : 'push';
  }

  if (toLevel < fromLevel) {
    return toLevel === 0 && fromLevel === 1 ? 'pop-down' : 'back';
  }

  if (toLevel === 0 && fromLevel === 0) {
    return tabletTabIndex(toPath) >= tabletTabIndex(fromPath) ? 'tab-forward' : 'tab-back';
  }

  return 'fade';
}

export const TABLET_PAGE_TRANSITION_CLASS: Record<TabletPageTransitionKind, string> = {
  'tab-forward': 'bc-tab-forward',
  'tab-back': 'bc-tab-back',
  push: 'bc-page-push',
  back: 'bc-page-back',
  'push-up': 'bc-page-push-up',
  'pop-down': 'bc-page-pop-down',
  fade: 'bc-page-fade',
};
