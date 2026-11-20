#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# verify_contract.sh — Verify deployed Stellar contracts match source.
#
# Builds each contract from source, compares the WASM hash against the
# on-chain hash, and verifies admin keys and constructor state.
#
# Usage:
#   ./scripts/verify_contract.sh                         # verify all 8 contracts
#   ./scripts/verify_contract.sh -c cross_asset_payment   # single contract
#   ./scripts/verify_contract.sh -n testnet               # target network
#   ./scripts/verify_contract.sh -n testnet -c orgusd     # single + network
#   ./scripts/verify_contract.sh -s                        # skip build (use existing WASM)
#   ./scripts/verify_contract.sh -c cross_asset_payment --source-account deployer_key
#
# Exit code:
#   0 — all checks passed
#   1 — one or more checks failed
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Must match the --target passed to `cargo build` in build_contract() below —
# the two are not auto-detected independently, since a stale target dir left
# over from an earlier/different build (e.g. a cargo cache restore) would
# otherwise cause this script to verify the wrong WASM artifact.
WASM_TARGET="wasm32-unknown-unknown"
WASM_DIR="$PROJECT_ROOT/target/$WASM_TARGET/release"
CONFIG_FILE="${VERIFY_CONFIG:-$SCRIPT_DIR/verify_config.toml}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ── All 8 production contracts ───────────────────────────────────────────────
ALL_CONTRACTS=(
    bulk_payment
    cross_asset_payment
    milestone_escrow
    orgusd
    revenue_split
    vesting_escrow
    asset_path_payment
    smart_wallet
)

# ── Defaults ──────────────────────────────────────────────────────────────────
NETWORK="standalone"
NETWORK_PASSPHRASE=""
RPC_URL=""
SOURCE_ACCOUNT="${STELLAR_ACCOUNT:-}"
SKIP_BUILD=false

# ── Parse arguments ───────────────────────────────────────────────────────────
usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
  -c, --contract NAME     Contract name to verify (repeatable). Default: all
  -n, --network NET       Stellar network name (standalone, testnet, mainnet). Default: standalone
  -s, --skip-build        Skip WASM build, use existing artifacts
  -a, --source-account ACCT Account to use as source for on-chain calls
  -h, --help              Show this help
EOF
    exit 0
}

SELECTED_CONTRACTS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -c|--contract)       SELECTED_CONTRACTS+=("$2"); shift 2 ;;
        -n|--network)        NETWORK="$2"; shift 2 ;;
        -s|--skip-build)     SKIP_BUILD=true; shift ;;
        -a|--source-account) SOURCE_ACCOUNT="$2"; shift 2 ;;
        -h|--help)           usage ;;
        *)                   echo "Unknown option: $1"; usage ;;
    esac
done

if [[ ${#SELECTED_CONTRACTS[@]} -eq 0 ]]; then
    SELECTED_CONTRACTS=("${ALL_CONTRACTS[@]}")
fi

# ── TOML parsing helper ───────────────────────────────────────────────────────
toml_query() {
    local query="$1"
    python3 -c "
import sys
# Python 3.11+ has tomllib; older versions need tomli
if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib
with open('$CONFIG_FILE', 'rb') as f:
    cfg = tomllib.load(f)
$query
" 2>/dev/null || echo ""
}

# ── Load network config from verify_config.toml ───────────────────────────────
load_network_config() {
    local net="$1"
    RPC_URL=$(toml_query "net = cfg.get('network', {}).get('$net', {}); print(net.get('rpc-url', ''))")
    NETWORK_PASSPHRASE=$(toml_query "net = cfg.get('network', {}).get('$net', {}); print(net.get('network-passphrase', ''))")
}

# ── Helpers ───────────────────────────────────────────────────────────────────
pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}PASS${NC}: $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}FAIL${NC}: $1"; }
skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); echo -e "  ${YELLOW}SKIP${NC}: $1"; }
info() { echo -e "  ${YELLOW}INFO${NC}: $1"; }
detail() { echo -e "       $1"; }


# stellar CLI < 25.3 has no `contract info hash` subcommand; a wasm's hash is
# just its SHA-256, so fall back to a plain hash of the file in that case.
sha256_of_file() {
    local path="$1"
    if command -v sha256sum &>/dev/null; then
        sha256sum "$path" | awk '{print $1}'
    else
        shasum -a 256 "$path" | awk '{print $1}'
    fi
}

local_wasm_hash() {
    local path="$1"
    local hash
    hash=$(stellar contract info hash --wasm "$path" 2>/dev/null || true)
    if [[ -z "$hash" ]]; then
        hash=$(sha256_of_file "$path" 2>/dev/null || true)
    fi
    echo "$hash"
}

rpc_args() {
    local args=()
    if [[ -n "$RPC_URL" ]]; then
        args+=(--rpc-url "$RPC_URL")
    fi
    if [[ -n "$NETWORK_PASSPHRASE" ]]; then
        args+=(--network-passphrase "$NETWORK_PASSPHRASE")
    fi
    if [[ -n "$SOURCE_ACCOUNT" ]]; then
        args+=(--source-account "$SOURCE_ACCOUNT")
    fi
    if [[ -n "$NETWORK" ]]; then
        args+=(-n "$NETWORK")
    fi
    echo "${args[@]}"
}

# ── Step 0: Prerequisite checks ──────────────────────────────────────────────
check_prereqs() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Prerequisite checks"
    echo "═══════════════════════════════════════════════════════════════"

    if ! command -v stellar &>/dev/null; then
        fail "stellar CLI not found"
        return 1
    fi
    pass "stellar CLI $(stellar --version 2>&1 | head -1)"

    if ! command -v cargo &>/dev/null; then
        fail "cargo not found"
        return 1
    fi
    pass "cargo $(cargo --version 2>&1 | head -1)"

    if [[ -f "$CONFIG_FILE" ]]; then
        pass "Config file found: $CONFIG_FILE"
    else
        fail "Config file not found: $CONFIG_FILE"
        return 1
    fi

    load_network_config "$NETWORK"
    if [[ "$NETWORK" == "standalone" ]] || [[ -n "$RPC_URL" ]]; then
        pass "Network config loaded: $NETWORK"
    else
        skip "Network config for '$NETWORK' not in verify_config.toml (RPC URL inferred by stellar CLI)"
    fi
}

# ── Step 1: Build contract ───────────────────────────────────────────────────
build_contract() {
    local contract="$1"
    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo "  Step 1: Build $contract"
    echo "───────────────────────────────────────────────────────────────"

    if $SKIP_BUILD; then
        info "Build skipped (--skip-build)"
        # Verify WASM already exists
        if [[ -f "$WASM_DIR/${contract}.wasm" ]]; then
            pass "WASM artifact exists: $WASM_DIR/${contract}.wasm"
        else
            fail "WASM artifact not found at $WASM_DIR/${contract}.wasm"
            return 1
        fi
        return 0
    fi

    info "Building $contract (release, wasm32)..."
    local build_log
    build_log=$(mktemp)
    if cargo build --target "$WASM_TARGET" --release -p "$contract" 2>"$build_log"; then
        pass "$contract build succeeded"
    else
        fail "$contract build failed"
        detail "Build log:"
        cat "$build_log" >&2
        rm -f "$build_log"
        return 1
    fi
    rm -f "$build_log"

    if [[ ! -f "$WASM_DIR/${contract}.wasm" ]]; then
        fail "WASM artifact not produced at $WASM_DIR/${contract}.wasm"
        return 1
    fi
    pass "WASM artifact: $WASM_DIR/${contract}.wasm"
}

# ── Step 2: Verify WASM hash reproducibility ──────────────────────────────────
verify_wasm_hash() {
    local contract="$1"
    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo "  Step 2: WASM hash verification — $contract"
    echo "───────────────────────────────────────────────────────────────"

    local wasm_path="$WASM_DIR/${contract}.wasm"
    if [[ ! -f "$wasm_path" ]]; then
        fail "WASM file not found: $wasm_path"
        return 1
    fi

    # Compute local hash
    local local_hash
    local_hash=$(local_wasm_hash "$wasm_path")
    if [[ -z "$local_hash" ]]; then
        fail "Failed to compute local WASM hash"
        return 1
    fi
    pass "Local WASM hash: $local_hash"

    # Read expected hash from config
    local expected_hash
    expected_hash=$(toml_query "c = cfg.get('contracts', {}).get('$contract', {}); print(c.get('wasm_hash', ''))")

    if [[ -n "$expected_hash" ]]; then
        if [[ "$local_hash" == "$expected_hash" ]]; then
            pass "WASM hash matches expected pinned hash"
        else
            fail "WASM hash mismatch: expected $expected_hash, got $local_hash"
            detail "Run the following to pin the new hash:"
            detail "  stellar contract info hash --wasm \"$wasm_path\""
            return 1
        fi
    else
        info "No pinned hash in config — recording local hash as reference"
        detail "Local hash: $local_hash"
    fi

    # Get contract ID from config
    local contract_id
    contract_id=$(toml_query "n = cfg.get('network', {}).get('$NETWORK', {}); c = cfg.get('contracts', {}).get('$contract', {}); print(c.get('$NETWORK', {}).get('contract_id', ''))")

    if [[ -z "$contract_id" ]]; then
        info "No contract_id configured for $contract on $NETWORK — skipping on-chain hash comparison"
        return 0
    fi

    # Fetch on-chain hash
    info "Fetching on-chain WASM hash for $contract ($contract_id)..."
    local onchain_hash
    onchain_hash=$(stellar contract info hash $(rpc_args) --contract-id "$contract_id" 2>/dev/null || true)
    if [[ -z "$onchain_hash" ]]; then
        # stellar CLI < 25.3 has no `contract info hash --contract-id`; fetch
        # the deployed wasm and hash it locally instead.
        local fetched_wasm
        fetched_wasm=$(mktemp)
        if stellar contract fetch $(rpc_args) --id "$contract_id" -o "$fetched_wasm" 2>/dev/null; then
            onchain_hash=$(sha256_of_file "$fetched_wasm" 2>/dev/null || true)
        fi
        rm -f "$fetched_wasm"
    fi

    if [[ -z "$onchain_hash" ]]; then
        fail "Failed to fetch on-chain WASM hash for $contract_id"
        detail "Check that the network ($NETWORK) is reachable and contract ID is correct."
        return 1
    fi

    if [[ "$local_hash" == "$onchain_hash" ]]; then
        pass "On-chain hash matches local build: $local_hash"
    else
        fail "Hash mismatch!"
        detail "  Local build:  $local_hash"
        detail "  On-chain:     $onchain_hash"
        return 1
    fi
}

# ── Step 3: Verify admin key ──────────────────────────────────────────────────
verify_admin() {
    local contract="$1"
    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo "  Step 3: Admin key verification — $contract"
    echo "───────────────────────────────────────────────────────────────"

    local contract_id
    contract_id=$(toml_query "n = cfg.get('network', {}).get('$NETWORK', {}); c = cfg.get('contracts', {}).get('$contract', {}); print(c.get('$NETWORK', {}).get('contract_id', ''))")

    if [[ -z "$contract_id" ]]; then
        info "No contract_id configured for $contract on $NETWORK — skipping admin check"
        return 0
    fi

    local expected_admin
    expected_admin=$(toml_query "n = cfg.get('network', {}).get('$NETWORK', {}); c = cfg.get('contracts', {}).get('$contract', {}); print(c.get('$NETWORK', {}).get('admin', ''))")

    if [[ -z "$expected_admin" ]]; then
        info "No expected admin configured for $contract on $NETWORK — skipping admin check"
        detail "Add [contracts.$contract.$NETWORK.admin] to verify_config.toml"
        return 0
    fi

    local admin_param
    admin_param=$(toml_query "c = cfg.get('contracts', {}).get('$contract', {}).get('params', {}); print(c.get('admin_param', ''))")

    if [[ -z "$admin_param" ]]; then
        info "Contract $contract has no admin (no admin_param configured) — skipping admin check"
        return 0
    fi

    info "Expecting admin: $expected_admin"

    # Try invoking admin() read-only
    local onchain_admin
    onchain_admin=$(stellar contract invoke $(rpc_args) --id "$contract_id" --send=no -- admin 2>/dev/null || echo "")

    if [[ -n "$onchain_admin" ]]; then
        # Normalize — strip quotes
        onchain_admin="${onchain_admin//\"/}"
        if [[ "$onchain_admin" == "$expected_admin" ]]; then
            pass "admin() matches expected: $expected_admin"
        else
            fail "admin() mismatch: expected $expected_admin, got $onchain_admin"
            return 1
        fi
    else
        # Try reading DataKey::Admin from storage
        info "admin() not exposed — reading Admin storage entry..."
        local storage_admin
        storage_admin=$(stellar contract read $(rpc_args) --id "$contract_id" --key Admin --output string 2>/dev/null || echo "")

        if [[ -n "$storage_admin" ]]; then
            storage_admin="${storage_admin//\"/}"
            if [[ "$storage_admin" == "$expected_admin" ]]; then
                pass "Admin storage entry matches expected: $expected_admin"
            else
                fail "Admin storage entry mismatch: expected $expected_admin, got $storage_admin"
                return 1
            fi
        else
            fail "Could not read admin from contract"
            detail "The contract may use a different storage key pattern."
            return 1
        fi
    fi
}

# ── Step 4: Verify extra state / constructor parameters ──────────────────────
verify_state() {
    local contract="$1"
    echo ""
    echo "───────────────────────────────────────────────────────────────"
    echo "  Step 4: State / constructor verification — $contract"
    echo "───────────────────────────────────────────────────────────────"

    local contract_id
    contract_id=$(toml_query "n = cfg.get('network', {}).get('$NETWORK', {}); c = cfg.get('contracts', {}).get('$contract', {}); print(c.get('$NETWORK', {}).get('contract_id', ''))")

    if [[ -z "$contract_id" ]]; then
        info "No contract_id configured — skipping state check"
        return 0
    fi

    # Read expected admin to compare init params
    local expected_admin
    expected_admin=$(toml_query "n = cfg.get('network', {}).get('$NETWORK', {}); c = cfg.get('contracts', {}).get('$contract', {}); print(c.get('$NETWORK', {}).get('admin', ''))")

    # ── Contract-specific state checks ──────────────────────────────────
    case "$contract" in
        orgusd)
            # OrgUSD: verify total_supply == 0 after init
            local total_supply
            total_supply=$(stellar contract invoke $(rpc_args) --id "$contract_id" --send=no -- total_supply 2>/dev/null || echo "")
            if [[ "$total_supply" == "0" ]]; then
                pass "total_supply == 0 (expected after init)"
            elif [[ -n "$total_supply" ]]; then
                info "total_supply = $total_supply (non-zero — contract has been used)"
            else
                skip "total_supply() not exposed"
            fi
            ;;

        revenue_split)
            # Revenue split: verify recipients were stored
            local recipients
            recipients=$(stellar contract read $(rpc_args) --id "$contract_id" --key Recipients --output json 2>/dev/null || echo "")
            if [[ -n "$recipients" && "$recipients" != "null" ]]; then
                pass "Recipients storage entry exists"
                detail "Recipients: $recipients"
            else
                fail "Recipients storage entry not found — contract may not be initialized"
                return 1
            fi

            local dist_count
            dist_count=$(stellar contract read $(rpc_args) --id "$contract_id" --key DistributionCount --output string 2>/dev/null || echo "")
            if [[ -n "$dist_count" ]]; then
                pass "DistributionCount storage entry exists: $dist_count"
            else
                info "DistributionCount — could not read (persistent, may need specific key format)"
            fi
            ;;

        vesting_escrow)
            # Vesting escrow: verify Config storage entry
            local config
            config=$(stellar contract read $(rpc_args) --id "$contract_id" --key Config --output json 2>/dev/null || echo "")
            if [[ -n "$config" && "$config" != "null" ]]; then
                pass "Config storage entry exists"
                detail "Config: $config"
            else
                fail "Config storage entry not found — contract may not be initialized"
                return 1
            fi
            ;;

        smart_wallet)
            # Smart wallet: verify signers and threshold
            local signers
            signers=$(stellar contract invoke $(rpc_args) --id "$contract_id" --send=no -- signers 2>/dev/null || echo "")
            if [[ -n "$signers" ]]; then
                pass "signers() exposed and accessible"
                detail "Signers: $signers"
            else
                skip "signers() not exposed or requires auth"
            fi

            local threshold
            threshold=$(stellar contract invoke $(rpc_args) --id "$contract_id" --send=no -- threshold 2>/dev/null || echo "")
            if [[ -n "$threshold" ]]; then
                pass "threshold() exposed: $threshold"
            else
                skip "threshold() not exposed or requires auth"
            fi
            ;;

        bulk_payment|cross_asset_payment|asset_path_payment)
            # Contracts with a count variable: verify it exists
            local count_key
            case "$contract" in
                bulk_payment)          count_key="BatchCount" ;;
                cross_asset_payment)   count_key="PaymentCount" ;;
                asset_path_payment)    count_key="PaymentCount" ;;
            esac

            local count_val
            count_val=$(stellar contract read $(rpc_args) --id "$contract_id" --key "$count_key" --output string 2>/dev/null || echo "")
            if [[ -n "$count_val" ]]; then
                pass "$count_key storage entry exists: $count_val"
            else
                info "$count_key — could not read (may use a different key format or not yet written)"
            fi
            ;;

        milestone_escrow)
            local escrow_count
            escrow_count=$(stellar contract read $(rpc_args) --id "$contract_id" --key EscrowCount --output string 2>/dev/null || echo "")
            if [[ -n "$escrow_count" ]]; then
                pass "EscrowCount storage entry exists: $escrow_count"
            else
                info "EscrowCount — could not read"
            fi
            ;;
    esac
}

# ── Verify a single contract ──────────────────────────────────────────────────
verify_contract() {
    local contract="$1"

    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  Verifying contract: $contract"
    echo "╚══════════════════════════════════════════════════════════════╝"

    build_contract "$contract" || return 1
    verify_wasm_hash "$contract" || return 1
    verify_admin "$contract" || return 1
    verify_state "$contract" || return 1
}

# ── Summary ───────────────────────────────────────────────────────────────────
summary() {
    local exit_code=0
    if [[ "$FAIL_COUNT" -gt 0 ]]; then
        exit_code=1
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Verification Summary"
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}Passed${NC}: $PASS_COUNT"
    echo -e "  ${RED}Failed${NC}: $FAIL_COUNT"
    echo -e "  ${YELLOW}Skipped${NC}: $SKIP_COUNT"
    echo "═══════════════════════════════════════════════════════════════"

    if [[ "$FAIL_COUNT" -gt 0 ]]; then
        echo -e "\n${RED}Verification FAILED.${NC}"
    else
        echo -e "\n${GREEN}All checks passed.${NC}"
    fi

    return "$exit_code"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    local any_failed=false

    echo "═══════════════════════════════════════════════════════════════"
    echo "  PayD Contract Deployment Verification"
    echo "  Network: $NETWORK"
    echo "  Contracts: ${SELECTED_CONTRACTS[*]}"
    echo "═══════════════════════════════════════════════════════════════"

    check_prereqs || { summary; exit 1; }

    for contract in "${SELECTED_CONTRACTS[@]}"; do
        if verify_contract "$contract"; then
            true  # already counted
        else
            any_failed=true
        fi
    done

    summary
    if $any_failed; then
        exit 1
    fi
}

main
