const PWA_DISMISS_KEY = 'agent-pwa-install-dismissed';

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isPwaInstallDismissed(): boolean {
  try {
    return localStorage.getItem(PWA_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPwaInstall(): void {
  try {
    localStorage.setItem(PWA_DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
