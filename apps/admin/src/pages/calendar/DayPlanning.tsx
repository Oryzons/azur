import { useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import {
  assignLanes,
  BOAT_COL_W,
  CALENDAR_BOAT_ROW_DRAG_MIME,
  clamp,
  minutesSince,
  minutesToHHmmFrom,
  overlaps,
  ROW_H,
  segmentLabel,
  SLOT_COL_W,
  startOfDay,
} from '@/pages/calendar/calendarConstants';
import { ReservationPill } from '@/pages/calendar/ReservationPill';
import { UnavailabilityPill } from '@/components/calendar/UnavailabilityPill';
import { isReservationLockedFromReservation } from '@/lib/reservationLock';
import { unavailabilitiesForBoatPeriod } from '@/lib/planningUnavailability';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import type { BoatUnavailability } from '@/stores/unavailabilities';
import { BoatCoverAvatar } from '@/components/media/BoatCoverAvatar';

export function DayPlanning(props: Readonly<{
  boats: { id: string; name: string; meta?: string; coverPhotoUrl?: string | null }[];
  reservations: Reservation[];
  day: Date;
  onMove: React.Dispatch<React.SetStateAction<Reservation[]>>;
  onCreate: (boatId: string, day: Date, times?: Readonly<{ startTime: string; endTime: string }>) => void;
  readOnly?: boolean;
  onOpenReservation?: (id: string) => void;
  onReorderBoatRows?: (fromIndex: number, toIndex: number) => void;
  unavailabilities?: BoatUnavailability[];
  onOpenUnavailability?: (item: BoatUnavailability) => void;
  highlightDay?: Date;
}>) {
  const {
    boats,
    reservations,
    day,
    onMove,
    onCreate,
    readOnly,
    onOpenReservation,
    onReorderBoatRows,
    unavailabilities = [],
    onOpenUnavailability,
    highlightDay,
  } = props;
  const ro = Boolean(readOnly);
  const canReorderBoats = Boolean(onReorderBoatRows) && !ro;

  function updateReservation(id: string, patch: Partial<Reservation>) {
    onMove((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const start = useMemo(() => {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    d.setHours(6, 0, 0, 0);
    return d;
  }, [day]);

  const end = useMemo(() => {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    d.setHours(22, 0, 0, 0);
    return d;
  }, [day]);

  const slots = useMemo(() => {
    const totalMin = minutesSince(start, end);
    const step = 15;
    const cols = Math.ceil(totalMin / step);
    const labels: { col: number; label: string }[] = [];
    for (let m = 0; m <= totalMin; m += 60) {
      const t = new Date(start.getTime() + m * 60000);
      const col = Math.floor(m / step) + 1;
      labels.push({ col, label: `${String(t.getHours()).padStart(2, '0')}:00` });
    }
    return { cols, step, totalMin, labels };
  }, [end, start]);

  const periodStart = start;
  const periodEnd = end;

  const dayHighlighted = highlightDay
    ? startOfDay(highlightDay).getTime() === startOfDay(day).getTime()
    : false;

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <div className="overflow-x-auto scroll-smooth">
        <div style={{ minWidth: BOAT_COL_W + slots.cols * SLOT_COL_W }}>
          <div className="sticky top-0 z-30 flex bg-white">
            <div
              className="sticky left-0 z-20 shrink-0 border-b border-r border-zinc-200/90 bg-white shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)]"
              style={{ width: BOAT_COL_W }}
            >
              <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Bateaux</div>
            </div>
            <div className="flex-1 border-b border-zinc-200/90">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${slots.cols}, ${SLOT_COL_W}px)` }}>
                {slots.labels.map((l) => (
                  <div
                    key={l.col}
                    className="px-2 py-3 text-[11px] font-semibold text-zinc-400"
                    style={{ gridColumn: `${l.col} / span 4` }}
                  >
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="divide-y divide-zinc-200/80">
            {boats.map((boat, rowIndex) => {
              const rowRes = reservations.filter(
                (r) => r.boatId === boat.id && overlaps(r.start, r.end, periodStart, periodEnd),
              );
              const rowUnavail = unavailabilitiesForBoatPeriod(
                unavailabilities,
                boat.id,
                periodStart,
                periodEnd,
              );
              type DaySeg =
                | { kind: 'reservation'; id: string; colStart: number; colEnd: number; r: Reservation }
                | { kind: 'unavailability'; id: string; colStart: number; colEnd: number; u: BoatUnavailability };

              const rowSegs: DaySeg[] = [
                ...rowRes.map((r) => {
                  const startMin = clamp(minutesSince(start, r.start), 0, slots.totalMin);
                  const endMin = clamp(minutesSince(start, r.end), 0, slots.totalMin);
                  const colStart = Math.floor(startMin / slots.step);
                  const colEnd = Math.max(colStart + 1, Math.ceil(endMin / slots.step));
                  return { kind: 'reservation' as const, id: r.id, colStart, colEnd, r };
                }),
                ...rowUnavail.map((u) => {
                  const uStart = new Date(u.startAt);
                  const uEnd = new Date(u.endAt);
                  const startMin = clamp((uStart.getTime() - start.getTime()) / 60000, 0, slots.totalMin);
                  const endMin = clamp((uEnd.getTime() - start.getTime()) / 60000, 0, slots.totalMin);
                  const colStart = Math.floor(startMin / slots.step);
                  const colEnd = Math.max(colStart + 1, Math.ceil(endMin / slots.step));
                  return { kind: 'unavailability' as const, id: u.id, colStart, colEnd, u };
                }),
              ].sort((a, b) => a.colStart - b.colStart || a.colEnd - b.colEnd);

              const laneInfo = assignLanes(
                rowSegs,
                (s) => s.colStart,
                (s) => s.colEnd,
              );
              const laneCount = Math.max(1, laneInfo.lanes);
              const gap = 0;
              const barH = Math.max(18, Math.floor(ROW_H / laneCount));
              return (
                <div key={boat.id} className="flex">
                  <div
                    className="sticky left-0 z-20 shrink-0 border-r border-zinc-200/90 bg-white shadow-[4px_0_12px_-4px_rgba(0,0,0,0.06)]"
                    style={{ width: BOAT_COL_W, height: ROW_H }}
                    onDragOver={
                      canReorderBoats
                        ? (e) => {
                            if (!e.dataTransfer.types.includes(CALENDAR_BOAT_ROW_DRAG_MIME)) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        : undefined
                    }
                    onDrop={
                      canReorderBoats
                        ? (e) => {
                            const raw = e.dataTransfer.getData(CALENDAR_BOAT_ROW_DRAG_MIME);
                            if (raw === '') return;
                            const from = Number.parseInt(raw, 10);
                            if (Number.isNaN(from)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            onReorderBoatRows?.(from, rowIndex);
                          }
                        : undefined
                    }
                  >
                    <div className="flex h-full items-center gap-2 px-2 sm:gap-3 sm:px-4">
                      {canReorderBoats ? (
                        <button
                          type="button"
                          draggable
                          title="Glisser-déposer pour réordonner les lignes"
                          aria-label="Réordonner cette ligne de bateau"
                          className="flex shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg border-0 bg-transparent p-0 py-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 active:cursor-grabbing"
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(CALENDAR_BOAT_ROW_DRAG_MIME, String(rowIndex));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                        >
                          <GripVertical className="h-5 w-5" strokeWidth={1.75} />
                        </button>
                      ) : null}
                      <BoatCoverAvatar url={boat.coverPhotoUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900">{boat.name}</p>
                        {boat.meta ? <p className="truncate text-xs text-zinc-400">{boat.meta}</p> : null}
                      </div>
                    </div>
                  </div>

                  <div
                    className={[
                      'relative z-0 flex-1',
                      dayHighlighted ? 'bg-[#416B9F]/6 ring-1 ring-inset ring-[#416B9F]/20' : '',
                    ].join(' ')}
                    style={{ height: ROW_H }}
                    onClickCapture={(e) => {
                            const t = e.target as HTMLElement | null;
                            if (t?.closest('[data-reservation-pill]')) return;
                            if (t?.closest('[data-unavailability-pill]')) return;
                            const host = e.currentTarget;
                            const scrollHost = host.closest('.overflow-x-auto');
                            const scrollLeft = scrollHost?.scrollLeft ?? 0;
                            const rect = host.getBoundingClientRect();
                            const x = (e as unknown as MouseEvent).clientX - rect.left + scrollLeft;
                            const slotIndex = clamp(Math.floor(x / SLOT_COL_W), 0, slots.cols - 1);
                            const startMin = slotIndex * slots.step;
                            let endMin = Math.min(startMin + 120, slots.totalMin);
                            if (endMin <= startMin) endMin = Math.min(startMin + slots.step, slots.totalMin);
                            onCreate(boat.id, day, {
                              startTime: minutesToHHmmFrom(start, startMin),
                              endTime: minutesToHHmmFrom(start, endMin),
                            });
                          }}
                  >
                    <section
                      className="absolute inset-0"
                      onDragOver={ro ? undefined : (e) => e.preventDefault()}
                      onDrop={
                        ro
                          ? undefined
                          : (e) => {
                              if (e.dataTransfer.types.includes(CALENDAR_BOAT_ROW_DRAG_MIME)) {
                                e.preventDefault();
                                return;
                              }
                              const id = e.dataTransfer.getData('text/reservationId');
                              if (!id) return;
                              const scrollHost = e.currentTarget.closest('.overflow-auto');
                              const scrollLeft = scrollHost?.scrollLeft ?? 0;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left + scrollLeft;
                              const slotIndex = clamp(Math.floor(x / SLOT_COL_W), 0, slots.cols - 1);
                              const minutes = slotIndex * slots.step;

                              const dragged = reservations.find((r) => r.id === id);
                              if (!dragged) return;
                              const durationMin = Math.max(
                                15,
                                Math.round((dragged.end.getTime() - dragged.start.getTime()) / 60000),
                              );

                              const newStart = new Date(start.getTime() + minutes * 60000);
                              const newEnd = new Date(newStart.getTime() + durationMin * 60000);
                              updateReservation(id, { boatId: boat.id, start: newStart, end: newEnd });
                            }
                      }
                      aria-label={`Planning ${boat.name}`}
                    >
                      <div
                        className="grid h-full"
                        style={{ gridTemplateColumns: `repeat(${slots.cols}, ${SLOT_COL_W}px)` }}
                      >
                        {Array.from({ length: slots.cols }, (_, i) => (
                          <div key={i} className="h-full border-l border-zinc-100" />
                        ))}
                      </div>
                    </section>

                    <div className="absolute inset-0 overflow-hidden">
                      <div className="relative h-full" style={{ width: slots.cols * SLOT_COL_W }}>
                        {rowSegs.map((seg, i) => {
                          const lane = laneInfo.laneByIndex[i] ?? 0;
                          const top = lane * (barH + gap);

                          if (seg.kind === 'reservation') {
                            const r = seg.r;
                            const startMin = clamp((r.start.getTime() - start.getTime()) / 60000, 0, slots.totalMin);
                            const endMin = clamp((r.end.getTime() - start.getTime()) / 60000, 0, slots.totalMin);
                            const left = (startMin / slots.step) * SLOT_COL_W;
                            const width = Math.max(SLOT_COL_W, ((endMin - startMin) / slots.step) * SLOT_COL_W);

                            return (
                              <div
                                key={seg.id}
                                className="absolute min-w-0"
                                style={{ left, width, top, height: barH }}
                              >
                                <ReservationPill
                                  reservation={r}
                                  label={segmentLabel(r, 'day')}
                                  height={barH}
                                  draggable={!ro && !isReservationLockedFromReservation(r)}
                                  onClick={onOpenReservation ? () => onOpenReservation(r.id) : undefined}
                                  className="pointer-events-auto flex h-full w-full min-w-0 items-center rounded-lg px-2 text-left text-[11px] font-semibold text-white shadow-sm"
                                />
                              </div>
                            );
                          }

                          const u = seg.u;
                          const uStart = new Date(u.startAt);
                          const uEnd = new Date(u.endAt);
                          const startMin = clamp((uStart.getTime() - start.getTime()) / 60000, 0, slots.totalMin);
                          const endMin = clamp((uEnd.getTime() - start.getTime()) / 60000, 0, slots.totalMin);
                          const left = (startMin / slots.step) * SLOT_COL_W;
                          const width = Math.max(SLOT_COL_W, ((endMin - startMin) / slots.step) * SLOT_COL_W);

                          return (
                            <div
                              key={seg.id}
                              className="absolute min-w-0"
                              style={{ left, width, top, height: barH }}
                            >
                              <UnavailabilityPill
                                item={u}
                                label={u.title}
                                height={barH}
                                onClick={onOpenUnavailability ? () => onOpenUnavailability(u) : undefined}
                                className="pointer-events-auto flex h-full w-full min-w-0 items-center rounded-lg px-2 text-left text-[11px] font-semibold text-white shadow-sm"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
