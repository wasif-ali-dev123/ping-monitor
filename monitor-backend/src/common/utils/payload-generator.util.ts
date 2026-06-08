const VERBS = ['create', 'update', 'delete', 'fetch', 'process', 'validate'];
const RESOURCES = ['user', 'order', 'product', 'payment', 'session', 'report'];
const ENVIRONMENTS = ['production', 'staging', 'development'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

export interface GeneratedPayload {
  requestId: string;
  action: string;
  resource: string;
  environment: string;
  timestamp: string;
  metadata: {
    clientVersion: string;
    region: string;
    priority: 'low' | 'medium' | 'high';
    tags: string[];
  };
  data: Record<string, unknown>;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildData(resource: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: randInt(1000, 99999),
    name: `${resource}_${Math.random().toString(36).slice(2, 8)}`,
    active: Math.random() > 0.3,
    score: parseFloat((Math.random() * 100).toFixed(2)),
  };
  if (resource === 'user') {
    base.email = `user${randInt(1, 9999)}@example.com`;
    base.role = pick(['admin', 'editor', 'viewer']);
  } else if (resource === 'order') {
    base.amount = parseFloat((Math.random() * 500 + 10).toFixed(2));
    base.currency = pick(['USD', 'EUR', 'GBP']);
  } else if (resource === 'payment') {
    base.amount = parseFloat((Math.random() * 1000).toFixed(2));
    base.status = pick(['pending', 'completed', 'failed']);
  }
  return base;
}

export function generatePayload(): GeneratedPayload {
  const resource = pick(RESOURCES);
  const allTags = [
    'urgent',
    'scheduled',
    'manual',
    'automated',
    'retry',
    'batch',
  ];
  const tags = allTags.sort(() => Math.random() - 0.5).slice(0, randInt(1, 3));

  return {
    requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    action: pick(VERBS),
    resource,
    environment: pick(ENVIRONMENTS),
    timestamp: new Date().toISOString(),
    metadata: {
      clientVersion: `${randInt(1, 5)}.${randInt(0, 9)}.${randInt(0, 99)}`,
      region: pick(REGIONS),
      priority: pick(['low', 'medium', 'high']),
      tags,
    },
    data: buildData(resource),
  };
}
