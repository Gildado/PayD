#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# test_sdk_interop.sh — Run Stellar SDK interoperability tests against a
# simulated standalone Soroban network.
#
# Prerequisites:
#   - Node.js 18+ and npm
#   - A running Stellar standalone network (http://localhost:8000/rpc)
#   - WASM artifacts in target/wasm32-unknown-unknown/release/*.wasm
#
# Usage:
#   ./scripts/test_sdk_interop.sh              # run all SDK tests
#   ./scripts/test_sdk_interop.sh --build      # build WASM first
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/rpc}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${YELLOW}INFO${NC}: $1"; }
pass() { echo -e "${GREEN}PASS${NC}: $1"; }
fail() { echo -e "${RED}FAIL${NC}: $1"; }

# ── Step 1: Build WASM (optional) ────────────────────────────────────────────
if [ "${1:-}" = "--build" ]; then
    info "Building contracts to WASM..."
    cd "$PROJECT_ROOT"
    for contract in bulk_payment cross_asset_payment vesting_escrow revenue_split milestone_escrow asset_path_payment smart_wallet orgusd; do
        cargo build --target wasm32-unknown-unknown --release -p "$contract" 2>&1 | tail -1
        pass "$contract built"
    done
fi

# ── Step 2: Check network ───────────────────────────────────────────────────
info "Checking network at $RPC_URL..."
if ! curl -sf "$RPC_URL" > /dev/null 2>&1; then
    fail "Network not reachable at $RPC_URL"
    echo "Start: docker run -d -p 8000:8000 --name stellar stellar/quickstart:soroban-dev --standalone"
    exit 1
fi
pass "Network is reachable"

# ── Step 3: Verify WASM artifacts exist ──────────────────────────────────────
info "Checking WASM artifacts..."
WASM_DIR="$PROJECT_ROOT/target/wasm32-unknown-unknown/release"
MISSING=0
for contract in bulk_payment cross_asset_payment vesting_escrow revenue_split milestone_escrow asset_path_payment smart_wallet orgusd; do
    if [ ! -f "$WASM_DIR/${contract}.wasm" ]; then
        fail "Missing: ${contract}.wasm"
        MISSING=1
    fi
done
if [ "$MISSING" -eq 1 ]; then
    echo "Run with --build to compile WASM artifacts."
    exit 1
fi
pass "All WASM artifacts present"

# ── Step 4: Install frontend dependencies ────────────────────────────────────
info "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm ci --legacy-peer-deps 2>&1 | tail -1
pass "Dependencies installed"

# ── Step 5: Run SDK interop tests ────────────────────────────────────────────
info "Running SDK interoperability tests..."
export STELLAR_RPC_URL="$RPC_URL"
export WASM_DIR="$WASM_DIR"

if npm run test:sdk 2>&1; then
    pass "All SDK interop tests passed"
else
    fail "SDK interop tests failed"
    exit 1
fi
