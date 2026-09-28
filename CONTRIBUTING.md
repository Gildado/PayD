# Contributing to PayD

Thank you for considering contributing to PayD! We're building a decentralized payroll platform on Stellar, and we value contributions from developers, designers, and documentation experts alike.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Coding Standards](#coding-standards)
- [Database Migrations](#database-migrations)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Rewards Program](#rewards-program)
- [Getting Recognized](#getting-recognized)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please read and follow our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend and backend)
- **Rust** 1.70+ (for Soroban contracts)
- **Docker** & **Docker Compose** (recommended for local development)
- **Git** (for version control)
- **PostgreSQL** 15+ (if running backend without Docker)
- **Redis** 7+ (if running backend without Docker)

### Quick Start

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/PayD.git
   cd PayD
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies** (see [Development Environment Setup](#development-environment-setup))
5. **Run the development server** (see [Development Environment Setup](#development-environment-setup))

## Development Environment Setup

### Option 1: Docker (Recommended)

The easiest way to get started is using Docker Compose, which sets up the entire stack (API, PostgreSQL, Redis).

```bash
# Navigate to backend directory
cd backend

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up

# In another terminal, verify services are healthy
./scripts/docker-health-check.sh

# View logs
docker-compose logs -f api
```

**Troubleshooting Docker issues?** See [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md).

### Option 2: Local Development (macOS/Linux)

#### Backend Setup

```bash
cd backend

# Install Node.js dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your local database credentials

# Install PostgreSQL (macOS with Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Install Redis (macOS with Homebrew)
brew install redis
brew services start redis

# Create database and run migrations
npm run db:migrate

# Start development server
npm run dev
```

#### Frontend Setup

```bash
# From root directory
npm install

# Start development server (includes contract watching)
npm start
```

#### Soroban Contracts Setup

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build all contracts
cd contracts/bulk_payment
cargo build --release

# Or build all at once from root
cargo build --release --workspace
```

### Option 3: Local Development (Windows)

Windows users should use **WSL 2** (Windows Subsystem for Linux) with Docker Desktop:

```bash
# Enable WSL 2 and install Docker Desktop for Windows
# Then follow the Linux instructions above in your WSL terminal
```

## Coding Standards

### TypeScript/JavaScript

- **Formatter**: Prettier (configured in `.prettierrc`)
- **Linter**: ESLint (configured in `.eslintrc.json`)
- **Style**: Follow existing code patterns in the codebase

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint -- --fix
```

**Key conventions:**
- Use `const` by default, `let` when reassignment is needed
- Prefer arrow functions for callbacks
- Use TypeScript strict mode (no `any` without justification)
- Add JSDoc comments for public functions and exports
- Use meaningful variable names (avoid single letters except in loops)

### Rust (Soroban Contracts)

- **Formatter**: `rustfmt` (automatic via `cargo fmt`)
- **Linter**: `clippy` (automatic via `cargo clippy`)
- **Style**: Follow Rust API guidelines

```bash
# Format Rust code
cargo fmt

# Lint Rust code
cargo clippy --all-targets --all-features
```

**Key conventions:**
- Use `#[derive(...)]` for common traits
- Document public functions with `///` doc comments
- Use meaningful error types (avoid generic `String` errors)
- Optimize for gas efficiency in contracts (see [GAS_OPTIMIZATION_CHECKLIST.md](GAS_OPTIMIZATION_CHECKLIST.md))

### SQL (Database Migrations)

- **Naming**: `NNN_description.sql` (e.g., `001_create_tables.sql`)
- **Style**: Use uppercase for SQL keywords, lowercase for identifiers
- **Comments**: Add migration purpose and design decisions at the top
- **Idempotency**: Use `IF NOT EXISTS` / `IF NOT EXISTS` clauses

```sql
-- Migration 001: Create core tables
-- Purpose: Establish base schema for organizations, employees, and transactions
-- Design: Uses SERIAL for IDs, TIMESTAMPTZ for timezone safety

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### File Naming

- **React components**: Use `PascalCase` filenames such as `PayrollScheduler.tsx`
- **Hooks and TypeScript implementation files**: Use `camelCase` filenames such as `usePayrollData.ts` and `payrollAuditService.ts`
- **Static assets and path-oriented docs**: Use `kebab-case` filenames such as `payroll-summary-icon.svg`
- **SQL migrations**: Use `NNN_snake_case.sql` filenames such as `025_add_metadata_to_payroll_items.sql`
- **Legacy areas**: Preserve the existing directory pattern unless the change is a dedicated rename/refactor

See [docs/FILENAMING_CONVENTIONS.md](docs/FILENAMING_CONVENTIONS.md) for the full naming matrix and migration guidance.

### Documentation

- **Markdown**: Use clear headings, code blocks, and examples
- **Links**: Use relative paths for internal docs
- **Code examples**: Include language identifier in fenced code blocks
- **Accessibility**: Use descriptive alt text for diagrams

## Database Migrations

> **This section is mandatory reading before submitting any PR that modifies the database schema.**

### The Golden Rule

Migration files are **immutable** once merged to `main`. The migration runner
(`backend/src/db/migrate.ts`) stores a SHA-256 checksum of every file it applies.
If the file's bytes change later — even a single space or comment — the runner
detects the mismatch and aborts:

```
[migrate] DRIFT DETECTED: "017_create_schema_migrations.sql" was previously
applied with checksum abc123... but the file now has checksum def456...
Aborted to protect database integrity.
```

This is the most common cause of CI/CD pipeline failures in this project.

### Always Create a New File

Need to add a column? Fix a constraint? Add an index? **Create a new migration.**
Never edit an existing one.

```bash
# 1. Find the next available number
ls backend/src/db/migrations/*.sql | sed 's/.*\///' | grep -oP '^\d+' | sort -n | tail -1

# 2. Create your migration (increment the number by 1)
# Example: if the result was 038, create:
touch backend/src/db/migrations/039_add_tax_region_to_employees.sql

# 3. Create the matching rollback (required — PRs without it will be rejected)
touch backend/src/db/rollbacks/039_add_tax_region_to_employees.sql
```

### PR Checklist (copy into your PR)

```markdown
- [ ] Migration file named correctly: NNN_short_description.sql
- [ ] Migration number is unique (no duplicates with existing files)
- [ ] Migration uses IF NOT EXISTS / IF EXISTS for idempotency
- [ ] Matching rollback file created in backend/src/db/rollbacks/
- [ ] npm run db:migrate:dry-run passes locally
- [ ] Running npm run db:migrate twice gives Applied: 0 on the second run
- [ ] No existing migration file was modified
```

### If CI Fails With a Migration Error

| Error | Fix |
|---|---|
| `DRIFT DETECTED` | Restore the original file content; create a new migration for your changes |
| `Duplicate migration prefix(es) detected` | Run `node scripts/resequence-migrations.mjs` from the repo root |
| `Missing rollback file` | Create `backend/src/db/rollbacks/NNN_your_migration.sql` |

### Full Documentation

See **[`backend/src/db/MIGRATION_GUIDE.md`](backend/src/db/MIGRATION_GUIDE.md)** for:
- Complete workflow with examples
- How the checksum guard works
- How to use the re-sequencing script
- Troubleshooting guide
- Full PR checklist

---

## Making Changes

### Before You Start

1. **Check existing issues** to avoid duplicate work
2. **Comment on the issue** to let others know you're working on it
3. **Discuss major changes** in the issue before starting implementation

### During Development

- **Keep commits atomic**: Each commit should represent a single logical change
- **Write descriptive commit messages** (see [Commit Conventions](#commit-conventions))
- **Update documentation** as you make changes
- **Test your changes** thoroughly (see [Testing](#testing))
- **Keep PRs focused**: Avoid mixing unrelated changes

### Code Review Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated (README, inline comments, etc.)
- [ ] No console.log or debug code left behind
- [ ] Accessibility considerations addressed (if UI changes)
- [ ] No secrets or sensitive data committed
- [ ] Commit messages follow conventions

## Testing

### Frontend Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run tests with coverage
npm run test -- --coverage
```

### Backend Tests

```bash
cd backend

# Run all tests
npm run test

# Run specific test file
npm run test -- src/services/__tests__/payroll.test.ts

# Run with coverage
npm run test -- --coverage
```

### Contract Tests

```bash
cd contracts/bulk_payment

# Run contract tests
cargo test

# Run with output
cargo test -- --nocapture
```

### Documentation Tests

```bash
# Verify documentation examples
npm run test:docs
```

### Test Requirements

- **Unit tests**: Required for all new functions and utilities
- **Integration tests**: Required for API endpoints and contract interactions
- **Coverage target**: Aim for 80%+ coverage on critical paths
- **E2E tests**: Recommended for major user workflows

## Commit Conventions

We follow a simplified version of [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build, dependency, or tooling changes

### Scope

Optional but recommended. Examples: `backend`, `frontend`, `contracts`, `db`, `api`

### Examples

```bash
# Good commits
git commit -m "feat(backend): add payroll batch processing endpoint"
git commit -m "fix(frontend): resolve wallet balance display bug"
git commit -m "docs(contracts): document storage layout for bulk payment"
git commit -m "refactor(db): optimize employee search query"
git commit -m "test(backend): add integration tests for payroll service"
```

## Submitting a Pull Request

### Before Submitting

1. **Rebase on main**: Ensure your branch is up-to-date
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run all checks locally**:
   ```bash
   npm run lint
   npm run format
   npm run test
   npm run test:docs
   ```

3. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Creating the PR

1. **Open a Pull Request** on GitHub against the `main` branch
2. **Use the PR template** from [`.github/pull_request_template.md`](.github/pull_request_template.md) (automatically provided by GitHub)
3. **Fill in all sections** with tests, docs, and accessibility considerations:
   - **Summary**: What does this PR do?
   - **What Changed**: Detailed description of changes
   - **Related Issues**: Link to issue(s) it resolves (e.g., `Closes #123`)
   - **Testing**: How was this tested?
   - **Documentation**: What documentation was updated?
   - **Accessibility / Responsiveness**: Any accessibility considerations?
   - **Checklist**: Verify all items are complete (tests, docs, accessibility)

### PR Review Process

- **Automated checks**: CI/CD pipeline runs automatically
- **Code review**: At least one maintainer will review
- **Feedback**: Address any requested changes
- **Approval**: PR is approved and ready to merge
- **Merge**: Maintainer merges to `main`

### PR Title Format

Use the same format as commit messages:

```
feat(backend): add payroll batch processing endpoint
fix(frontend): resolve wallet balance display bug
docs(contracts): document storage layout for bulk payment
```

## Rewards Program

We reward contributions to high-priority issues! Check the issue labels:

- **`bounty`**: Eligible for XLM/USDC rewards
- **`good-first-issue`**: Great for newcomers
- **`help-wanted`**: Community contributions needed

### How to Claim a Reward

1. **Work on a bounty-eligible issue**
2. **Submit a PR** that resolves the issue
3. **Comment on the issue** with your PR link and claim the bounty
4. **Wait for approval**: Maintainers review and approve
5. **Receive payment**: Rewards paid in XLM or USDC within 7 business days

See [BOUNTY.md](BOUNTY.md) and [CONTRIBUTION_REWARD.md](CONTRIBUTION_REWARD.md) for details.

## Getting Recognized

### Contributors List

When your PR is merged, add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md):

```markdown
- **[Your Name](https://github.com/your-username)** - Frontend / Bug Fixes / Documentation
```

### Recognition Tiers

- **Bronze**: 1-5 contributions
- **Silver**: 6-15 contributions
- **Gold**: 16+ contributions

## Need Help?

- **Questions?** Open a discussion on GitHub
- **Found a bug?** Open an issue with the bug report template
- **Have an idea?** Open an issue with the feature request template
- **Need support?** Check [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) or existing documentation

## Additional Resources

- [Architecture Diagram](ARCHITECTURE_DIAGRAM.md)
- [Database Schema](DB_SCHEMA.md)
- [Contract Storage Layout](docs/CONTRACT_STORAGE_LAYOUT.md)
- [Gas Optimization Guide](GAS_OPTIMIZATION_CHECKLIST.md)
- [Deployment Guide](DEPLOYMENT_GUIDE_METADATA.md)

Thank you for contributing to PayD! 🚀

Thank you for contributing!
