import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type PageFiltersConfig = {
  title: string;
  subtitle?: string;
  activeFilterCount: number;
  panelBody: ReactNode;
};

type PageFiltersContextValue = {
  config: PageFiltersConfig | null;
  setConfig: (c: PageFiltersConfig | null) => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
};

const PageFiltersContext = createContext<PageFiltersContextValue | null>(null);

export function PageFiltersProvider(props: Readonly<{ children: ReactNode }>) {
  const { children } = props;
  const [config, setConfigState] = useState<PageFiltersConfig | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const setConfig = useCallback((c: PageFiltersConfig | null) => {
    setConfigState(c);
  }, []);
  const value = useMemo(
    () => ({ config, setConfig, filtersOpen, setFiltersOpen }),
    [config, setConfig, filtersOpen],
  );
  return <PageFiltersContext.Provider value={value}>{children}</PageFiltersContext.Provider>;
}

export function usePageFiltersControl() {
  const ctx = useContext(PageFiltersContext);
  if (!ctx) {
    throw new Error('PageFiltersProvider est requis pour le panneau de filtres.');
  }
  return ctx;
}

/** Enregistre le contenu du panneau « Filtres » pour la page courante ; nettoyage au démontage. */
export function usePageFiltersPanel(config: PageFiltersConfig | null) {
  const { setConfig } = usePageFiltersControl();
  useEffect(() => {
    setConfig(config);
    return () => setConfig(null);
  }, [setConfig, config]);
}

export function useDefaultPageFilters(title: string) {
  const cfg = useMemo<PageFiltersConfig>(
    () => ({
      title,
      subtitle: 'Aucun filtre supplémentaire dans ce panneau pour cette page.',
      activeFilterCount: 0,
      panelBody: (
        <p className="text-sm leading-relaxed text-zinc-500">
          Utilise les contrôles directement sur la page lorsqu’ils sont disponibles.
        </p>
      ),
    }),
    [title],
  );
  usePageFiltersPanel(cfg);
}
