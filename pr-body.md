## Summary

Redesigns chart visual styles and AccessibleDatePicker to use the app's design tokens with dark mode parity, plus adds animation patterns that respect `prefers-reduced-motion`.

## Changes

### Chart Color Tokens (index.css)
- Added `--chart-1` through `--chart-8` CSS custom properties for both dark and light themes
- Colors derived from existing design tokens (`--accent`, `--accent2`, semantic colors)

### Chart Animation Patterns (index.css + MOTION_PATTERNS.md)
- Added Recharts animation props helpers: `getBarAnimationProps`, `getLineAnimationProps`, `getAreaAnimationProps`, `getPieAnimationProps`
- All animations gated by `useReducedMotion()` hook
- Added CSS utility classes for reference: `.motion-chart-bar-enter`, `.motion-chart-line-enter`, `.motion-chart-area-enter`, `.motion-chart-pie-enter`
- Documented pattern in MOTION_PATTERNS.md

### PayrollAnalytics.tsx (#1379, #1380)
- Bar charts (payment success/failure, department breakdown): use `var(--chart-N)` colors + animation props
- Line/Area charts (payroll trends): use `var(--chart-1)` + gradient + animation props
- Import and use `useReducedMotion` hook

### RevenueSplitDashboard.tsx (#1381)
- Pie/Donut chart (allocation breakdown): use `var(--chart-N)` colors + animation props
- Updated tooltip to use design tokens instead of hardcoded dark colors
- Import and use `useReducedMotion` hook

### AccessibleDatePicker.tsx (#1382)
- Replaced all hardcoded colors (gray-700, dark:text-gray-300, blue-500, red-500, etc.) with CSS custom properties (`var(--text)`, `var(--muted)`, `var(--accent)`, `var(--danger)`, `var(--surface)`, `var(--border)`, `var(--surface-hi)`)
- Works correctly in both light and dark themes
- Verified at standard responsive breakpoints

## Testing
- Lint passes (pre-existing warnings only)
- TypeScript compiles without errors
- Test suite: 82 passed, 1 pre-existing failure in InfoTooltip unrelated to these changes

## Issues Addressed
- #1379: Redesign bar chart visual style
- #1380: Redesign line chart visual style
- #1381: Redesign pie/donut chart visual style
- #1382: Redesign AccessibleDatePicker to new design tokens with dark mode parity