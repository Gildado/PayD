# Contribution Reward (Bounty) Information

## Overview

PayD encourages the open‑source community to help improve the platform by offering **bounties** for high‑priority issues. Contributors who solve eligible issues can earn a monetary reward, paid in the platform's native asset on the Stellar network.

This document provides comprehensive information about:
- How bounties work
- Eligibility criteria
- Claim process
- Payment details
- Frequently asked questions

---

## Table of Contents

1. [Who Can Earn a Bounty?](#who-can-earn-a-bounty)
2. [Bounty Tiers](#bounty-tiers)
3. [Eligibility Criteria](#eligibility-criteria)
4. [How to Find Bounty Issues](#how-to-find-bounty-issues)
5. [Claim Process](#claim-process)
6. [Reward Details](#reward-details)
7. [Payment Timeline](#payment-timeline)
8. [Frequently Asked Questions](#frequently-asked-questions)
9. [Examples](#examples)
10. [Contact & Support](#contact--support)

---

## Who Can Earn a Bounty?

PayD welcomes contributions from the global open-source community. Bounties can be earned by:

- **Developers** who submit a pull request that fully resolves a bounty‑tagged issue
- **Security Researchers** who responsibly disclose vulnerabilities (see [SECURITY.md](SECURITY.md))
- **Designers** who provide approved UI/UX assets for a bounty
- **Documentation Writers** who create or significantly improve documentation for bounty‑tagged issues
- **QA Engineers** who create comprehensive test suites for bounty features
- **DevOps Engineers** who improve CI/CD, deployment, or infrastructure

**No geographic restrictions** - Anyone can participate, regardless of location.

---

## Bounty Tiers

Bounties are categorized by complexity and impact:

| Tier | Reward Range | Examples |
|------|--------------|----------|
| **🥉 Bronze** | 50-100 XLM | Documentation improvements, minor bug fixes, UI polish |
| **🥈 Silver** | 100-300 XLM | Feature enhancements, moderate bug fixes, integration work |
| **🥇 Gold** | 300-1000 XLM | Major features, critical bug fixes, security patches |
| **💎 Platinum** | 1000+ XLM | Architecture overhauls, protocol implementations, major integrations |

*Note: Specific bounty amounts are listed in the issue description.*

---

## Eligibility Criteria

To qualify for a bounty reward, your contribution must meet **all** of the following criteria:

### 1. Issue Requirements
- ✅ Issue must be tagged with the **`bounty`** label on GitHub
- ✅ Issue must be **open** and **not already assigned** when you start work
- ✅ Bounty amount and payment asset must be specified in the issue description

### 2. Contribution Requirements
- ✅ Pull request must **fully resolve** the issue (no partial solutions)
- ✅ All **CI/CD checks must pass** (linting, tests, build)
- ✅ Code must follow **project coding standards** and style guides
- ✅ Adequate **test coverage** must be included (where applicable)
- ✅ Documentation must be updated (README, API docs, inline comments)

### 3. Process Requirements
- ✅ Pull request must **reference the issue** (e.g., `Fixes #123` or `Closes #456`)
- ✅ PR must be **reviewed and approved** by at least one maintainer
- ✅ PR must be **merged into the main branch**
- ✅ Contributor must follow the [Code of Conduct](CODE_OF_CONDUCT.md)

### 4. Timing Requirements
- ✅ **First qualified submission wins** - only the first merged PR for an issue receives the bounty
- ✅ Work must be **completed within 30 days** of issue assignment (if assigned)
- ✅ Claim must be submitted **within 14 days** of PR merge

---

## How to Find Bounty Issues

### On GitHub

1. Visit the [PayD Issues](https://github.com/Gildado/PayD/issues) page
2. Filter by the `bounty` label: https://github.com/Gildado/PayD/issues?q=is%3Aissue+is%3Aopen+label%3Abounty
3. Check the issue description for:
   - Bounty amount (e.g., `💰 Bounty: 250 XLM`)
   - Acceptance criteria
   - Technical requirements
   - Deadlines (if any)

### Claiming an Issue

Before starting work:

1. **Comment on the issue** to express interest: "I'd like to work on this bounty issue."
2. **Wait for maintainer response** - they may assign it to you or provide guidance
3. **Ask questions** if requirements are unclear
4. **Fork the repository** and create a feature branch

*Note: You can start work without explicit assignment, but we recommend commenting first to avoid duplicate efforts.*

---

## Claim Process

### Step-by-Step Guide

#### Step 1: Complete the Work

1. Fork the repository: `git clone https://github.com/Gildado/PayD.git`
2. Create a feature branch: `git checkout -b fix/issue-123-bounty`
3. Implement the solution according to issue requirements
4. Write tests and update documentation
5. Run local checks: `npm test`, `npm run lint`, `npm run build`

#### Step 2: Open a Pull Request

1. Push your branch to your fork
2. Open a PR against the `main` branch
3. **Reference the issue** in the PR description:
   ```markdown
   Fixes #123
   
   ## Summary
   This PR implements [feature/fix] as described in issue #123.
   
   ## Changes
   - Added X functionality
   - Fixed Y bug
   - Updated Z documentation
   
   ## Testing
   - All tests pass locally
   - Added new test coverage for [feature]
   
   ## Bounty Claim
   This PR resolves bounty issue #123 (250 XLM).
   Stellar address: GCEXAMPLE...
   ```

#### Step 3: Pass Code Review

1. Respond to reviewer feedback
2. Make requested changes
3. Ensure all CI checks pass
4. Wait for maintainer approval

#### Step 4: PR Merge

Once approved, a maintainer will merge your PR.

#### Step 5: Submit Bounty Claim

After the PR is merged, create a bounty claim issue:

1. Go to [New Issue](https://github.com/Gildado/PayD/issues/new)
2. Title: `Bounty Claim: #123 - [Your GitHub Username]`
3. Use this template:

```markdown
## Bounty Claim Details

**Issue Resolved:** #123
**Merged PR:** #456
**Bounty Amount:** 250 XLM
**Contributor:** @your-github-username

## Payment Information

**Stellar Address:** GCEXAMPLEADDRESS...
**Email (optional):** your-email@example.com

## Checklist

- [x] PR has been merged into main branch
- [x] All CI checks passed
- [x] Issue fully resolved per acceptance criteria
- [x] I have read and agree to the [Code of Conduct](CODE_OF_CONDUCT.md)
- [x] I understand that payment may take up to 7 business days

## Additional Notes

[Any additional context or comments]
```

#### Step 6: Verification & Payment

1. Maintainers will **verify the claim** within 2 business days
2. If approved, payment will be processed within **7 business days**
3. You'll receive a comment on your claim issue with:
   - Payment transaction ID
   - Stellar transaction link (public ledger)
   - Confirmation of amount

---

## Reward Details

### Payment Asset

Bounties are paid in one of the following assets on the Stellar network:

- **XLM (Lumens)** - Stellar's native cryptocurrency
- **ORGUSD** - PayD's stable asset (pegged to USD)
- **Other assets** - As specified in the issue description

### Payment Method

- All payments are made via **Stellar blockchain transactions**
- Payments are **transparent** - you can verify them on https://stellar.expert/
- **No intermediaries** - direct wallet-to-wallet transfer

### Tax Responsibility

- Bounty recipients are responsible for any **tax obligations** in their jurisdiction
- PayD does not withhold taxes or issue tax forms (1099, etc.)
- Consult a tax professional if you have questions about crypto income reporting

### Exchange Rate

For bounties denominated in USD but paid in XLM:
- Exchange rate is locked at **time of PR merge**
- Rate source: Stellar DEX 24-hour average
- Rate is published in the claim issue for transparency

---

## Payment Timeline

| Event | Timeline |
|-------|----------|
| PR merged | Day 0 |
| Submit bounty claim | Within 14 days of merge |
| Claim verification | 1-2 business days |
| Payment processing | 5-7 business days after verification |
| **Total time** | **6-9 business days after claim submission** |

*Payments may be delayed during holidays or if additional verification is needed.*

---

## Frequently Asked Questions

### General Questions

**Q: Do I need permission to work on a bounty issue?**  
A: No, but we recommend commenting on the issue first to avoid duplicate work and get guidance from maintainers.

**Q: Can I work on multiple bounties simultaneously?**  
A: Yes! There's no limit to how many bounties you can claim, as long as each meets the eligibility criteria.

**Q: What if someone else submits a PR for the same bounty while I'm working on it?**  
A: The first merged PR wins. We recommend working efficiently and communicating your progress in the issue comments.

### Technical Questions

**Q: What if my PR is partially accepted but not fully merged?**  
A: Bounties are only awarded for fully resolved issues. However, if your partial work is valuable, maintainers may create a new bounty issue for the remaining work or offer a prorated reward.

**Q: Do I need to write tests for my contribution?**  
A: Yes, for code changes. Test coverage is required for all new features and bug fixes. Documentation-only bounties don't require tests.

**Q: What if I find additional issues while working on a bounty?**  
A: Great! Create separate issues for new findings. If they're related and can be fixed quickly, mention them in your PR. Large additional work may qualify for separate bounties.

### Payment Questions

**Q: I don't have a Stellar wallet. How do I create one?**  
A: You can use:
- [StellarLaboratory](https://laboratory.stellar.org/) (web)
- [Lobstr](https://lobstr.co/) (mobile)
- [Freighter](https://www.freighter.app/) (browser extension)
- [Solar Wallet](https://solarwallet.io/) (mobile/desktop)

**Q: What if I provide the wrong Stellar address?**  
A: Double-check before submitting! Stellar transactions are **irreversible**. We'll verify the address format, but we cannot recover funds sent to an incorrect address.

**Q: Can I receive payment to an exchange wallet?**  
A: Yes, but we recommend using a personal wallet for better security and to ensure you receive the funds (some exchanges have minimum deposit amounts).

**Q: How do I convert XLM to my local currency?**  
A: Use a cryptocurrency exchange that supports XLM, such as Coinbase, Kraken, or Binance. You can also use Stellar DEX to trade XLM for other assets.

### Dispute Questions

**Q: What if I disagree with the bounty claim decision?**  
A: Disputes are reviewed by core maintainers. You can:
1. Comment on the claim issue with your concerns
2. Provide additional evidence if the issue wasn't fully resolved
3. Request a second review from another maintainer

Final decisions are made by the project lead and are binding.

**Q: What if someone plagiarizes my work?**  
A: Report it immediately in the claim issue. We'll investigate and may disqualify plagiarized submissions. Original authors will be protected.

---

## Examples

### Example 1: Bronze Bounty - Documentation

**Issue #423**: Document API Authentication Flow  
**Bounty**: 75 XLM  
**Work**: Create comprehensive API authentication documentation

**Claim Process:**
1. Created `backend/docs/API_AUTHENTICATION.md`
2. Documented JWT flow, endpoints, examples
3. Added diagrams and code samples
4. Opened PR #789, passed all checks
5. Submitted claim with Stellar address
6. Received 75 XLM within 7 days

### Example 2: Gold Bounty - Feature Implementation

**Issue #335**: Integrate Anchor SEP-24 Protocol  
**Bounty**: 500 XLM  
**Work**: Implement fiat withdrawal via Stellar anchors

**Claim Process:**
1. Implemented SEP-24 client in `backend/src/services/anchorService.ts`
2. Added API routes and controllers
3. Wrote integration tests (95% coverage)
4. Updated API documentation
5. Opened PR #790, addressed review comments
6. Merged after 2 review cycles
7. Submitted claim with transaction hash proof
8. Received 500 XLM within 5 business days

### Example 3: Silver Bounty - Bug Fix

**Issue #512**: Fix Payroll Scheduling Race Condition  
**Bounty**: 200 XLM  
**Work**: Fix critical bug in cron scheduler

**Claim Process:**
1. Reproduced the bug locally
2. Identified root cause (missing mutex lock)
3. Implemented fix with Redis-based locking
4. Added regression tests
5. Opened PR #791 with detailed explanation
6. Fast-tracked review due to critical nature
7. Merged same day
8. Received 200 XLM + 50 XLM bonus for quick turnaround

---

## Contact & Support

### Questions About Bounties

- **GitHub Discussions**: [Bounty Discussion Board](https://github.com/Gildado/PayD/discussions/categories/bounties)
- **Issue Comments**: Ask questions directly on the bounty issue
- **Discord**: Join our [community Discord](#) for real-time help

### Reporting Issues with Bounty System

If you encounter problems with the bounty process:
1. Open an issue with the label `bounty-system`
2. Include your claim issue number and details
3. Tag `@maintainers` for visibility

---

## Bounty Log

See [BOUNTY_LOG.md](BOUNTY_LOG.md) for a transparent record of all paid bounties (updated monthly).

---

## Related Resources

- [CONTRIBUTING.md](CONTRIBUTING.md) - General contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards
- [SECURITY.md](SECURITY.md) - Security vulnerability reporting
- [CONTRIBUTION_REWARD.md](CONTRIBUTION_REWARD.md) - Alternative reward program

---

*Thank you for contributing to PayD! Your work helps build a better payroll system for everyone.* 🚀

*Last updated: 2026-08-25*
