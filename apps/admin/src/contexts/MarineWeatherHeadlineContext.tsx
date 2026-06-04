import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { MarineDaySummary, MarineHeadlineKind } from '@/pages/dashboard/marineWeather';

export type MarineHeadlineState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; day: MarineDaySummary; kind: MarineHeadlineKind };

type MarineWeatherHeadlineContextValue = {
  headline: MarineHeadlineState;
  setHeadline: (s: MarineHeadlineState) => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

const MarineWeatherHeadlineContext = createContext<MarineWeatherHeadlineContextValue | null>(null);

export function MarineWeatherHeadlineProvider(props: Readonly<{ children: ReactNode }>) {
  const { children } = props;
  const [headline, setHeadline] = useState<MarineHeadlineState>({ status: 'idle' });
  const [panelOpen, setPanelOpen] = useState(false);

  const value = useMemo(
    () => ({ headline, setHeadline, panelOpen, setPanelOpen }),
    [headline, panelOpen],
  );

  return (
    <MarineWeatherHeadlineContext.Provider value={value}>{children}</MarineWeatherHeadlineContext.Provider>
  );
}

export function useMarineWeatherHeadline() {
  const ctx = useContext(MarineWeatherHeadlineContext);
  if (!ctx) {
    throw new Error('MarineWeatherHeadlineProvider est requis.');
  }
  return ctx;
}
