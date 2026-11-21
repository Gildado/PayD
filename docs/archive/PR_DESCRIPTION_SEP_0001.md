# PR Description: Asset Metadata SEP-0001 Implementation

## Overview

This PR implements the Stellar Ecosystem Proposal 1 (SEP-0001) for the **ORGUSD** asset. It introduces a `stellar.toml` file that provides essential metadata about the asset and the PayD organization, ensuring visibility and trust when viewed in Stellar wallets (like LOBSTR or Albedo) and network explorers (like Stellar Expert).

**Fixes #215**

## Changes

- **Metadata Configuration**: Created the `stellar.toml` file in `backend/.well-known/stellar.toml` with the following sections:
  - `[DOCUMENTATION]`: Organization name, URL, and branding resources.
  - `[CONTACT]`: Official support email.
  - `[[CURRENCIES]]`: Detailed info for `ORGUSD`, including issuer address, anchor type, and descriptions.
- **Secure Hosting**:
  - The file is served via the backend Express app at the standard path: `/.well-known/stellar.toml`.
  - **CORS Support**: Enabled specific CORS headers (`Access-Control-Allow-Origin: *`) for this endpoint as required by the Stellar protocol for third-party tools.
  - **Correct Content-Type**: Explicitly set to `text/plain` to match Stellar standards.

## Verification Results

- **Path Verification**: Endpoint confirms file presence at `/Users/marvy/Documents/OpenSource/PayD/backend/.well-known/stellar.toml`.
- **Infrastructure Check**: Checked `backend/src/app.ts` for the correct routing logic and header settings.
- **Protocol Compliance**: Fields match the official Stellar SEP-1 specification for stablecoins.

## Checklist

- [x] `stellar.toml` file created with required SEP-1 fields.
- [x] File hosted at `.well-known/stellar.toml` with CORS enabled.
- [x] Asset metadata (ORGUSD) accurately described.
- [x] Organization documentation and contact details included.
