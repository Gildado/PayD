# Animation Performance Audit (#1364)

A baseline audit of every CSS animation/transition under
`frontend/src/components` (plus the shared system in `src/index.css`),
classified by whether it only touches compositor-friendly properties
(cheap, GPU-accelerated, safe for 60fps) or properties that force layout
or paint work on the main thread (more likely to jank, especially on
low-end/mobile devices). This is a static audit — the classification below
follows from CSS's own rendering pipeline (Layout → Paint → Composite),
not from a one-off profiling session — but the recommended way to confirm
it on a given machine is described under [Verifying in DevTools](#verifying-in-devtools).

## Methodology

For each `animation` / `transition` declaration in the codebase, the
animated propert(y/ies) were classified as:

- **Composite-only** — `transform`, `opacity`. The browser can run these
  entirely on the compositor thread; they don't invalidate layout or
  repaint the rest of the page. This is the target for anything that needs
  to run smoothly regardless of page complexity.
- **Paint-only** — `color`, `background-color`, `border-color`,
  `box-shadow`. These force a repaint of the element (and sometimes
  descendants) but not a layout recalculation. Cheap in practice for
  small/medium elements; worth watching for large full-viewport surfaces.
- **Layout-triggering** — `width`, `height`, `padding`, `top`/`left`,
  and `all` (which includes all of the above). These force the browser to
  recompute layout for the element and its layout siblings/ancestors
  before it can paint or composite. The most expensive category, and the
  one to avoid by default.

## Inventory

| Location                                              | Animated propert(y/ies)                    | Class                    |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------ |
| `index.css` — `.motion-success-badge/-icon/-ring`      | `transform`, `opacity`                      | Composite-only           |
| `index.css` — `.motion-route-in`                       | `transform`, `opacity`                      | Composite-only           |
| `index.css` — `.motion-popover`                        | `transform`, `opacity`                      | Composite-only           |
| `index.css` — `.motion-error-message` / `-icon` (#1366) | `transform`, `opacity`                      | Composite-only           |
| `index.css` — `.motion-theme-icon` (#1365)             | `transform`, `opacity`                      | Composite-only           |
| `index.css` — `html`/`body`/`#root` theme fade (#1365) | `background-color`, `color`                 | Paint-only               |
| `index.css` — `.motion-collapse`                       | `width`, `padding`                          | **Layout-triggering**    |
| `index.css` — `.motion-collapse-fade`                  | `opacity`, `max-width`                      | Layout-triggering (`max-width`) |
| `EmployeeRemovalConfirmModal.module.css` — `.backdrop` | `opacity` (`fadeIn`)                        | Composite-only           |
| `EmployeeRemovalConfirmModal.module.css` — `.modal`    | `opacity`, `transform` (`slideUp`)          | Composite-only           |
| `EmployeeRemovalConfirmModal.module.css` — spinner     | `transform` (`spin`)                        | Composite-only           |
| `EmployeeRemovalConfirmModal.module.css` — buttons     | `all` (hover/focus, `0.15s`)                 | **Layout-triggering**    |
| `Breadcrumb.module.css`                                | `opacity`, `transform`, `color`             | Composite-only / Paint-only |
| `Avatar.tsx` — `.hover-scale-avatar`                    | `transform`, `box-shadow`                   | Composite-only / Paint-only |
| `ContractErrorPanel.module.css`                        | `border-color`, `background-color`, `color`, `transform`, `all` | Mixed — several `all` transitions |
| `FeeEstimationConfirmModal.module.css`                 | `opacity`, `transform` (modal), `color`, `all` | Mixed — `all` on line 126 |
| `FeeEstimationPanel.module.css` — progress bar         | `width` (`0.5s`)                            | **Layout-triggering**    |
| `FeeEstimationPanel.module.css` — shimmer/pulse        | `opacity`/`background-position` (`shimmer`, `pulse`) | Composite-only (typical) |
| `KeyboardShortcutsHelp.module.css`                     | `opacity`, `transform`, `all`                | Mixed — `all` on line 80 |
| `TransactionSimulationPanel.module.css`                | `transform` (`spin`), background shimmer, `all` | Mixed — `all` on line 270 |
| `AutosaveIndicator.tsx`, `ConnectAccount.tsx`, `ConnectedProvidersStatus.tsx` | `opacity` (inline styles, already gated on reduced motion) | Composite-only |

## Findings

1. **The shared `.motion-*` system added across #1373–#1376, #1365, and
   #1366 is composite-only by design** (`transform` + `opacity`), with one
   deliberate exception: `.motion-collapse` on the sidebar animates
   `width`/`padding` because the layout genuinely needs to reflow when the
   rail resizes. There's no `transform`-only way to make surrounding
   content reflow around a resizing sidebar, so this is an accepted,
   contained cost (one element, desktop-only, user-initiated).
2. **The new theme-switch color fade (#1365)** animates `background-color`
   / `color` on `html`/`body`/`#root`. This is paint-only, not
   layout-triggering, so it doesn't force a reflow of the page — it's safe
   at 60fps even though it applies at the document root.
3. **Several older component styles use a blanket `transition: all ...`**
   (`ContractErrorPanel.module.css`, `FeeEstimationConfirmModal.module.css`,
   `KeyboardShortcutsHelp.module.css`, `TransactionSimulationPanel.module.css`,
   button hover states in `EmployeeRemovalConfirmModal.module.css`). `all`
   is convenient but transitions whatever properties happen to change,
   including layout-affecting ones, and forces the browser to compute
   transitionable values for every property instead of the one or two that
   actually change. None of these are part of this issue's reference
   integrations, so they're left as-is here — **tracked as a follow-up
   cleanup** (see Recommendations) rather than fixed in this pass, per the
   "don't migrate every existing usage" scope of the #1362/#1365/#1366
   issues.
4. **`FeeEstimationPanel.module.css`'s progress bar animates `width`**
   directly. It's a small, contained element (not full-viewport), so the
   layout cost is negligible in practice, but it's a candidate to switch to
   a `transform: scaleX()` on a fixed-width track next time that file is
   touched.

## Recommendations

- New animation work should default to `transform`/`opacity` (see the
  checklist in [`MOTION_PATTERNS.md`](./MOTION_PATTERNS.md)); only reach for
  a layout-affecting property when the effect requires it, and note the
  usage in the inventory above when you do.
- Replace bare `transition: all ...` with explicit property lists
  (`transition: color 0.2s, border-color 0.2s`) the next time one of the
  flagged files is touched for unrelated work — this avoids accidentally
  transitioning `width`/`height`/`padding` if someone adds a layout-affecting
  style change later, and is cheaper for the browser to compute.
- Prefer `transform: scaleX()` over animating `width` for progress-bar-style
  fills where the track has a fixed size.

## Verifying in DevTools

To confirm any of the above on a given machine: Chrome DevTools → **Rendering**
tab → enable **Paint flashing** (highlights repainted regions) and
**Layer borders** (shows which elements are promoted to their own
compositor layer). Composite-only animations (the `.motion-*` classes)
should show no paint flashing and stay within their own layer; the
`.motion-collapse` sidebar and any `transition: all` usages will show
paint flashing on the surrounding content, which is expected given the
classification above. The **Performance** panel's FPS meter is the
authoritative check for whether a specific interaction holds 60fps on a
given device.
