import { useCallback, useEffect, useState } from 'react';
import { getHistory } from '../api/pings';
import type { PingRecord } from '../types';

const PAGE_SIZE = 20;

export function usePings() {
  const [pings, setPings] = useState<PingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getHistory(page, PAGE_SIZE)
      .then((res) => {
        setPings(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load pings');
      })
      .finally(() => setLoading(false));
  }, [page]);

  const prependPing = useCallback((record: PingRecord) => {
    
    // only update the visible list when the user is on page 1
    if (page !== 1) return;
    setPings((prev) => [record, ...prev].slice(0, PAGE_SIZE));
    setTotal((t) => t + 1);
  }, [page]);

  return { pings, total, totalPages, page, setPage, loading, error, prependPing };
}
