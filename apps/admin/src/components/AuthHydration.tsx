import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth';

/** Attend que le middleware persist Zustand ait relu localStorage avant de router auth. */
export function AuthHydration({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() =>
    typeof window === 'undefined' ? true : useAuthStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (useAuthStore.persist.hasHydrated()) setReady(true);
    return useAuthStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500">
        Chargement…
      </div>
    );
  }

  return children;
}
