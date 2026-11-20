# Drag-and-Drop Visual Feedback Patterns

A unified, responsive drag-and-drop interaction feedback system across PayD file upload flows (`CSVUploader`, `BulkPayrollUpload`).

## Reference Integration

- **Component**: `frontend/src/components/CSVUploader.tsx`
- **Page**: `frontend/src/pages/BulkPayrollUpload.tsx`
- **Styles**: `.dnd-zone`, `.dnd-zone-active`, `.dnd-zone-idle`, `.dnd-icon-bounce` in `frontend/src/index.css`

## Interaction States

1. **Idle State (`.dnd-zone-idle`)**: Subdued dashed border (`--dnd-border-idle`) with card surface background.
2. **Hover State**: Highlights border to accent color and shifts background to elevated surface (`--surface-hi`).
3. **Active Drag Over State (`.dnd-zone-active`)**:
   - Border transitions to high-contrast active accent (`--dnd-border-active`).
   - Ambient drop glow (`--dnd-glow`).
   - Subtle vertical scaling (`scale(1.01)`).
   - Icon bounces gently via `.dnd-icon-bounce` keyframe.
4. **Accessibility / Reduced Motion**: Under `@media (prefers-reduced-motion: reduce)`, scaling and bouncing keyframe animations are suppressed while retaining sharp border color changes for clear state feedback.

## Usage Example

```tsx
<div className="dnd-zone dnd-zone-idle p-8 border-2 border-dashed rounded-xl">
  <div className="dnd-icon-bounce">
    <UploadIcon />
  </div>
</div>
```
