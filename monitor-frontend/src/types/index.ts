export interface PingRecord {
  id: string;
  url: string;
  method: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseBody: Record<string, unknown> | null;
  responseTime: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface PaginatedPings {
  data: PingRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PingStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgResponseTime: number | null;
  minResponseTime: number | null;
  maxResponseTime: number | null;
}

export interface RollingStats {
  mean: number;
  stdDev: number;
  count: number;
}

export interface ForecastPoint {
  value: number;
  low: number;
  high: number;
}

export interface AnalyticsPoint {
  t: string;
  responseTime: number;
  isAnomaly: boolean;
  rollingMean: number;
}

export interface AnalyticsData {
  windowHours: number;
  windowStats: RollingStats;
  forecast: ForecastPoint;
  recentPoints: AnalyticsPoint[];
  anomalies: PingRecord[];
}
