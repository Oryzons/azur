import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeTabletCalendarRefresh } from '@/lib/tabletRealtime';
import { useCheckFlowStore, type TabletReservationRow } from '@/stores/checkFlow';

export function useTabletDayReservations(day: string) {
  const fetchTablet = useCheckFlowStore((s) => s.fetchTabletReservations);
  const [rows, setRows] = useState<TabletReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const firstLoad = useRef(true);

  const reload = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError('');
      return fetchTablet(day)
        .then((data) => {
          setRows(data);
          return data;
        })
        .catch(() => {
          setError('Impossible de charger les réservations.');
          setRows([]);
        })
        .finally(() => {
          setLoading(false);
          firstLoad.current = false;
        });
    },
    [day, fetchTablet],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onFocus = () => void reload({ silent: !firstLoad.current });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  useEffect(() => subscribeTabletCalendarRefresh(() => void reload({ silent: true })), [reload]);

  const sorted = [...rows].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return { rows: sorted, loading, error, reload };
}
