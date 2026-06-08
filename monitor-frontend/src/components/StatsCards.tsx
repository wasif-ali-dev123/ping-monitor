import type { PingStats } from '../types';

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-semibold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export function StatsCards({ stats }: { stats: PingStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card label="Total pings" value={stats.total.toLocaleString()} />
      <Card
        label="Success rate"
        value={`${stats.successRate}%`}
        sub={`${stats.successful} ok · ${stats.failed} failed`}
      />
      <Card
        label="Avg response"
        value={stats.avgResponseTime != null ? `${stats.avgResponseTime} ms` : '—'}
      />
      <Card
        label="Min / Max"
        value={
          stats.minResponseTime != null
            ? `${stats.minResponseTime} / ${stats.maxResponseTime} ms`
            : '—'
        }
      />
    </div>
  );
}
