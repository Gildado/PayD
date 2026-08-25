# Motion Patterns

A shared system for the small interaction animations that make PayD feel
finished: success/confirmation feedback, collapsible panels, route-change
transitions, and tooltip/popover timing. It exists so each new "add an
animation to X" issue reuses the same tokens, primitives, and
reduced-motion behavior instead of inventing a one-off.

This doc covers the pattern implemented for #1373, #1374, #1375, #1376, and
the follow-up batch #1362, #1364, #1365, #1366, plus notification badge
attention. Each of those issues ships
one reference integration; migrating every other usage in the app is
tracked separately per component.

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
| `.motion-table-refresh-active` | brief opacity/position cue when filters or sorting update | table transitions |
| `.motion-table-row` | keyed row entrance after a table result set changes | table transitions |

Every one of these is neutralized under `@media (prefers-reduced-motion:
reduce)` — animations are dropped (`animation: none`) and transitions are
disabled, collapsing straight to the end state rather than skipping the
feedback. Component-level CSS Modules (e.g. `Breadcrumb.module.css`) follow
the same rule locally when a shared class doesn't fit.

### Table filter/sort transitions — reference integration

**Reference integrations:** `components/AdvancedSearchFilter.tsx` and
`components/PaginationControls.tsx`.

Use `motion-table-refresh` on the filter or pagination surface that triggers a
new result set. Add `motion-table-refresh-active` for the short refresh cue,
and add `motion-table-refresh-reduced` when `useReducedMotion()` reports a
reduced-motion preference. The components keep the refresh state local; the
filter, sort, or page callback remains the source of truth for the data.

Apply `motion-table-row` to keyed rows when the consuming table renders the new
result set. Keep the key tied to the row identity rather than its array index,
so sorting and filtering can animate the right item without moving layout
properties.

```tsx
const reduceMotion = useReducedMotion();

<div
  className={`motion-table-refresh ${isRefreshing ? 'motion-table-refresh-active' : ''} ${
    reduceMotion ? 'motion-table-refresh-reduced' : ''
  }`}
>
  {rows.map((row) => (
    <tr key={row.id} className="motion-table-row">
      {/* cells */}
    </tr>
  ))}
</div>
```

The refresh cue uses only opacity and `transform`; the shared reduced-motion
media query removes both the refresh and row animations. Do not add a loading
delay or hide the table while the callback runs: the transition is feedback
around the existing update, not a replacement for loading or empty states.

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
