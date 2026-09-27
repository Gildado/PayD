import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..', '..');

function readBackendFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('mainnet Prometheus alert rules', () => {
  const prometheusRules = readBackendFile('prometheus/alerts/mainnet-readiness.yml');
  const grafanaRules = readBackendFile('grafana/provisioning/alerting/rules.yaml');

  it('defines payment failure, queue backlog, and Soroban RPC alerts', () => {
    expect(prometheusRules).toContain('alert: PayDPaymentFailureRateHigh');
    expect(prometheusRules).toContain('alert: PayDQueueBacklogHigh');
    expect(prometheusRules).toContain('alert: PayDSorobanRpcErrorsHigh');
  });

  it('uses backend metric names exported by the metrics module', () => {
    expect(prometheusRules).toContain('payment_operations_total{status="failed"}');
    expect(prometheusRules).toContain('payment_operations_total{status=~"success|failed"}');
    expect(prometheusRules).toContain('max(queue_depth) by (queue_name) > 1000');
    expect(prometheusRules).toContain(
      'stellar_api_duration_seconds_count{operation=~"soroban.*|rpc.*",status=~"error|failed|timeout|5.."}',
    );
  });

  it('sets mainnet-oriented severity and hold windows', () => {
    expect(prometheusRules).toMatch(/PayDPaymentFailureRateHigh[\s\S]*for: 5m[\s\S]*severity: critical/);
    expect(prometheusRules).toMatch(/PayDQueueBacklogHigh[\s\S]*for: 10m[\s\S]*severity: warning/);
    expect(prometheusRules).toMatch(/PayDSorobanRpcErrorsHigh[\s\S]*for: 5m[\s\S]*severity: critical/);
  });

  it('keeps Grafana-managed alerts in sync with Prometheus alert coverage', () => {
    expect(grafanaRules).toContain('name: mainnet_readiness_alerts');
    expect(grafanaRules).toContain('uid: payment_failure_rate_high');
    expect(grafanaRules).toContain('uid: queue_backlog_high');
    expect(grafanaRules).toContain('uid: soroban_rpc_errors_high');
  });

  it('mounts the alert rules directory into Prometheus', () => {
    const compose = readBackendFile('docker-compose.monitoring.yml');
    expect(compose).toContain('./prometheus/alerts:/etc/prometheus/alerts:ro');
  });
});
