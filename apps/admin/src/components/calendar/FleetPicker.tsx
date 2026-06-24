import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { Portal } from '@/components/Portal';

type Fleet = { id: string; name: string };

export function FleetPicker(props: Readonly<{
  fleetId: string;
  fleets: Fleet[];
  onChange: (fleetId: string) => void;
  compact?: boolean;
}>) {
  const { fleetId, fleets, onChange, compact = false } = props;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = fleets.find((f) => f.id === fleetId);
  const selectedLabel = selected?.name ?? 'Toutes les flotilles';

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(220, rect.width);
      setMenuStyle({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - width),
        width,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={[
          'bc-interactive inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-left sm:h-9 sm:gap-2 sm:px-2.5 md:px-3',
          compact ? 'max-w-[7.5rem] sm:max-w-[10rem] md:max-w-[14rem]' : 'max-w-[14rem] sm:max-w-[16rem]',
          open
            ? 'bg-white ring-2 ring-[#416B9F]/25 shadow-sm'
            : 'bg-zinc-100/80 ring-1 ring-zinc-200/80 hover:bg-zinc-100',
        ].join(' ')}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#416B9F] shadow-sm ring-1 ring-zinc-200/60">
          <Layers className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={['block truncate font-semibold uppercase tracking-wide text-zinc-400', compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'].join(' ')}>
            Flotille
          </span>
          <span className={['block truncate font-semibold text-zinc-900', compact ? 'text-xs sm:text-sm' : 'text-sm'].join(' ')}>{selectedLabel}</span>
        </span>
        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200',
            open ? 'rotate-180 text-[#416B9F]' : '',
          ].join(' ')}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open && menuStyle ? (
        <Portal>
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label="Choisir une flotille"
            className="bc-menu-enter fixed z-[250] overflow-hidden rounded-xl border border-zinc-200/90 bg-white p-1 shadow-xl shadow-zinc-400/20"
            style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
          >
            <FleetOption
              active={!fleetId}
              label="Toutes les flotilles"
              hint="Afficher tous les bateaux"
              onClick={() => pick('')}
            />
            {fleets.map((f) => (
              <FleetOption
                key={f.id}
                active={fleetId === f.id}
                label={f.name}
                onClick={() => pick(f.id)}
              />
            ))}
          </div>
        </Portal>
      ) : null}
    </>
  );
}

function FleetOption(props: Readonly<{
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}>) {
  const { active, label, hint, onClick } = props;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition',
        active ? 'bg-[#416B9F]/10 text-[#416B9F]' : 'text-zinc-800 hover:bg-zinc-50',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition',
          active ? 'bg-[#416B9F] text-white' : 'bg-zinc-100 text-transparent',
        ].join(' ')}
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        {hint ? <span className="block truncate text-[11px] text-zinc-500">{hint}</span> : null}
      </span>
    </button>
  );
}
