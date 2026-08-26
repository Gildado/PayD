# Motion Patterns

A shared system for the small interaction animations that make PayD feel
finished: success/confirmation feedback, collapsible panels, route-change
transitions, tooltip/popover timing, and chart entrance animations. It exists
so each new "add an animation to X" issue reuses the same tokens, primitives,
and reduced-motion behavior instead of inventing a one-off.

This doc covers the pattern implemented for #1373, #1374, #1375, #1376, and
the follow-up batch #1362, #1364, #1365, #1366, plus notification badge
attention. Each of those issues ships
one reference integration; migrating every other usage in the app is
tracked separately per component. The second batch (#1358, #1359, #1360,
#1363) extends the same system to page transitions, skeleton loaders,
toast notifications, and a centralized reduced-motion context.
This doc covers the pattern implemented for #1373, #1374, #1375, #1376,
#1379, #1380, #1381, and the follow-up batch #1362, #1364, #1365, #1366.
The second batch (#1358, #1359, #1360, #1363) extends the same system to page
transitions, skeleton loaders, toast notifications, and a centralized
reduced-motion context. Each of those issues ships one reference integration;
migrating every other usage in the app is tracked separately per component.

## Building blocks

### 1. Motion tokens (`src/index.css`)

Durations and easings are CSS custom properties defined once per theme in
`:root` / `[data-theme='dark']` / `[data-theme='light']`:

```css
--motion-duration-instant: 50ms;
--motion-duration-fast: 150ms;
--motion-duration-normal: 250ms;
--motion-duration-slow: 400ms;
--motion-duration-slower: 600ms;

--motion-ease-linear: linear;
--motion-ease-in: cubic-bezier(0.4, 0, 1, 1);
--motion-ease-out: cubic-bezier(0, 0, 0.2, 1);
--motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--motion-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

Always animate with these tokens (`var(--motion-duration-fast)`, etc.)
rather than a hardcoded `200ms` — that's what "standardize timing" (#1376)
means in practice: one vocabulary of speeds, reused everywhere.

Rough guidance on which duration to reach for:

| Token              | Use for                                           |
| ------------------ | ------------------------------------------------- |
| `instant` / `fast` | hover/focus states, tooltip and popover entrances |
| `normal`           | route/list transitions, panel collapse/expand     |
| `slow` / `slower`  | success/confirmation feedback (deserves a beat)   |

### 2. Shared keyframes and utility classes (`src/index.css`)

A block near the bottom of `index.css` (search `Shared motion system`)
defines reusable, theme-agnostic classes:

| Class                   | Purpose                                                          | Used by (#issue) |
| ----------------------- | ---------------------------------------------------------------- | ---------------- |
| `.motion-success-badge` | pop-in container for a success icon                              | #1373            |
| `.motion-success-icon`  | slight-delayed scale-in for the icon itself                      | #1373            |
| `.motion-success-ring`  | expanding/fading ring behind the badge                           | #1373            |
| `.motion-collapse`      | width/padding transition for collapsible panels                  | #1374            |
| `.motion-collapse-fade` | opacity/max-width transition for labels that hide when collapsed | #1374            |
| `.motion-route-in`      | fade + slide-in for content that should replay per navigation    | #1375            |
| `.motion-popover`       | standard tooltip/popover entrance (scale + fade)                 | #1376            |
| `.motion-error-message` | shake + fade-in for a validation error message on appearance     | #1366            |
| `.motion-error-icon`    | pop-in for the error icon(s) paired with a validation error      | #1366            |
| `.motion-theme-icon`    | rotate + scale-in swap for the light/dark toggle icon            | #1365            |
| `.motion-notification-badge` | count badge entrance and attention pulse                      | notification badge |
| `.motion-notification-badge-ping` | expanding ring behind an unread count badge             | notification badge |
| `.motion-page-enter`    | fade + translateY page entrance for route transitions            | #1358            |
| `.motion-toast-enter`   | slide-in + fade for toast notifications                          | #1360            |
| `.motion-toast-exit`    | slide-out + fade for toast dismissal                             | #1360            |
| Class                      | Purpose                                                          | Used by (#issue)    |
| -------------------------- | ---------------------------------------------------------------- | ------------------- |
| `.motion-success-badge`    | pop-in container for a success icon                              | #1373               |
| `.motion-success-icon`     | slight-delayed scale-in for the icon itself                      | #1373               |
| `.motion-success-ring`     | expanding/fading ring behind the badge                           | #1373               |
| `.motion-collapse`         | width/padding transition for collapsible panels                  | #1374               |
| `.motion-collapse-fade`    | opacity/max-width transition for labels that hide when collapsed | #1374               |
| `.motion-route-in`         | fade + slide-in for content that should replay per navigation    | #1375               |
| `.motion-popover`          | standard tooltip/popover entrance (scale + fade)                 | #1376               |
| `.motion-chart-bar-enter`  | bar chart entrance (scaleY from bottom)                          | #1379               |
| `.motion-chart-line-enter` | line chart entrance (stroke-dashoffset)                          | #1380               |
| `.motion-chart-area-enter` | area chart entrance (scaleY from bottom)                         | #1380               |
| `.motion-chart-pie-enter`  | pie/donut chart entrance (scale + rotate)                        | #1381               |
| `.motion-chart-tooltip`    | chart tooltip entrance (scale + fade)                            | #1379, #1380, #1381 |
| `.motion-error-message`    | shake + fade-in for a validation error message on appearance     | #1366               |
| `.motion-error-icon`       | pop-in for the error icon(s) paired with a validation error      | #1366               |
| `.motion-theme-icon`       | rotate + scale-in swap for the light/dark toggle icon            | #1365               |
| `.motion-page-enter`       | fade + translateY page entrance for route transitions            | #1358               |
| `.motion-toast-enter`      | slide-in + fade for toast notifications                          | #1360               |
| `.motion-toast-exit`       | slide-out + fade for toast dismissal                             | #1360               |

Every one of these is neutralized under `@media (prefers-reduced-motion:
reduce)` — animations are dropped (`animation: none`) and transitions are
disabled, collapsing straight to the end state rather than skipping the
feedback. Component-level CSS Modules (e.g. `Breadcrumb.module.css`) follow
the same rule locally when a shared class doesn't fit.

### Notification badge attention — reference integration

**Reference integration:** `components/AppNav.tsx`.

An unread count uses a short entrance on the badge and a quiet expanding ring
to draw attention without moving the navigation layout. Keep the count inside
the accessible link label, and mark the visual badge layers `aria-hidden` so
assistive technology announces the destination and unread count once.

```tsx
const reduceMotion = useReducedMotion();

<NavLink aria-label={t('nav.unreadNotifications', { count })} to="/notifications">
  <Bell aria-hidden="true" />
  <span
    className={`motion-notification-badge ${reduceMotion ? 'motion-notification-badge-reduced' : ''}`}
    aria-hidden="true"
  >
    <span className="motion-notification-badge-ping" />
    {count > 9 ? '9+' : count}
  </span>
</NavLink>
```

Use `.motion-notification-badge` for the count and
`.motion-notification-badge-ping` for its expanding attention ring. Apply the
`motion-notification-badge-reduced` class when the hook reports reduced motion;
the shared media query remains a CSS-level fallback. Only render the badge
when the unread count is greater than zero, and keep notification state owned
by the consuming feature rather than by the animation classes.

### Empty-state illustration — reference integration

**Reference integration:** `components/EmptyState.tsx`.

Empty states use a small, layered illustration rather than presenting an
isolated icon. The illustration has a themed halo, two quiet orbit lines, and
the supplied icon in a stable center tile. The layers use the existing
`--brand-primary`, `--brand-accent`, `--surface-hi`, and motion tokens, so the
visual remains coherent in both themes and with organization branding.

Use the classes together in this order:

```tsx
const reduceMotion = useReducedMotion();

<div className={`motion-empty-illustration ${reduceMotion ? 'motion-empty-illustration-reduced' : ''}`} aria-hidden="true">
  <span className="motion-empty-illustration-halo" />
  <span className="motion-empty-illustration-orbit motion-empty-illustration-orbit-one" />
  <span className="motion-empty-illustration-orbit motion-empty-illustration-orbit-two" />
  <span className="motion-empty-illustration-icon">{icon}</span>
</div>
```

Keep the illustration decorative with `aria-hidden="true"`; the empty-state
title and description remain the accessible content. Apply
`motion-empty-illustration` to the root, the halo/orbit classes to its
background layers, and `motion-empty-illustration-icon` to the focal icon.
The root has a restrained entrance and hover lift, while the layers provide
slow ambient movement. `useReducedMotion()` removes the motion-enabled state
from the component, and the shared media query also disables animations and
the hover transform as a CSS-level fallback. Do not add pointer-driven or
continuous motion to an empty state beyond these classes.

### 3. `useReducedMotion()` hook (`src/hooks/useReducedMotion.ts`)

For the cases that aren't pure CSS — a `setTimeout`-based show delay, a
JS-driven animation library, deciding whether to run an imperative
transition at all — read the live preference instead of only relying on
the CSS media query:

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion';

const reduceMotion = useReducedMotion();
if (!reduceMotion) startImperativeAnimation();
```

It listens for the preference changing mid-session (no reload required)
and falls back to `false` in non-browser environments.

## The four patterns

### Success / confirmation feedback — #1373

**Reference integration:** `UpgradeConfirmModal.tsx`, terminal `done` step.

A successful action gets a small celebratory beat instead of resolving
silently: an expanding ring fades out behind a badge that pops in
(`--motion-ease-bounce`), and the check icon inside scales in a beat after
the badge lands.

```tsx
<div className="relative w-16 h-16 flex items-center justify-center">
  <div className="motion-success-ring absolute inset-0 rounded-full border-2 border-emerald-500/50" />
  <div className="motion-success-badge relative w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
    <CheckCircle2 className="motion-success-icon w-8 h-8 text-emerald-500" />
  </div>
</div>
```

To reuse this in another confirmation surface (e.g. `FeeEstimationConfirmModal.tsx`,
tracked separately): wrap the success icon the same way, and keep the
`notifySuccess(...)` toast call the modal already makes — the badge
animation is the _in-context_ confirmation, the toast is the persistent
record. They aren't redundant; they answer different questions ("did this
work?" vs. "what happened, and can I find it again?").

### Collapsible panel — #1374

**Reference integration:** `EmployerLayout.tsx` desktop sidebar.

The sidebar gains a collapse/expand toggle (desktop only — mobile keeps
its full-width slide-in drawer, which is a different interaction). State
persists to `localStorage` (`payd-sidebar-collapsed`) so a reload doesn't
jar the user back to the opposite state.

- `.motion-collapse` on the `<aside>` and on the content wrapper animates
  `width` / `padding-left` together, so the sidebar and the page content
  move as one.
- `.motion-collapse-fade` on each nav label fades and shrinks the label
  out as the rail narrows, rather than having text reflow/clip abruptly.
- Icons stay put and gain a `title` attribute when collapsed, so the
  feature doesn't regress discoverability.

Reuse this in another panel by giving the panel and its "offset" sibling
(if any) the `motion-collapse` class, and any text that should disappear
when collapsed `motion-collapse-fade`.

### Route-change transition — #1375

**Reference integration:** `Breadcrumb.tsx`.

The crumb trail already had a `breadcrumbEnter` keyframe defined in
`Breadcrumb.module.css`, but it only ever played once: React was reusing
the same `<nav>` DOM node across navigations, and a CSS `animation` only
replays when the element it's attached to is (re)inserted into the DOM.

The fix is a `key={pathname}` on the animated root:

```tsx
<nav key={pathname} className={`... ${styles.breadcrumbNav}`}>
```

That's the whole pattern for "this should visibly refresh on route change":
key the animated element by whatever value changes on navigation, and let
the existing enter animation (or `.motion-route-in`, if a component
doesn't have a bespoke one) do the rest. Don't reach for a JS animation
library for this — the render churn a `key` change causes is exactly as
cheap as remounting the small amount of DOM breadcrumbs and similar
navigation chrome involve.

### Tooltip / popover timing — #1376

**Reference integration:** `InfoTooltip.tsx`.

Before: the entrance used `animate-in fade-in zoom-in-95 duration-200`
utility classes that don't exist in this project's Tailwind v4 setup (no
`tailwindcss-animate` plugin is installed) — so the tooltip appeared with
no animation at all, and hover had no intent delay, so the tooltip flashed
open on every cursor pass-through.

Standardized behavior:

- **Entrance:** the shared `.motion-popover` class — `scale(0.96 → 1)` +
  fade, `var(--motion-duration-fast)`, `var(--motion-ease-out)`. Every
  tooltip/popover in the app should use this class for its entrance so
  they all feel like the same UI primitive.
- **Show delay:** hover waits `HOVER_SHOW_DELAY_MS` (150ms) before
  showing, canceled if the pointer leaves first — this is interaction
  timing, not an animation, so it isn't gated by `prefers-reduced-motion`.
  Click and keyboard focus show immediately, since those are deliberate
  requests for the content, not incidental hover.
- **Dismiss:** unchanged — outside click, `Escape`, blur.

```tsx
const showOnHover = useCallback(() => {
  clearHoverTimer();
  hoverTimerRef.current = setTimeout(() => setVisible(true), HOVER_SHOW_DELAY_MS);
}, [clearHoverTimer]);
```

Migrating another tooltip/popover (`HelpLink.tsx`'s hover states, menu
popovers, etc. — tracked as separate issues) means: swap its entrance
animation for `.motion-popover`, and if it's hover-triggered, use the same
`HOVER_SHOW_DELAY_MS` show-intent delay so timing feels consistent app-wide.

## Chart Entrance Animations — #1379, #1380, #1381

**Reference integrations:**

- Bar charts: `PayrollAnalytics.tsx` (payment success/failure rate, department breakdown)
- Line/Area charts: `PayrollAnalytics.tsx` (payroll trends)
- Pie/Donut charts: `RevenueSplitDashboard.tsx` (currency/allocation breakdown)

Charts use Recharts' built-in animation props (`animationBegin`, `animationDuration`, `animationEasing`)
gated by the `useReducedMotion()` hook. This keeps the animation logic in the chart library
while respecting the user's motion preference.

### Chart Color Tokens

Chart colors are defined as CSS custom properties in `index.css` (both dark and light themes):

```css
--chart-1: var(--accent); /* Primary brand color */
--chart-2: var(--accent2); /* Secondary brand color */
--chart-3: #f59e0b; /* Amber/warning */
--chart-4: #34d399; /* Emerald/success */
--chart-5: #f87171; /* Red/danger */
--chart-6: #a78bfa; /* Purple */
--chart-7: #60a5fa; /* Blue */
--chart-8: #f97316; /* Orange */
```

Light theme overrides use darker variants for better contrast on white backgrounds.

### Animation Props Helpers

Each chart type gets a helper function that returns animation props when motion is allowed:

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion';

const reduceMotion = useReducedMotion();

function getBarAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) return {};
  return {
    animationBegin: 0,
    animationDuration: 400,
    animationEasing: 'easeOut',
  };
}

function getLineAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) return {};
  return {
    animationBegin: 0,
    animationDuration: 500,
    animationEasing: 'easeOut',
  };
}

function getAreaAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) return {};
  return {
    animationBegin: 0,
    animationDuration: 500,
    animationEasing: 'easeOut',
  };
}

function getPieAnimationProps(reducedMotion: boolean) {
  if (reducedMotion) return {};
  return {
    animationBegin: 0,
    animationDuration: 600,
    animationEasing: 'easeOut',
  };
}
```

### Usage in Recharts Components

Pass the animation props to Recharts components via spread operator:

```tsx
<Bar
  dataKey="success"
  name="Successful"
  fill="var(--chart-2)"
  {...getBarAnimationProps(reduceMotion)}
/>

<Line
  type="monotone"
  dataKey="total"
  name="Payroll Total"
  stroke="var(--chart-1)"
  {...getLineAnimationProps(reduceMotion)}
/>

<Area
  type="monotone"
  dataKey="total"
  name="Payroll Total"
  stroke="var(--chart-1)"
  fill="url(#trendGradient)"
  {...getAreaAnimationProps(reduceMotion)}
/>

<Pie
  data={chartData}
  dataKey="percentage"
  nameKey="recipient"
  {...getPieAnimationProps(reduceMotion)}
>
  {chartData.map((entry) => (
    <Cell key={entry.id} fill={entry.fill} />
  ))}
</Pie>
```

### Reusing the Pattern

To add chart animations to another component:

1. Import `useReducedMotion` from `../hooks/useReducedMotion`
2. Call `const reduceMotion = useReducedMotion()` in your component
3. Add the appropriate `get*AnimationProps` helper (or copy the pattern)
4. Spread the returned props onto your Recharts `<Bar>`, `<Line>`, `<Area>`, or `<Pie>` component
5. Use `var(--chart-N)` CSS custom properties for colors instead of hardcoded hex values
6. Verify the animation is disabled when `prefers-reduced-motion: reduce` is set

The CSS utility classes (`.motion-chart-bar-enter`, etc.) are available for cases where you need
CSS-based animations instead of Recharts' built-in ones, but the Recharts props approach is
preferred for chart elements since it animates the data visualization itself.

### Form validation error emphasis — #1366

**Reference integration:** `FormField.tsx`.

Before: an error message and its accompanying icon were conditionally
rendered with no transition — the field's border color changed and the
text popped in with no visual emphasis, easy to miss on a long form.

- The error `<p>` gets `.motion-error-message`, a brief horizontal shake
  combined with a fade-in (`--motion-duration-slow`) — enough emphasis to
  draw the eye without feeling like an aggressive "wrong answer" buzz.
- The inline `AlertCircle` icons (both the one next to the message and the
  one overlaid on the input) get `.motion-error-icon`, a quick scale-in
  (`--motion-duration-fast`).
- Both elements are `key={error}`'d, so if the error message text changes
  while the field stays invalid (e.g. "Required" → "Must be 8+ characters"),
  React remounts them and the animation replays — the user gets fresh
  emphasis for the new problem, not just the first one.
- `role="alert"` / `aria-live="assertive"` are unchanged — the animation is
  a visual affordance layered on top of the existing screen-reader behavior,
  not a replacement for it.

Reuse this in another field-level validation surface by adding
`.motion-error-message` / `.motion-error-icon` to the equivalent elements
and keying them by the error text.

### Dark mode toggle transition — #1365

**Reference integration:** `ThemeToggle.tsx`.

Before: `theme` flipped in the `ThemeContext`, the CSS custom properties on
`[data-theme]` changed instantly, and the sun/moon icon swapped in the same
frame — a jarring flash with no sense of transition.

- `html`, `body`, and `#root` now transition `background-color` and `color`
  over `--motion-duration-normal`, so the whole app's palette crossfades
  instead of snapping when `data-theme` changes.
- The icon inside `ThemeToggle` is wrapped in a `key={theme}` span with
  `.motion-theme-icon` — a rotate + scale-in — so swapping from `Moon` to
  `Sun` (or back) remounts and replays the entrance instead of instantly
  replacing one glyph with another.

Reuse this in another theme-aware surface by giving its root element the
same background/color transition (or relying on the global one on `html`),
and `.motion-theme-icon` for any icon that swaps on theme change.

### Focus trap timing for modals — #1362

**Reference integration:** `EmployeeRemovalConfirmModal.tsx`.

Before: the modal's entrance animation (`slideUp`, defined in its CSS
Module) ran for 300ms, but the focus trap moved focus to the cancel button
after a hardcoded, unrelated 100ms `setTimeout` — focus landed mid-animation,
and the two values would silently drift apart if either one changed.

- The modal's `slideUp` animation now uses `--motion-duration-slow` (the
  same token vocabulary as everything else in this doc) instead of a bare
  `0.3s`.
- `FOCUS_TRAP_DELAY_MS` in the component is set to match that token's value
  and documented as such, so the focus move happens right as the entrance
  animation finishes rather than partway through it.
- The delay is skipped entirely (`0ms`) when `useReducedMotion()` reports a
  reduced-motion preference, since there's no animation to wait out in that
  case.

Reuse this in another modal by keeping its entrance-animation duration and
its initial-focus delay defined from the same token/constant, and branching
on `useReducedMotion()` the same way.

### Animation performance audit — #1364

See [`ANIMATION_PERFORMANCE_AUDIT.md`](./ANIMATION_PERFORMANCE_AUDIT.md) for
a full inventory of every animation/transition in `frontend/src/components`,
classified by whether it animates compositor-only properties (`transform`,
`opacity` — cheap, GPU-accelerated, safe for 60fps) versus layout- or
paint-triggering properties (`width`, `padding`, `top`, etc. — more likely
to jank on low-end devices). New animation work should default to
`transform`/`opacity`; reach for a layout-affecting property only when the
effect genuinely requires it (e.g. a collapsing sidebar), and note it in
that audit when you do.


### Reduced-motion context provider — #1363

**Reference integration:** `ThemeProvider.tsx`.

The `useReducedMotion()` hook provides the live preference for JS-driven
branching, but components that don't directly call the hook need a way to
access the preference. `ThemeProvider` now:

1. Calls `useReducedMotion()` internally and exposes `reducedMotion` as a
   boolean in the `ThemeContextType`.
2. Sets `data-motion-safe="true|false"` on `<html>` so CSS can read the
   preference via the attribute selector when a media query alone isn't
   sufficient.

Any component that already calls `useReducedMotion()` directly continues to
work — the context value is a convenience for components that only need the
value passively (e.g. to conditionally render decorative elements) and
don't want to add their own hook subscription.

### Global page transition system — #1358

**Reference integration:** `App.tsx`.

Route changes now wrap the `<Routes>` element in framer-motion's
`AnimatePresence` with a `mode="wait"` so the outgoing page finishes its
exit animation before the incoming page enters. Each route's content
container is keyed by `useLocation().pathname` and uses the
`.motion-page-enter` CSS class (a `fadeUp` variant using motion tokens)
for the entrance.

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
    transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
  >
    <Routes location={location}>...</Routes>
  </motion.div>
</AnimatePresence>
```

The `useReducedMotion()` hook from framer-motion is used so that the
transition collapses to instant (duration `0`) when the user has requested
reduced motion. The `location` object is destructured from `useLocation()`
and passed explicitly to `<Routes>` so that `AnimatePresence` can detect
exits.

### Standardized route-level loading skeletons — #1359

**Reference integration:** `SkeletonLoader.tsx`.

The shimmer animation was already disabled under
`prefers-reduced-motion: reduce` via the `.skeleton-shimmer` override in
`index.css`. This issue extends the component with a `reducedMotion` prop
that skips the shimmer entirely and renders flat placeholder shapes, and
documents how new skeleton variants should be added.

Each variant sub-renderer uses the shared `SHIMMER_BASE` class, and the
component now accepts an optional `reducedMotion` boolean. When `true`, the
`animation: none` override is applied inline, ensuring the skeleton renders
as a static placeholder. This is the same pattern used by framer-motion
components: the CSS handles the default case, and the JS prop provides an
escape hatch for programmatic control.

### Toast notification animation system — #1360

**Reference integration:** `ToastContainer.tsx`, `ToastItem.tsx`.

Before: toasts rendered with no enter/exit animation — they appeared and
disappeared instantly, which felt abrupt.

After:

- `ToastContainer` wraps the toast list in `AnimatePresence` with
  `mode="popLayout"` so exiting toasts animate out before being removed.
- `ToastItem` uses `motion.div` with:
  - **Enter:** `opacity: 0 → 1`, `x: 40 → 0` (slide in from right)
  - **Exit:** `opacity: 1 → 0`, `x: 0 → 40` (slide out to right)
  - Duration: `--motion-duration-normal` (250ms), easing: `--motion-ease-out`
- The CSS `transition-all duration-300 transform` was removed from the
  `ToastItem` className in favor of framer-motion's declarative animation,
  which handles the exit cleanup automatically.
- `useReducedMotion()` sets duration to `0` when the user has requested
  reduced motion — toasts appear and disappear instantly in that case.

The `removeToast` timeout was removed from `ToastItem` — `AnimatePresence`
handles the exit animation timing and fires `onExitComplete` when done.
The container calls `removeToast` after the exit animation completes.

## Checklist for a new "add animation to X" issue

1. Reach for an existing `.motion-*` class before writing new keyframes.
2. If the interaction genuinely needs new keyframes, define them next to
   the others in `index.css` (or the component's CSS Module, for
   component-scoped Cascade Layer concerns) using the motion tokens for
   duration/easing — never a bare `200ms`.
3. Add the reduced-motion override in the same place you added the
   animation — don't rely on a _different_ file's blanket rule.
4. If the effect is timing-driven in JS (delays, imperative animation
   libraries), branch on `useReducedMotion()`.
5. Prefer animating `transform` and `opacity` over layout-triggering
   properties (`width`, `height`, `top`, `left`, `padding`, ...) — see
   [`ANIMATION_PERFORMANCE_AUDIT.md`](./ANIMATION_PERFORMANCE_AUDIT.md) for
   the reasoning and the current inventory. If a layout property is
   unavoidable, add the new usage to that audit.
6. Document the new class in the table above.
