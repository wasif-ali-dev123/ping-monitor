import { useState } from 'react';
import type { PingRecord } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  pings: PingRecord[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  newPingId: string | null;
  onPageChange: (p: number) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function PingTable({ pings, loading, total, page, totalPages, newPingId, onPageChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-800">
          Ping history
          <span className="ml-2 text-gray-400 font-normal text-xs">{total.toLocaleString()} records</span>
        </span>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Response</th>
              <th className="px-4 py-2 font-medium hidden sm:table-cell">Request ID</th>
              <th className="px-4 py-2 font-medium hidden md:table-cell">Resource</th>
              <th className="px-4 py-2 font-medium w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pings.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No pings yet.
                </td>
              </tr>
            )}
            {pings.map((ping) => {
              const isExpanded = expanded === ping.id;
              const payload = ping.payload as Record<string, unknown>;
              const rowBg = ping.id === newPingId ? 'bg-green-50' : '';

              return (
                <>
                  <tr
                    key={ping.id}
                    onClick={() => toggle(ping.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${rowBg}`}
                  >
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      <span className="block">{formatTime(ping.createdAt)}</span>
                      <span className="block text-xs text-gray-400">{formatDate(ping.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge success={ping.success} statusCode={ping.statusCode} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      {ping.responseTime} ms
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs text-gray-400 truncate max-w-[160px]">
                      {typeof payload?.requestId === 'string' ? payload.requestId : ping.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                      {typeof payload?.resource === 'string' ? payload.resource : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs text-right pr-4">
                      {isExpanded ? '▲' : '▼'}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${ping.id}-detail`}>
                      <td colSpan={6} className="bg-gray-50 px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Payload sent</p>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-48 text-gray-700">
                              {JSON.stringify(ping.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                              {ping.success ? 'Response body' : 'Error'}
                            </p>
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-48 text-gray-700">
                              {ping.success
                                ? JSON.stringify(ping.responseBody, null, 2)
                                : (ping.errorMessage ?? 'Unknown error')}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 rounded text-xs border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded text-xs border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
