# Skeleton Loader Shimmer Patterns

A standardized shimmer animation pattern across skeleton instances in PayD, providing consistent loading state visual cues that respect system themes and accessibility settings (`prefers-reduced-motion`).

## Reference Integration

- **Component**: `frontend/src/components/SkeletonLoader.tsx`
- **Global Style**: `.skeleton-shimmer` in `frontend/src/index.css`

## Key Features

1. **Theme-Aware Tokens**: Uses `--skeleton-base` and `--skeleton-highlight` CSS tokens dynamically mapped to active dark and light themes instead of hardcoded background colors.
2. **Smooth Gradient Sweep**: Uses a CSS linear-gradient background sweep keyframe (`skeletonShimmerSweep`) for a polished shimmer effect.
3. **Prefers-Reduced-Motion**: Respects `@media (prefers-reduced-motion: reduce)` by turning off keyframe animations and displaying a static token background color.
4. **Accessible markup**: Standard `role="presentation"` and `aria-hidden` attributes for screen readers.

## Usage Example

```tsx
import { SkeletonLoader } from '../components/SkeletonLoader';

// Text loading line
<SkeletonLoader variant="text" width="full" />

// Card placeholder
<SkeletonLoader variant="card" height={32} />

// Table row skeleton
<SkeletonLoader variant="table-row" count={5} columns={4} />

// Avatar skeleton
<SkeletonLoader variant="avatar" size={48} />
```

## CSS Token Specification

| Variable               | Dark Theme Value | Light Theme Value | Usage                                      |
| ---------------------- | ---------------- | ----------------- | ------------------------------------------ |
| `--skeleton-base`      | `#161b22`        | `#e1e4e8`         | Base background color of skeleton elements |
| `--skeleton-highlight` | `#30363d`        | `#d1d5da`         | Dynamic sweep highlight wave color         |
