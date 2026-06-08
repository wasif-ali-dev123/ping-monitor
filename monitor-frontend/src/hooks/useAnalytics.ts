import { useEffect, useState } from 'react';
import { getAnalytics } from '../api/pings';
import type { AnalyticsData } from '../types';

export function useAnalytics(refreshTrigger: number, window: number) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAnalytics(window)
      .then((data) => { if (!cancelled) setAnalytics(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [refreshTrigger, window]);

  useEffect(() => {
    const id = setInterval(() => {
      getAnalytics(window).then(setAnalytics).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [window]);

  return { analytics, loading };
}
