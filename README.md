# PayD: Stellar-Based Cross-Border Payroll Platform!

[![Build Status](https://github.com/Gildado/PayD/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/Gildado/PayD/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Stellar Compatible](https://img.shields.io/badge/Stellar-Compatible-08B5E5?style=flat-square&logo=stellar)](https://www.stellar.org/)
[![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289DA?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/payd-community)
[![Slack](https://img.shields.io/badge/Slack-Join%20Us-4A154B?style=flat-square&logo=slack&logoColor=white)](https://join.slack.com/t/payd-community/shared_invite)

## License

PayD is available under the [MIT License](LICENSE).
Copyright (c) 2026 The Aha Company.

## 🧩 Project Summary

PayD is a revolutionary payroll system that enables organizations to pay employees, contractors, and partners across different countries using blockchain-based digital assets. By leveraging Stellar's fast, low-cost network, PayD replaces traditional banking rails with near-instant, transparent, and cost-effective payments.

**Key Benefits:**

- ⚡ Near-instant salary payments (seconds vs. days)
- 🔍 Transparent transaction tracking on-chain
- 💰 Lower cross-border fees (fraction of traditional banking)
- 📊 Stable-value payouts with predictable conversion rates

## 🚨 Problem This Solves

Traditional international payroll faces significant challenges:

| Problem                        | Impact                                  |
| ------------------------------ | --------------------------------------- |
| International bank delays      | Payments take 2–5 business days         |
| High transfer fees             | SWIFT + intermediary fees (often 5-15%) |
| Currency conversion issues     | Unpredictable FX rates and hidden fees  |
| Lack of proof                  | Difficult to verify payment delivery    |
| Contractor/freelancer payments | Many unbanked or prefer digital methods |

## 💡 Core Concepts

Instead of routing through expensive banking infrastructure:

All transactions occur on-chain with full transparency and auditability.

## 🏗 System Architecture

┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐ │ Organization │ │ Backend │ │ Stellar │ │ Dashboard │────│ (API) │────│ Network │ │ (Web App) │ │ │ │ │ └─────────────────┘ └──────────────┘ └─────────────────┘ │ │ │ ▼ ▼ ▼ ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐ │ Employee │ │ Payroll │ │ Employee │ │ Onboarding │ │ Engine │ │ Wallets │ └─────────────────┘ └──────────────┘ └─────────────────┘ │ ▼ ┌─────────────────┐ │ Local Anchors │ │ (Cash-out) │ └─────────────────┘

## 🔑 Main Actors

| Actor                   | Role                                                          |
| ----------------------- | ------------------------------------------------------------- |
| **Employer**            | Funds payroll, schedules payments, manages employees          |
| **Employee/Contractor** | Receives salary in digital assets, converts to local currency |
| **Backend System**      | Handles payroll logic, transaction processing                 |
| **Stellar Network**     | Processes fast, low-cost transactions                         |
| **Anchor Services**     | Converts digital assets to local bank/mobile money            |

## 💰 Asset Design on Stellar

PayD utilizes Stellar's asset issuance capabilities to create organization-specific stable assets:

### Example Asset: ORGUSD

- **Issuer Account**: Controlled by the organiza

---

## 🚀 Quick Start

1. **Clone and enter the repo**
   ```bash
   git clone https://github.com/Gildado/PayD.git
   cd PayD
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create your local environment and start the app**
   ```bash
   cd backend
   cp .env.example .env
   docker-compose up
   ```


For detailed setup instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Windows / WSL2 Setup
For Windows users, we strongly recommend using WSL2 (Windows Subsystem for Linux).
1. Install WSL2 by opening an Administrator PowerShell prompt and running `wsl --install`.
2. Install Docker Desktop and enable the WSL2 backend in its settings.
3. Open your WSL2 terminal (e.g. Ubuntu) and clone the repository there.
4. Run all `npm` and `docker-compose` commands inside the WSL2 terminal to avoid permission and path length issues.

## 📚 Contribution Reward (Bounty) Program

We value community contributions! High‑priority issues may carry a bounty to recognize and reward contributors.

### Eligible Contributions
- **Bug fixes** for critical bugs affecting core payroll flows.
- **Feature implementations** that align with the roadmap and have been approved as high priority.
- **Documentation improvements** that significantly enhance onboarding or user guidance for bounty‑eligible issues.

### Claim Process
1. **Work on an issue** labeled with the `bounty` tag.
2. **Submit a pull request** that resolves the issue and passes all CI checks.
3. **Add a comment** on the issue with the PR link, stating you are claiming the bounty.
4. **Project maintainers** will review the contribution. If approved, the reward will be transferred via the project's Stellar wallet.

### Reward Details
- Rewards are paid in **XLM** (Stellar Lumens) or a stable asset of the project's choosing.
- Amounts vary per issue and are defined in the issue description.
- Payments are processed within 7 business days after PR merge.

- **Salary Tracking**: View incoming payments
- **Transaction History**: Complete on-chain records
- **Balance Management**: Asset balances and values
- **Withdrawal Options**: Multiple anchor services
- **Wallet Integration**: QR codes for easy setup

### 3️⃣ Payroll Engine (Backend)

**Automated Payment Flow:**

1. Checks scheduled payments at designated times
2. Verifies employer account balance and authorization
3. Runs preflight `simulateTransaction` checks before wallet signature prompts
4. Signs and submits Stellar transactions only after simulation passes
5. Processes bulk payments efficiently
6. Logs all transactions in database
7. Sends notifications to employees

### 4️⃣ FX & Conversion System

- **Real-time Rates**: Live asset-to-fiat conversion (see our [FX Rate Fetching Logic](docs/FX_RATE_FETCHING_LOGIC.md) for details on fallback and caching architecture).
- **Anchor Fees**: Transparent withdrawal costs
- **Network Fees**: Minimal Stellar transaction fees
- **Multi-currency Support**: Support for various local currencies

### 5️⃣ Transparency & Auditability

Every payment includes:

- **Transaction Hash**: Unique Stellar transaction ID
- **Timestamp**: Exact payment time
- **On-chain Verification**: Public ledger proof
- **Audit Trail**: Complete payment history

## 🛠 Tech Stack

### Frontend

- **React 19** - Modern UI framework
- **TypeScript** - Type-safe development

### Backend

- **Node.js** - Runtime environment
- **Express.js** - API framework
- **Stellar SDK** - Blockchain integration
- **PostgreSQL** - Data persistence
- **Redis** - Caching and session management

### Blockchain

- **Stellar Network** - Primary blockchain
- **Soroban** - Smart contracts including:
  - **Bulk Payment**: Efficiently distribute funds to multiple recipients.
  - **Revenue Split**: Automate the division of incoming payments.
  - **Vesting Escrow**: Lock and gradually release tokens over time.
  - **Cross-Asset Payment**: Seamlessly convert assets during payments.
  - **Asset Path Payment**: Advanced routing for payments across different assets.
- **Stellar Wallets Kit** - Wallet integration

### DevOps

- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipelines
- **ESLint + Prettier** - Code quality
- **Husky** - Git hooks

## 🚀 Quick Start

Get PayD running locally in three steps:

```bash
# 1. Clone the repository
git clone https://github.com/Gildado/PayD.git
cd PayD

# 2. Install dependencies
npm install

# 3. Configure environment and start the dev server
cp .env.example .env
npm run dev
```

> **That's it!** The app will be available at `http://localhost:5173`.

Need the full setup (prerequisites, environment variables, database, smart contracts)? Keep reading below.

For cloud hosting instructions, see the deployment guide:

- [Vercel + Render Deployment Guide](docs/DEPLOYMENT_GUIDE_VERCEL_RENDER.md)
- [Staging Environment Known Issues](docs/STAGING_ISSUES.md)
- [Known Issues](docs/KNOWN_ISSUES.md)
- [Community (Discord/Slack)](docs/COMMUNITY.md)
- [Local Contract Bootstrap](docs/LOCAL_CONTRACT_BOOTSTRAP.md)
- [Filenaming Conventions](docs/FILENAMING_CONVENTIONS.md)

## Getting Started

### Prerequisites

Ensure you have the following installed:

- **Node.js** v22+
- **npm** or **yarn**
- **Rust** (for Soroban contracts)
- **Stellar CLI**
- **Docker** (optional, for local development)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Gildado/PayD.git
   cd PayD
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Setup:**

   ```bash
   cp .env.example .env
   ```

   _Edit `.env` with your configuration._

4. **Database Setup:**
   ```bash
   # Using Docker
   docker run --name payd-postgres -e POSTGRES_PASSWORD=mypassword -p 5432:5432 -d postgres:15
   ```
   _Or set up PostgreSQL manually._

### Configuration

Edit `.env` with the following key variables:

```env
# Stellar Network
STELLAR_NETWORK=testnet # or mainnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payd

# API Keys
STELLAR_SECRET_KEY=your_issuer_secret_key
ANCHOR_API_KEY=your_anchor_service_key

# JWT
JWT_SECRET=<generate-a-random-32+-char-secret>
JWT_REFRESH_SECRET=<generate-a-different-random-32+-char-secret>
```

Rotate the JWT secrets in your platform environment whenever credentials are exposed or on your normal key-rotation schedule, then restart/redeploy the backend.

### Development

**Web app (`frontend/`):**

- **Employer dashboard** — Sidebar layout and native XLM balance live under [`/employer`](http://localhost:5173/employer) (redirects to payroll). Set optional `VITE_ORG_DISPLAY_NAME` in `.env`.
- **Theme** — Light/dark preference is stored in `localStorage` under the key `payd-theme` and synced across browser tabs.
- **Issuer multisig** — Configured asset issuers (`VITE_*_ISSUER`) are checked against Horizon using the wallet’s network; payroll and cross-asset flows show a warning when multisig is required.

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

### Local Soroban Contracts

If you want to build, deploy, and seed the local Soroban contracts in one pass,
use the bootstrap helper:

```bash
npm run contracts:bootstrap:dry-run
```

The script lives in [docs/LOCAL_CONTRACT_BOOTSTRAP.md](docs/LOCAL_CONTRACT_BOOTSTRAP.md)
and can be run with `--contract` flags to limit the scope. When you are ready to
execute against the local network instead of previewing the plan, use:

```bash
npm run contracts:bootstrap -- --contract bulk_payment,cross_asset_payment
```

## 🙌 Contributors

We'd like to extend a huge thank you to everyone who has contributed to making PayD what it is today! For a full list of our amazing contributors, please see our [Contributors List](CONTRIBUTORS.md).

[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square)](#contributors)

## 💬 Community

Join our community to get help, share ideas, and collaborate with other PayD users and contributors:

- **Discord**: [Join our Discord server](https://discord.gg/payd-community) for real-time chat and support
- **Slack**: [Join our Slack workspace](https://join.slack.com/t/payd-community/shared_invite) for team collaboration

For more information, see our [Community Guide](docs/COMMUNITY.md).

## Credits.

Special thanks to the builders, reviewers, testers, and maintainers who have helped shape PayD.
See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the current list of recognized contributors and their contributions.
