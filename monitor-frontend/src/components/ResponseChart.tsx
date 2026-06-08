import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsData, AnalyticsPoint } from '../types';

const WINDOWS = [1, 6, 12, 24] as const;

interface Props {
  analytics: AnalyticsData;
  window: number;
  onWindowChange: (w: number) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CustomDot(props: { cx?: number; cy?: number; payload?: AnalyticsPoint }) {
  const { cx, cy, payload } = props;
  if (!payload?.isAnomaly || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />;
}

export function ResponseChart({ analytics, window, onWindowChange }: Props) {
  const { recentPoints, forecast, windowStats } = analytics;

  const chartData = recentPoints.map((p) => ({
    ...p,
    label: formatTime(p.t),
    forecastLow: forecast.low,
    forecastHigh: forecast.high,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <span className="text-sm font-medium text-gray-800">Response times</span>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{window} h avg: <strong className="text-gray-700">{windowStats.mean} ms</strong></span>
            <span>σ: <strong className="text-gray-700">{windowStats.stdDev} ms</strong></span>
            <span>Forecast: <strong className="text-indigo-600">{forecast.value} ms</strong></span>
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => onWindowChange(w)}
                className={`px-2.5 py-1 transition-colors ${
                  window === w
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {w} h
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            unit=" ms"
            width={52}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
            formatter={(value: unknown, name: unknown) => {
              const labels: Record<string, string> = {
                responseTime: 'Response',
                rollingMean: `${window} h avg`,
                forecastHigh: 'Band high',
                forecastLow: 'Band low',
              };
              const key = String(name);
              return [`${value as number} ms`, labels[key] ?? key];
            }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                responseTime: 'Response time',
                rollingMean: `${window} h rolling avg`,
                forecastHigh: 'Confidence band',
              };
              return labels[value] ?? value;
            }}
          />

          <Area dataKey="forecastHigh" fill="#e0e7ff" stroke="none" legendType="none" isAnimationActive={false} />
          <Area dataKey="forecastLow" fill="#fff" stroke="none" legendType="none" fillOpacity={1} isAnimationActive={false} />

          <Line dataKey="rollingMean" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} isAnimationActive={false} />

          <ReferenceLine
            y={forecast.value}
            stroke="#6366f1"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: 'forecast', position: 'insideTopRight', fontSize: 10, fill: '#6366f1' }}
          />

          <Line
            dataKey="responseTime"
            stroke="#64748b"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />

          <Scatter
            dataKey="responseTime"
            fill="#ef4444"
            legendType="circle"
            name="Anomaly"
            data={chartData.filter((p) => p.isAnomaly)}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
