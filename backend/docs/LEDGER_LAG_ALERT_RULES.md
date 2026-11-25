# Ledger Lag Alert Rules

## Overview

This document defines alerting thresholds for the ledger lag gauge (`payd_ledger_lag_seconds`), which measures the lag between the Stellar network's latest ledger and the last ledger observed by PayD's ledger observer service.

## Why Monitor Ledger Lag

Ledger lag indicates:
- **Network health**: Increasing lag suggests network congestion or instability
- **Payment processing risk**: Higher lag increases the likelihood of `bad_seq` errors and stale transaction failures
- **Observability**: Lag directly impacts the timeliness of trustline state updates and payment confirmations

Lag is calculated as:
```
lag_seconds = (network_latest_ledger - observed_latest_ledger) * 5 seconds
```

Each Stellar ledger closes approximately every 5 seconds.

## Alert Rules

### Warning: Lag > 30 seconds

**Threshold**: `payd_ledger_lag_seconds > 30`

**Severity**: Warning

**Recommended Action**:
- Check Stellar network status (https://stellar.expert/explorer)
- Review PayD logs for stream errors or connection issues
- Consider rate-limiting new payment submissions
- Monitor closely for escalation to critical

**Example Alert Text**:
> Stellar ledger lag is 30+ seconds. Latest network ledger is {network_ledger}, but we've only observed up to {observed_ledger}. Payment processing latency may increase.

---

### Critical: Lag > 120 seconds

**Threshold**: `payd_ledger_lag_seconds > 120`

**Severity**: Critical

**Recommended Action**:
- **Immediately** check Stellar network status
- Review PayD's ledger observer stream for errors
- Restart ledger observer if stuck: `POST /api/health/ledger-observer/restart`
- Consider pausing critical payments until lag recovers
- Page on-call engineer if lag persists > 5 minutes

**Example Alert Text**:
> Critical: Stellar ledger lag exceeds 2 minutes. Payment processing is significantly delayed. Investigate network status and PayD observer logs immediately.

---

## Monitoring

### Prometheus Query

View current lag:
```promql
payd_ledger_lag_seconds{network="public"}
```

View lag over time:
```promql
rate(payd_ledger_lag_seconds[5m])
```

### Grafana Dashboard

A sample dashboard panel for ledger lag:

```json
{
  "title": "Ledger Lag",
  "targets": [
    {
      "expr": "payd_ledger_lag_seconds{network=\"public\"}",
      "legendFormat": "Lag (seconds)"
    }
  ],
  "thresholds": [
    {
      "value": 30,
      "color": "yellow"
    },
    {
      "value": 120,
      "color": "red"
    }
  ]
}
```

### Health Check Endpoint

Lag is included in the ledger observer health status:

```bash
GET /api/health/ledger-observer
```

Response:
```json
{
  "running": true,
  "watchedAddresses": 1250,
  "lastCursor": "1234567890-0",
  "network": "public",
  "ledgerLag": {
    "lagSeconds": 15,
    "lagBlocks": 3,
    "networkLedger": 50_000_000,
    "observedLedger": 49_999_997
  }
}
```

---

## Troubleshooting

### High Lag but Stellar Network is Healthy

**Causes**:
- PayD's ledger observer stream is stuck or disconnected
- Network connectivity issue between PayD and Horizon
- Database bottleneck preventing stream processing

**Steps**:
1. Check PayD logs for stream errors: `grep "stream error" logs/app.log`
2. Verify Horizon connectivity: `curl https://horizon.stellar.org/`
3. Restart observer: `POST /api/health/ledger-observer/restart`
4. Monitor lag recovery

### Persistent High Lag

**Causes**:
- Stellar network experiencing congestion
- Horizon instance is overloaded
- PayD database cannot keep up with stream volume

**Steps**:
1. Check Stellar dashboard: https://stellar.expert/explorer
2. Scale PayD database if needed
3. Consider using a private Horizon instance
4. Increase observer stream buffer size in config

---

## References

- [Stellar Ledger Documentation](https://developers.stellar.org/docs/glossary/ledger)
- [PayD Architecture](../ARCHITECTURE_DIAGRAM.md)
- [Ledger Observer Service](../src/services/ledgerObserverService.ts)
