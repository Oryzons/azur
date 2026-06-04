import { useEffect, useState } from 'react';

type PresencePhase = 'enter' | 'exit';

/**
 * Permet d'animer la fermeture (unmount différé) sans dépendance externe.
 */
export function usePresence(open: boolean, exitMs = 180) {
  const [present, setPresent] = useState(open);
  const [phase, setPhase] = useState<PresencePhase>(open ? 'enter' : 'exit');

  useEffect(() => {
    if (open) {
      setPresent(true);
      // Laisse le DOM se monter avant d'appliquer l'état d'entrée.
      const raf = requestAnimationFrame(() => setPhase('enter'));
      return () => cancelAnimationFrame(raf);
    }

    setPhase('exit');
    const t = globalThis.setTimeout(() => setPresent(false), exitMs);
    return () => globalThis.clearTimeout(t);
  }, [exitMs, open]);

  return { present, phase };
}

