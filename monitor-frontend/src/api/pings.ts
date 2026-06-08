import type { AnalyticsData, PaginatedPings, PingRecord, PingStats } from '../types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function getHistory(page: number, pageSize: number) {
  return get<PaginatedPings>(`/api/pings?page=${page}&pageSize=${pageSize}`);
}

export function getStats() {
  return get<PingStats>('/api/pings/stats');
}

export async function triggerPing(): Promise<PingRecord> {
  const res = await fetch('/api/pings/trigger', { method: 'POST' });
  if (!res.ok) throw new Error(`Trigger failed: ${res.status}`);
  return res.json() as Promise<PingRecord>;
}

export function getAnalytics(window = 1) {
  return get<AnalyticsData>(`/api/analytics?window=${window}`);
}
