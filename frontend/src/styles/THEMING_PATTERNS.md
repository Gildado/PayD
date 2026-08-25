# White-Label Organization Branding Patterns

PayD supports dynamic white-label organization branding through CSS custom property overrides managed by `ThemeProvider`.

## Reference Integration

- **Provider**: `frontend/src/providers/ThemeProvider.tsx`
- **Hook**: `frontend/src/hooks/useTheme.ts`

## Key Capabilities

1. **Dynamic CSS Variables**: Applies `--brand-primary`, `--brand-accent`, and `--brand-header-bg` directly to `document.documentElement` (`:root`).
2. **State & Storage Synchronization**: Brand configurations persist in `localStorage` (`payd-org-brand`) and synchronize across tabs via storage events.
3. **Graceful Fallbacks**: When no custom brand config is provided, CSS variables fall back to system accent defaults (`var(--accent)`, `var(--accent2)`, `var(--surface)`).

## Usage Example

```tsx
import { useTheme } from '../hooks/useTheme';

function BrandingSettings() {
  const { brandConfig, setBrandConfig, resetBrandConfig } = useTheme();

  const applyAcmeBranding = () => {
    setBrandConfig({
      primaryColor: '#e11d48',
      accentColor: '#f43f5e',
      headerBg: '#0f172a',
      orgName: 'Acme Corp',
    });
  };

  return (
    <div>
      <p>Current Org: {brandConfig.orgName || 'Default'}</p>
      <button onClick={applyAcmeBranding}>Apply Acme Brand</button>
      <button onClick={resetBrandConfig}>Reset</button>
    </div>
  );
}
```

## Supported Brand Attributes

| Property | CSS Variable / Attribute | Description |
| --- | --- | --- |
| `primaryColor` | `--brand-primary` | Main brand highlight / button color |
| `accentColor` | `--brand-accent` | Secondary brand accent color |
| `headerBg` | `--brand-header-bg` | Custom navigation header background |
| `orgName` | `[data-org-name]` | Active organization display label |
