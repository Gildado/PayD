# Natural-Language Query Interface over Payroll Data: Output Schema & Specification

## Overview
Org admins can ask questions about payroll data in plain language (e.g., "show failed transactions", "show payouts in USDC", "search EMP-001"). An agent-generated report processes the query against CustomReportBuilder payroll records and surfaces structured insights.

## Output Schema Format (`NaturalLanguageQueryResponse`)
```json
{
  "query": "string",
  "matchedCount": 0,
  "summaryText": "string",
  "data": [
    {
      "txHash": "string",
      "sourceAccount": "string",
      "amount": "string",
      "assetCode": "string",
      "successful": true,
      "timestamp": 1704067200,
      "employeeId": "string"
    }
  ],
  "aggregates": {
    "totalAmount": 0.0,
    "successCount": 0,
    "failedCount": 0,
    "assetBreakdown": {
      "USDC": 0.0
    }
  },
  "schemaVersion": "1.0"
}
```

## Entry Point
Accessible in `CustomReportBuilder.tsx` via the Natural-Language Payroll Query Assistant card.
