import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const options = {
  scenarios: {
    payroll_batch_baseline: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m', target: 25 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
    bulk_batch_acceptance_rate: ['rate>0.99'],
    bulk_batch_latency: ['p(95)<750'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000';
const batchSize = Number(__ENV.BATCH_SIZE || '100');
const assetCode = __ENV.ASSET_CODE || 'ORGUSD';
const assetIssuer = __ENV.ASSET_ISSUER || 'G'.repeat(56);
const destination = __ENV.DESTINATION || 'G'.repeat(56);

const bulkBatchLatency = new Trend('bulk_batch_latency');
const bulkBatchAcceptanceRate = new Rate('bulk_batch_acceptance_rate');

function idempotencyKey() {
  const suffix = `${__VU}-${__ITER}-${Date.now()}`.padEnd(12, '0').slice(0, 12);
  return `00000000-0000-4000-8000-${suffix}`;
}

function buildPayments() {
  return Array.from({ length: batchSize }, (_, index) => ({
    destination,
    amount: (100 + index / 100).toFixed(2),
  }));
}

export default function () {
  const payload = JSON.stringify({
    assetCode,
    assetIssuer,
    payments: buildPayments(),
  });

  const response = http.post(`${baseUrl}/api/v1/bulk-payments/batch`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(),
    },
  });

  bulkBatchLatency.add(response.timings.duration);
  bulkBatchAcceptanceRate.add(response.status === 202);

  check(response, {
    'batch accepted': (res) => res.status === 202,
    'response has payment count': (res) => {
      const body = res.json();
      return body?.data?.paymentCount === batchSize;
    },
  });

  sleep(1);
}
