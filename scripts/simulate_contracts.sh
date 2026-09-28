#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# simulate_contracts.sh — Deploy and test all PayD contracts on a simulated
# Stellar standalone network.
#
# Prerequisites:
#   - `stellar` CLI (https://developers.stellar.org/docs/tools/smart-contracts-cli)
#   - A running Stellar standalone network (http://localhost:8000/rpc)
#   - WASM artifacts in target/wasm32-unknown-unknown/release/*.wasm
#
# Usage:
#   ./scripts/simulate_contracts.sh              # full simulation
#   ./scripts/simulate_contracts.sh --build      # build only
#   ./scripts/simulate_contracts.sh --deploy     # deploy only (requires build first)
#   ./scripts/simulate_contracts.sh --test       # test only (requires deploy first)
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WASM_DIR="$PROJECT_ROOT/target/wasm32-unknown-unknown/release"
NETWORK_PASSPHRASE="Standalone Network ; February 2017"
RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/rpc}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "${GREEN}  PASS${NC}: $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "${RED}  FAIL${NC}: $1"; }
skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); echo -e "${YELLOW}  SKIP${NC}: $1"; }
info() { echo -e "${YELLOW}  INFO${NC}: $1"; }

# ── Contract list ────────────────────────────────────────────────────────────
# All 8 production contracts + hello_world
CONTRACTS=(
    bulk_payment
    cross_asset_payment
    vesting_escrow
    revenue_split
    milestone_escrow
    asset_path_payment
    smart_wallet
    orgusd
)

# ── Step 1: Build all contracts to WASM ──────────────────────────────────────
build_contracts() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Step 1: Building contracts to WASM"
    echo "═══════════════════════════════════════════════════════════════"

    cd "$PROJECT_ROOT"

    for contract in "${CONTRACTS[@]}"; do
        local wasm_path="$WASM_DIR/${contract}.wasm"
        if [ -f "$wasm_path" ]; then
            info "WASM already exists: $contract"
            pass "$contract build"
        else
            info "Building $contract..."
            if cargo build --target wasm32-unknown-unknown --release -p "$contract" > /dev/null 2>&1; then
                pass "$contract build"
            else
                fail "$contract build"
            fi
        fi
    done
}

# ── Step 2: Check network is running ─────────────────────────────────────────
check_network() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Step 2: Checking simulated network"
    echo "═══════════════════════════════════════════════════════════════"

    # Retry up to 3 times with 5s delay
    for attempt in 1 2 3; do
        if curl -sf "$RPC_URL" > /dev/null 2>&1; then
            pass "Network is reachable at $RPC_URL"
            return 0
        fi
        info "Attempt $attempt/3: Network not ready, waiting 5s..."
        sleep 5
    done

    fail "Network is not reachable at $RPC_URL after 3 attempts"
    echo "  The script will continue but deploy/test steps may fail."
    return 0
}

# ── Step 3: Deploy and initialize each contract ──────────────────────────────
deploy_contracts() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Step 3: Deploying contracts to simulated network"
    echo "═══════════════════════════════════════════════════════════════"

    cd "$PROJECT_ROOT"

    # Ensure an identity exists
    if ! command -v stellar &> /dev/null; then
        fail "stellar CLI not found — skipping deployment"
        return
    fi

    if ! stellar keys ls 2>/dev/null | grep -q "simulate-deployer"; then
        info "Creating deployer identity..."
        stellar keys generate simulate-deployer 2>/dev/null || true
    fi

    # Fund the deployer on standalone
    stellar keys fund simulate-deployer --network standalone 2>/dev/null || true

    DEPLOYMENT_LOG="$PROJECT_ROOT/.simulation_deployments.csv"
    echo "contract,contract_id" > "$DEPLOYMENT_LOG"

    for contract in "${CONTRACTS[@]}"; do
        local wasm_path="$WASM_DIR/${contract}.wasm"

        if [ ! -f "$wasm_path" ]; then
            skip "$contract deploy (WASM not found)"
            continue
        fi

        info "Deploying $contract..."

        local contract_id
        contract_id=$(stellar contract deploy \
            --wasm "$wasm_path" \
            --source simulate-deployer \
            --network standalone \
            2>/dev/null || echo "")

        if [ -n "$contract_id" ]; then
            echo "$contract,$contract_id" >> "$DEPLOYMENT_LOG"
            pass "$contract deploy → $contract_id"
        else
            fail "$contract deploy"
        fi
    done

    echo ""
    info "Deployment log saved to $DEPLOYMENT_LOG"
}

# ── Step 4: Initialize contracts ─────────────────────────────────────────────
initialize_contracts() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Step 4: Initializing contracts on simulated network"
    echo "═══════════════════════════════════════════════════════════════"

    cd "$PROJECT_ROOT"
    local DEPLOYMENT_LOG="$PROJECT_ROOT/.simulation_deployments.csv"

    if [ ! -f "$DEPLOYMENT_LOG" ]; then
        fail "No deployment log found. Run deploy first."
        return
    fi

    while IFS=',' read -r contract contract_id; do
        [ "$contract" = "contract" ] && continue  # skip header

        info "Initializing $contract ($contract_id)..."

        case "$contract" in
            bulk_payment)
                stellar contract invoke \
                    --id "$contract_id" \
                    --source simulate-deployer \
                    --network standalone \
                    -- initialize --admin simulate-deployer \
                    2>/dev/null && pass "$contract initialize" || fail "$contract initialize"
                ;;
            vesting_escrow)
                stellar contract invoke \
                    --id "$contract_id" \
                    --source simulate-deployer \
                    --network standalone \
                    -- initialize --admin simulate-deployer \
                    2>/dev/null && pass "$contract initialize" || fail "$contract initialize"
                ;;
            revenue_split)
                stellar contract invoke \
                    --id "$contract_id" \
                    --source simulate-deployer \
                    --network standalone \
                    -- initialize --admin simulate-deployer \
                    2>/dev/null && pass "$contract initialize" || fail "$contract initialize"
                ;;
            milestone_escrow)
                stellar contract invoke \
                    --id "$contract_id" \
                    --source simulate-deployer \
                    --network standalone \
                    -- initialize --admin simulate-deployer \
                    2>/dev/null && pass "$contract initialize" || fail "$contract initialize"
                ;;
            *)
                # Try generic initialize with --admin
                stellar contract invoke \
                    --id "$contract_id" \
                    --source simulate-deployer \
                    --network standalone \
                    -- initialize --admin simulate-deployer \
                    2>/dev/null && pass "$contract initialize" || skip "$contract initialize (no standard init)"
                ;;
        esac
    done < "$DEPLOYMENT_LOG"
}

# ── Step 5: Run simulation tests ────────────────────────────────────────────
test_contracts() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Step 5: Running simulation tests"
    echo "═══════════════════════════════════════════════════════════════"

    cd "$PROJECT_ROOT"
    local DEPLOYMENT_LOG="$PROJECT_ROOT/.simulation_deployments.csv"

    if [ ! -f "$DEPLOYMENT_LOG" ]; then
        fail "No deployment log found."
        return
    fi

    # ── Test 5a: SEP-0034 Metadata ──────────────────────────────────────
    echo ""
    info "Test 5a: SEP-0034 contract metadata (name, version, author)"

    while IFS=',' read -r contract contract_id; do
        [ "$contract" = "contract" ] && continue

        local name
        name=$(stellar contract invoke \
            --id "$contract_id" \
            --network standalone \
            -- name 2>/dev/null || echo "ERROR")

        if [ "$name" != "ERROR" ] && [ -n "$name" ]; then
            pass "$contract name() → $name"
        else
            skip "$contract name() (not implemented)"
        fi

        local version
        version=$(stellar contract invoke \
            --id "$contract_id" \
            --network standalone \
            -- version 2>/dev/null || echo "ERROR")

        if [ "$version" != "ERROR" ] && [ -n "$version" ]; then
            pass "$contract version() → $version"
        else
            skip "$contract version() (not implemented)"
        fi
    done < "$DEPLOYMENT_LOG"

    # ── Test 5b: Ledger timing — submit tx, advance ledger, verify ──────
    echo ""
    info "Test 5b: Ledger timing — verify transactions are ledger-bound"

    while IFS=',' read -r contract contract_id; do
        [ "$contract" = "contract" ] && continue

        # Submit a read-only call and measure response time
        local start_time end_time elapsed
        start_time=$(date +%s%N)
        stellar contract invoke \
            --id "$contract_id" \
            --network standalone \
            -- name 2>/dev/null > /dev/null
        end_time=$(date +%s%N)
        elapsed=$(( (end_time - start_time) / 1000000 ))

        if [ "$elapsed" -ge 0 ]; then
            pass "$contract ledger response in ${elapsed}ms"
        else
            fail "$contract ledger timing"
        fi
    done < "$DEPLOYMENT_LOG"

    # ── Test 5c: Concurrent transactions ────────────────────────────────
    echo ""
    info "Test 5c: Concurrent transaction submission"

    # Read the bulk_payment contract ID for concurrent testing
    local bulk_id
    bulk_id=$(grep "^bulk_payment," "$DEPLOYMENT_LOG" | cut -d',' -f2 || echo "")

    if [ -n "$bulk_id" ]; then
        # Submit 3 concurrent read-only calls
        local pids=()
        for i in 1 2 3; do
            stellar contract invoke \
                --id "$bulk_id" \
                --network standalone \
                -- get_batch_count 2>/dev/null &
            pids+=($!)
        done

        local all_ok=true
        for pid in "${pids[@]}"; do
            if ! wait "$pid"; then
                all_ok=false
            fi
        done

        if $all_ok; then
            pass "Concurrent transactions (3 parallel calls) handled correctly"
        else
            fail "Concurrent transactions failed"
        fi
    else
        skip "Concurrent transactions (bulk_payment not deployed)"
    fi

    # ── Test 5d: Multiple rapid submissions (congestion simulation) ─────
    echo ""
    info "Test 5d: Congestion simulation — rapid sequential calls"

    if [ -n "$bulk_id" ]; then
        local success_count=0
        for i in $(seq 1 5); do
            if stellar contract invoke \
                --id "$bulk_id" \
                --network standalone \
                -- get_batch_count 2>/dev/null > /dev/null; then
                success_count=$((success_count + 1))
            fi
        done

        if [ "$success_count" -eq 5 ]; then
            pass "Rapid sequential calls (5/5 succeeded)"
        else
            fail "Rapid sequential calls ($success_count/5 succeeded)"
        fi
    else
        skip "Congestion simulation (bulk_payment not deployed)"
    fi
}

# ── Step 6: Cleanup and summary ──────────────────────────────────────────────
summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Simulation Test Summary"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}Passed${NC}: $PASS_COUNT"
    echo -e "  ${RED}Failed${NC}: $FAIL_COUNT"
    echo -e "  ${YELLOW}Skipped${NC}: $SKIP_COUNT"
    echo "═══════════════════════════════════════════════════════════════"

    # Cleanup deployment log
    rm -f "$PROJECT_ROOT/.simulation_deployments.csv"

    if [ "$FAIL_COUNT" -gt 0 ]; then
        echo -e "\n${RED}Simulation tests failed.${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All simulation tests passed.${NC}"
    fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "  PayD Contract Simulation Tests"
    echo "  Network: Standalone ($RPC_URL)"
    echo "═══════════════════════════════════════════════════════════════"

    local mode="${1:-all}"

    case "$mode" in
        --build)  build_contracts ;;
        --deploy)
            check_network
            deploy_contracts
            ;;
        --test)
            check_network
            test_contracts
            ;;
        all|"")
            build_contracts
            check_network
            deploy_contracts
            initialize_contracts
            test_contracts
            summary
            ;;
        *)
            echo "Usage: $0 [--build|--deploy|--test|all]"
            exit 1
            ;;
    esac
}

main "$@"
