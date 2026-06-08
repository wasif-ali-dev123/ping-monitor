import { useRef, useState } from 'react';
import { triggerPing } from './api/pings';
import { ConnectionBadge } from './components/ConnectionBadge';
import { PingTable } from './components/PingTable';
import { ResponseChart } from './components/ResponseChart';
import { StatsCards } from './components/StatsCards';
import { useAnalytics } from './hooks/useAnalytics';
import { usePings } from './hooks/usePings';
import { useSocket } from './hooks/useSocket';
import { useStats } from './hooks/useStats';
import type { PingRecord } from './types';

export default function App() {
  const { pings, total, totalPages, page, setPage, loading, error, prependPing } = usePings();
  const { stats, refresh: refreshStats } = useStats();

  const [newPingId, setNewPingId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [anomalyAlert, setAnomalyAlert] = useState<PingRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [analyticsWindow, setAnalyticsWindow] = useState(1);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { analytics } = useAnalytics(refreshTrigger, analyticsWindow);

  function handleNewPing(record: PingRecord) {
    prependPing(record);
    refreshStats();
    setRefreshTrigger((n) => n + 1);
    setNewPingId(record.id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setNewPingId(null), 3000);
  }

  function handleAnomaly(record: PingRecord) {
    setAnomalyAlert(record);
  }

  const socketStatus = useSocket(handleNewPing, handleAnomaly);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerError(null);
    try {
      await triggerPing();
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">HTTP Monitor</span>
            <span className="hidden sm:block text-xs text-gray-400">httpbin.org/anything · every 5 min</span>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionBadge status={socketStatus} />
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {triggering ? 'Pinging…' : 'Ping now'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {anomalyAlert && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-4">
            <span>
              Anomaly detected — ping <code className="font-mono text-xs">{anomalyAlert.id.slice(0, 8)}</code> responded
              in <strong>{anomalyAlert.responseTime} ms</strong>, which is statistically unusual.
            </span>
            <button
              onClick={() => setAnomalyAlert(null)}
              className="text-red-400 hover:text-red-600 shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}

        {(error || triggerError) && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error ?? triggerError}
          </div>
        )}

        <StatsCards stats={stats} />

        {analytics && (
          <ResponseChart
            analytics={analytics}
            window={analyticsWindow}
            onWindowChange={setAnalyticsWindow}
          />
        )}

        <PingTable
          pings={pings}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          newPingId={newPingId}
          onPageChange={setPage}
        />
      </main>
    </div>
  );
}
