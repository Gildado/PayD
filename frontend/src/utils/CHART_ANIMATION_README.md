# Chart Animation Utilities

Reusable animation helpers for Recharts components that respect `prefers-reduced-motion`.

## Installation & Usage

The utilities are available in `src/utils/chartAnimation.ts`:

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  getBarAnimationProps,
  getLineAnimationProps,
  getAreaAnimationProps,
  getPieAnimationProps,
  getCartesianGridAnimationProps,
  getChartAnimations,
} from '../utils/chartAnimation';

const reduceMotion = useReducedMotion();
```

## Available Helpers

### Individual Component Helpers

- `getBarAnimationProps(reducedMotion)` - For `<Bar>` components
- `getLineAnimationProps(reducedMotion)` - For `<Line>` components  
- `getAreaAnimationProps(reducedMotion)` - For `<Area>` components
- `getPieAnimationProps(reducedMotion)` - For `<Pie>` components
- `getCartesianGridAnimationProps(reducedMotion)` - For `<CartesianGrid>` components

### Bulk Helper

- `getChartAnimations(reducedMotion)` - Returns all animation props in one object:
  ```tsx
  const animations = getChartAnimations(reduceMotion);
  // animations.bar, animations.line, animations.area, animations.pie, animations.cartesianGrid
  ```

## Usage Examples

### Basic Usage

```tsx
<Bar
  dataKey="value"
  fill="var(--chart-1)"
  {...getBarAnimationProps(reduceMotion)}
/>
```

### With All Chart Elements

```tsx
<BarChart data={data}>
  <CartesianGrid strokeDasharray="3 3" opacity={0.2} {...getCartesianGridAnimationProps(reduceMotion)} />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar dataKey="success" fill="var(--chart-2)" {...getBarAnimationProps(reduceMotion)} />
  <Bar dataKey="failure" fill="var(--chart-5)" {...getBarAnimationProps(reduceMotion)} />
</BarChart>
```

### Using Bulk Helper

```tsx
const animations = getChartAnimations(reduceMotion);

<BarChart data={data}>
  <CartesianGrid {...animations.cartesianGrid} />
  <Bar dataKey="value" {...animations.bar} />
</BarChart>
```

## Animation Details

| Chart Type | Duration | Easing | Description |
|------------|----------|---------|-------------|
| Bar | 400ms (`--motion-duration-slow`) | `ease-out` | Bars scale up from baseline |
| Line | 500ms | `ease-out` | Line draws with stroke-dashoffset |
| Area | 500ms | `ease-out` | Area fills from baseline |
| Pie | 600ms (`--motion-duration-slower`) | `ease-out` | Segments scale and rotate |
| CartesianGrid | 400ms (`--motion-duration-slow`) | `ease-out` | Grid lines fade in |

## Color Tokens

Always use CSS custom properties for chart colors instead of hardcoded hex values:

```css
/* Available in both themes */
--chart-1: var(--accent);    /* Primary brand color */
--chart-2: var(--accent2);   /* Secondary brand color */
--chart-3: #f59e0b;         /* Amber/warning */
--chart-4: #34d399;         /* Emerald/success */
--chart-5: #f87171;         /* Red/danger */
--chart-6: #a78bfa;         /* Purple */
--chart-7: #60a5fa;         /* Blue */
--chart-8: #f97316;         /* Orange */
```

Light theme variants use darker shades for better contrast.

## Respecting `prefers-reduced-motion`

All helpers automatically disable animations when `reducedMotion` is `true`:

```tsx
// When prefers-reduced-motion is set:
// getBarAnimationProps(true) returns { isAnimationActive: false }
// Result: No animation plays
```

## Reference Integration

See `src/pages/PayrollAnalytics.tsx` for a complete implementation example with:
- Line/Area charts (payroll trends)
- Pie chart (currency breakdown)  
- Bar charts (payment metrics, department distribution)

## Best Practices

1. **Always import `useReducedMotion`** - Get the current user preference
2. **Use CSS custom properties** - Never hardcode chart colors
3. **Spread animation props** - Use `{...getBarAnimationProps(reduceMotion)}` syntax
4. **Test both states** - Verify animations work and respect reduced motion preference
5. **Update colors** - Replace hardcoded hex values with `var(--chart-N)` tokens