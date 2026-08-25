# Design Tokens Specification

This document outlines the core Design Token Layer for PayD. It standardizes colors, typography, chart visualization palettes, surfaces, and dark/light mode behavior across all frontend pages and components.

## Reference Integration

- **Page**: `frontend/src/pages/PayrollAnalytics.tsx`
- **Stylesheet**: `frontend/src/index.css`

## Chart Palette Tokens

Chart components (Recharts, SVG analytics, micro-visualizations) must consume these semantic `--chart-*` tokens instead of hardcoded hex values to maintain legibility and theme adaptation.

| Token | Dark Theme | Light Theme | Typical Use Case |
| --- | --- | --- | --- |
| `--chart-1` | `#6366f1` (Indigo) | `#4f46e5` | Primary metric line / area series |
| `--chart-2` | `#22d3ee` (Cyan) | `#0891b2` | Secondary comparison series |
| `--chart-3` | `#f59e0b` (Amber) | `#d97706` | Status / warning / tertiary distribution |
| `--chart-4` | `#34d399` (Emerald) | `#059669` | Success / positive trends |
| `--chart-5` | `#f87171` (Rose) | `#dc2626` | Error / negative trends |

## Theme Tokens & Surfaces

| Token | Dark Theme | Light Theme | Role |
| --- | --- | --- | --- |
| `--bg` | `#080b10` | `#f6f8fa` | Application background |
| `--surface` | `#0d1117` | `#ffffff` | Standard card surface |
| `--surface-hi` | `#161b22` | `#f0f2f5` | Elevated container surface |
| `--border` | `rgba(255, 255, 255, 0.07)` | `rgba(0, 0, 0, 0.08)` | Subdued container border |
| `--border-hi` | `rgba(255, 255, 255, 0.14)` | `rgba(0, 0, 0, 0.15)` | High-contrast divider border |

## Recharts Integration Pattern

```tsx
<Line
  type="monotone"
  dataKey="total"
  stroke="var(--chart-1)"
  dot={{ r: 4, fill: 'var(--chart-1)' }}
/>
```
