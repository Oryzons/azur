import { useCallback, useEffect, useState } from 'react';
import {
  type BeforeInstallPromptEvent,
  dismissPwaInstall,
  isIosDevice,
  isPwaInstallDismissed,
  isPwaStandalone,
} from '@/lib/pwa';

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isPwaStandalone());
  const [dismissed, setDismissed] = useState(() => isPwaInstallDismissed());
  const isIos = isIosDevice();

  useEffect(() => {
    if (isPwaStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setInstalled(true);
    return outcome === 'accepted';
  }, [deferred]);

  const showBanner =
    !installed &&
    !dismissed &&
    (Boolean(deferred) || isIos);

  return {
    showBanner,
    canNativeInstall: Boolean(deferred),
    isIos,
    installed,
    install,
    dismiss: () => {
      dismissPwaInstall();
      setDismissed(true);
    },
  };
}
