/**
 * Chart animation utilities for Recharts components.
 *
 * These helpers return animation props that respect the user's
 * `prefers-reduced-motion` preference via the `useReducedMotion` hook.
 *
 * Reference: `frontend/src/styles/MOTION_PATTERNS.md` (#1379, #1380, #1381)
 *
 * @example
 * ```tsx
 * import { useReducedMotion } from '../hooks/useReducedMotion';
 * import { getBarAnimationProps, getLineAnimationProps } from '../utils/chartAnimation';
 *
 * const reduceMotion = useReducedMotion();
 *
 * return (
 *   <Bar
 *     dataKey="value"
 *     fill="var(--chart-1)"
 *     {...getBarAnimationProps(reduceMotion)}
 *   />
 * );
 * ```
 */

/**
 * Animation props for Recharts Bar components.
 *
 * When motion is allowed: animates bars scaling up from the baseline.
 * Duration: 400ms (--motion-duration-slow)
 * Easing: ease-out (--motion-ease-out)
 *
 * @param reducedMotion Whether animations should be disabled
 * @returns Recharts animation props object
 */
export function getBarAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      isAnimationActive: false,
    };
  }
  
  return {
    isAnimationActive: true,
    animationBegin: 0,
    animationDuration: 400, // --motion-duration-slow
    animationEasing: 'ease-out',
  };
}

/**
 * Animation props for Recharts Line components.
 *
 * When motion is allowed: animates the line drawing with stroke-dashoffset.
 * Duration: 500ms (--motion-duration-normal but slightly longer for line drawing)
 * Easing: ease-out (--motion-ease-out)
 *
 * @param reducedMotion Whether animations should be disabled
 * @returns Recharts animation props object
 */
export function getLineAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      isAnimationActive: false,
    };
  }
  
  return {
    isAnimationActive: true,
    animationBegin: 0,
    animationDuration: 500,
    animationEasing: 'ease-out',
  };
}

/**
 * Animation props for Recharts Area components.
 *
 * When motion is allowed: animates area filling from the baseline.
 * Duration: 500ms (--motion-duration-normal but slightly longer for area fill)
 * Easing: ease-out (--motion-ease-out)
 *
 * @param reducedMotion Whether animations should be disabled
 * @returns Recharts animation props object
 */
export function getAreaAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      isAnimationActive: false,
    };
  }
  
  return {
    isAnimationActive: true,
    animationBegin: 0,
    animationDuration: 500,
    animationEasing: 'ease-out',
  };
}

/**
 * Animation props for Recharts Pie components.
 *
 * When motion is allowed: animates pie segments with scale and rotation.
 * Duration: 600ms (--motion-duration-slower)
 * Easing: ease-out (--motion-ease-out)
 *
 * @param reducedMotion Whether animations should be disabled
 * @returns Recharts animation props object
 */
export function getPieAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      isAnimationActive: false,
    };
  }
  
  return {
    isAnimationActive: true,
    animationBegin: 0,
    animationDuration: 600, // --motion-duration-slower
    animationEasing: 'ease-out',
  };
}

/**
 * Animation props for Recharts CartesianGrid components.
 *
 * When motion is allowed: fades in grid lines.
 * Duration: 400ms (--motion-duration-slow)
 * Easing: ease-out (--motion-ease-out)
 *
 * @param reducedMotion Whether animations should be disabled
 * @returns Recharts animation props object
 */
export function getCartesianGridAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      isAnimationActive: false,
    };
  }
  
  return {
    isAnimationActive: true,
    animationBegin: 100, // Slight delay to let chart elements animate first
    animationDuration: 400, // --motion-duration-slow
    animationEasing: 'ease-out',
  };
}

/**
 * Helper to apply chart animations to all Recharts components in a consistent way.
 *
 * This higher-order function returns props for all common chart elements
 * (bars, lines, areas, pie segments, cartesian grid) based on the
 * reduced-motion preference.
 *
 * @example
 * ```tsx
 * const reduceMotion = useReducedMotion();
 * const chartAnimations = getChartAnimations(reduceMotion);
 *
 * return (
 *   <BarChart data={data}>
 *     <CartesianGrid {...chartAnimations.cartesianGrid} />
 *     <Bar dataKey="value" {...chartAnimations.bar} />
 *   </BarChart>
 * );
 * ```
 */
export function getChartAnimations(reducedMotion: boolean) {
  return {
    bar: getBarAnimationProps(reducedMotion),
    line: getLineAnimationProps(reducedMotion),
    area: getAreaAnimationProps(reducedMotion),
    pie: getPieAnimationProps(reducedMotion),
    cartesianGrid: getCartesianGridAnimationProps(reducedMotion),
  };
}

/**
 * Utility to check if we should use Recharts built-in animations
 * or CSS-based animations.
 *
 * Recharts animations work well for data visualization elements.
 * CSS animations (.motion-chart-* classes) are better for decorative
 * elements like tooltips and containers.
 *
 * @param reducedMotion Whether animations should be disabled
 * @returns True if Recharts animations should be used
 */
export function shouldUseRechartsAnimations(reducedMotion: boolean): boolean {
  return !reducedMotion;
}