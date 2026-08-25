# Motion Patterns

A shared system for the small interaction animations that make PayD feel
finished: success/confirmation feedback, collapsible panels, route-change
transitions, and tooltip/popover timing. It exists so each new "add an
animation to X" issue reuses the same tokens, primitives, and
reduced-motion behavior instead of inventing a one-off.

This doc covers the pattern implemented for #1373, #1374, #1375, and #1376.
Each of those issues ships one reference integration; migrating every other
usage in the app is tracked separately per component.

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

| Token                       | Use for                                          |
| ---------------------------- | ------------------------------------------------- |
| `instant` / `fast`           | hover/focus states, tooltip and popover entrances |
| `normal`                     | route/list transitions, panel collapse/expand      |
| `slow` / `slower`             | success/confirmation feedback (deserves a beat)    |

### 2. Shared keyframes and utility classes (`src/index.css`)

A block near the bottom of `index.css` (search `Shared motion system`)
defines reusable, theme-agnostic classes:

| Class                    | Purpose                                              | Used by (#issue)      |
| ------------------------- | ----------------------------------------------------- | ---------------------- |
| `.motion-success-badge`  | pop-in container for a success icon                   | #1373 |
| `.motion-success-icon`   | slight-delayed scale-in for the icon itself            | #1373 |
| `.motion-success-ring`   | expanding/fading ring behind the badge                 | #1373 |
| `.motion-collapse`       | width/padding transition for collapsible panels        | #1374 |
| `.motion-collapse-fade`  | opacity/max-width transition for labels that hide when collapsed | #1374 |
| `.motion-route-in`       | fade + slide-in for content that should replay per navigation | #1375 |
| `.motion-popover`        | standard tooltip/popover entrance (scale + fade)        | #1376 |

Every one of these is neutralized under `@media (prefers-reduced-motion:
reduce)` — animations are dropped (`animation: none`) and transitions are
disabled, collapsing straight to the end state rather than skipping the
feedback. Component-level CSS Modules (e.g. `Breadcrumb.module.css`) follow
the same rule locally when a shared class doesn't fit.

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
animation is the *in-context* confirmation, the toast is the persistent
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

## Checklist for a new "add animation to X" issue

1. Reach for an existing `.motion-*` class before writing new keyframes.
2. If the interaction genuinely needs new keyframes, define them next to
   the others in `index.css` (or the component's CSS Module, for
   component-scoped Cascade Layer concerns) using the motion tokens for
   duration/easing — never a bare `200ms`.
3. Add the reduced-motion override in the same place you added the
   animation — don't rely on a *different* file's blanket rule.
4. If the effect is timing-driven in JS (delays, imperative animation
   libraries), branch on `useReducedMotion()`.
5. Document the new class in the table above.
