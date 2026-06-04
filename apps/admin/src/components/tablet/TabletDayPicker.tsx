import { TB } from '@/lib/tabletTheme';
import { todayIso } from '@/lib/tablet';

type Props = {
  value: string;
  onChange: (day: string) => void;
  showTodayButton?: boolean;
};

export function TabletDayPicker({ value, onChange, showTodayButton = true }: Props) {
  const isToday = value === todayIso();

  return (
    <div className="flex flex-col gap-2">
      <label className="block min-w-0 flex-1">
        <span className={TB.label}>Journée</span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={TB.input}
        />
      </label>
      {showTodayButton && !isToday ? (
        <button type="button" onClick={() => onChange(todayIso())} className={TB.btnSecondary}>
          Aujourd&apos;hui
        </button>
      ) : null}
    </div>
  );
}
