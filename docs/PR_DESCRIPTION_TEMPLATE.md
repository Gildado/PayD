# PR Description Template Guide

This document provides a standardized format for writing Pull Request descriptions in the PayD project.

## Template Structure

```markdown
# Pull Request

## Overview
<!-- Provide a high-level description of what this PR does and why. Link the issue(s) it resolves. -->

**Fixes** #ISSUE_NUMBER

## Changes
<!-- List the main changes organized by category. Use bullet points. -->

- **Category**: Description of change
- **Category**: Description of change

## Testing
<!-- Describe how you tested these changes. Include test commands, manual steps, or screenshots. -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Documentation
<!-- Note any docs that were updated, or write "N/A". -->

## Checklist
- [ ] I linked the relevant issue(s) in the summary
- [ ] I added or updated tests for the change
- [ ] I ran the relevant test suite locally
- [ ] I updated documentation where needed
- [ ] Code follows project style guidelines
- [ ] No console errors or warnings introduced
- [ ] Changes are backward compatible (or migration steps documented)

## Accessibility / Responsiveness
<!-- If this touches the UI, describe keyboard, screen reader, and responsive checks. Otherwise write "N/A". -->

## Notes
<!-- Add migration steps, follow-up tasks, deployment notes, or anything else reviewers should know. -->
```

## Best Practices

### Overview Section
- Start with a clear, concise summary of the change
- Always reference the issue number using `**Fixes** #ISSUE_NUMBER`
- Explain the "why" behind the change, not just the "what"

### Changes Section
- Organize changes by category (e.g., Backend, Frontend, Database, Tests)
- Use bullet points for readability
- Be specific about what was changed and why

### Testing Section
- Describe both automated and manual testing
- Include specific commands used for testing
- Mention any edge cases tested

### Checklist
- Complete all applicable items
- Remove items that don't apply to your change
- Add project-specific items as needed

### Notes Section
- Document any breaking changes
- Include migration steps if database changes are involved
- Note any deployment considerations
- Mention follow-up tasks if applicable

## Example PR Description

```markdown
# Pull Request

## Overview
This PR implements Redis-backed API rate limiting to protect the PayD API from abuse.

**Fixes** #233

## Changes

- **Backend**: Integrated `authRateLimit`, `apiRateLimit`, and `dataRateLimit` middlewares
- **Configuration**: Added rate limit tiers for different route categories
- **Headers**: Added `X-RateLimit-*` and `Retry-After` headers to responses
- **Testing**: Added integration tests to verify header presence and tier separation

## Testing

- [x] Unit tests added/updated
- [x] Integration tests added/updated
- [x] Manual testing performed

Ran rate limiter tests:
```bash
cd backend && npm test -- --grep "rateLimiter"
```

## Documentation

- Updated `PR_DESCRIPTION_RATE_LIMITING.md` with implementation details

## Checklist

- [x] I linked the relevant issue(s) in the summary
- [x] I added or updated tests for the change
- [x] I ran the relevant test suite locally
- [x] I updated documentation where needed
- [x] Code follows project style guidelines
- [x] No console errors or warnings introduced
- [x] Changes are backward compatible (or migration steps documented)

## Notes

- Rate limiting is enabled by default in production
- Configure limits via environment variables `RATE_LIMIT_*`
- Redis connection is required for distributed rate limiting
```
