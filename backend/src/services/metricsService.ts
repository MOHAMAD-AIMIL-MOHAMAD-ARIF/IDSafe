// backend/src/services/metricsService.ts

export type MetricsSnapshot = {
  since: string;
  uptimeSeconds: number;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  statusBuckets: {
    "2xx": number;
    "3xx": number;
    "4xx": number;
    "5xx": number;
  };
};

const startedAt = Date.now();
let requestCount = 0;
let errorCount = 0;
const statusBuckets = {
  "2xx": 0,
  "3xx": 0,
  "4xx": 0,
  "5xx": 0,
};

function bucketForStatus(status: number): keyof typeof statusBuckets {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

export function recordResponse(status: number): void {
  requestCount += 1;
  if (status >= 500) errorCount += 1;
  const bucket = bucketForStatus(status);
  statusBuckets[bucket] += 1;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const errorRate = requestCount === 0 ? 0 : Number((errorCount / requestCount).toFixed(4));

  return {
    since: new Date(startedAt).toISOString(),
    uptimeSeconds,
    requestCount,
    errorCount,
    errorRate,
    statusBuckets: { ...statusBuckets },
  };
}
