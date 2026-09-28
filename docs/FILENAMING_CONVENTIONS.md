# Filenaming Convention Guide

This guide standardizes naming styles across PayD.

## Goals

- Improve discoverability and consistency
- Reduce accidental casing mismatches across platforms
- Keep naming predictable for contributors and tooling

## Naming Matrix

| File Type | Preferred Style | Example |
| --- | --- | --- |
| React components (`.tsx`) | PascalCase | `PayrollScheduler.tsx` |
| React hooks (`.ts`/`.tsx`) | camelCase prefixed with `use` | `usePayrollData.ts` |
| Utility/service/controller files | camelCase | `payrollAuditService.ts` |
| Route and middleware files | camelCase | `authRoutes.ts` |
| Test files | Match target filename + `.test` | `payrollAuditService.test.ts` |
| Markdown docs | UPPER_SNAKE_CASE or kebab-case | `API_AUTHENTICATION_FLOW.md`, `deployment-guide.md` |
| SQL migrations | numeric prefix + snake_case | `025_add_metadata_to_payroll_items.sql` |
| Static assets | kebab-case | `payroll-summary-icon.svg` |
| Environment files | fixed conventional names | `.env`, `.env.example` |

## Kebab-case vs camelCase

Use kebab-case for:

- Static asset files (images, SVGs, downloadable docs)
- URL-oriented files where readability in paths matters

Use camelCase for:

- TypeScript implementation files (services, controllers, helpers)
- Hook files with `use` prefix

Use PascalCase for:

- React component filenames

## Additional Rules

- Do not mix casing styles in the same directory unless file roles differ (for example, components vs hooks).
- Keep filenames descriptive but concise.
- Avoid spaces and non-ASCII characters in filenames.
- Preserve existing naming style when editing legacy areas unless a dedicated refactor is planned.

## Migration Guidance

When renaming files to align with this guide:

1. Rename with git-aware moves so history is preserved.
2. Update all imports in one commit.
3. Run tests and lint before merge.
4. Prefer small, focused rename PRs to reduce merge conflicts.
