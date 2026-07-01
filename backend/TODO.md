# Backend TODO

## Maintenance

- [ ] Remove legacy non-versioned routes (sunset 2027-01-01) — see `app.ts` lines 161-175
- [ ] Migrate raw SQL queries to Prisma ORM models or remove unused Prisma setup
- [ ] Consolidate `src/middleware/` and `src/middlewares/` into a single directory
- [ ] Remove duplicate test files between `src/__tests__/` and nested `src/*/__tests__/`
- [ ] Add missing rollback scripts for migrations 047-051
- [ ] Update ESLint from v8 to v9
- [ ] Evaluate switching OpenAPI spec generation from filesystem write to in-memory

## API Improvements

- [ ] Add rate-limiting to remaining unguarded endpoints
- [ ] Implement request ID propagation across all middleware layers
- [ ] Add comprehensive OpenAPI documentation for all v1 endpoints

## Performance

- [ ] Implement database connection pooling with retry logic
- [ ] Add Redis cache for frequently-accessed contract registry data
- [ ] Optimize bulk payment transaction submission with batching

## Security

- [ ] Add CSRF protection for state-changing endpoints
- [ ] Implement API key rotation mechanism
- [ ] Add audit logging for all admin operations
