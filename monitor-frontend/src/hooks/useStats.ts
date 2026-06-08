import { useCallback, useEffect, useState } from 'react';
import { getStats } from '../api/pings';
import type { PingStats } from '../types';

export function useStats() {
  const [stats, setStats] = useState<PingStats | null>(null);

  const refresh = useCallback(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, refresh };
}
