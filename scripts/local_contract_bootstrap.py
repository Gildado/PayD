#!/usr/bin/env python3
"""Bootstrap Soroban contracts for local development.

This helper builds contract WASM artifacts, deploys them to the configured
local Stellar network, and initializes the contracts that have a simple,
deterministic bootstrap recipe.

By default it targets the repo's workspace contracts and uses the local
Stellar identity `psalmuel` as both the deploy source and admin account.
Override either value with command-line flags when needed.
"""

from __future__ import annotations

import argparse
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

CONTRACT_ID_PATTERN = re.compile(r"\bC[A-Z0-9]{55}\b")


@dataclass(frozen=True)
class ContractRecipe:
    crate: str
    init_function: str | None = None
    init_arguments: tuple[str, ...] = ()
    note: str | None = None

    @property
    def has_bootstrap(self) -> bool:
        return self.init_function is not None


SUPPORTED_CONTRACTS: dict[str, ContractRecipe] = {
    "bulk_payment": ContractRecipe(
        crate="bulk_payment",
        init_function="initialize",
        init_arguments=("--admin", "{admin_account}"),
    ),
    "cross_asset_payment": ContractRecipe(
        crate="cross_asset_payment",
        init_function="init",
        init_arguments=("--admin", "{admin_account}"),
    ),
    "asset_path_payment": ContractRecipe(
        crate="asset_path_payment",
        init_function="init",
        init_arguments=("--admin", "{admin_account}"),
    ),
    "revenue_split": ContractRecipe(
        crate="revenue_split",
        note=(
            "Deploy-only by default. The init function takes a structured"
            " RecipientShare vector, so pass a custom invoke tail when you"
            " need to seed allocations."
        ),
    ),
    "vesting_escrow": ContractRecipe(
        crate="vesting_escrow",
        note=(
            "Deploy-only by default. The initializer needs funding, token,"
            " vesting, and clawback parameters."
        ),
    ),
    "smart_wallet": ContractRecipe(
        crate="smart_wallet",
        note=(
            "Deploy-only by default. The wallet initializer needs a signer"
            " vector and threshold."
        ),
    ),
}

DEFAULT_CONTRACT_ORDER: tuple[str, ...] = (
    "bulk_payment",
    "cross_asset_payment",
    "asset_path_payment",
    "revenue_split",
    "vesting_escrow",
    "smart_wallet",
)


@dataclass(frozen=True)
class BootstrapContext:
    workspace_root: Path
    network: str
    source_account: str
    admin_account: str
    dry_run: bool
    run_tests: bool
    skip_build: bool


def parse_contracts(raw_values: Sequence[str]) -> list[str]:
    if not raw_values:
        return list(DEFAULT_CONTRACT_ORDER)

    selected: list[str] = []
    for raw_value in raw_values:
        parts = [value.strip() for value in raw_value.split(",")]
        for part in parts:
            if not part:
                continue
            if part == "all":
                for contract_name in DEFAULT_CONTRACT_ORDER:
                    if contract_name not in selected:
                        selected.append(contract_name)
                continue
            if part not in SUPPORTED_CONTRACTS:
                raise ValueError(
                    f"Unknown contract '{part}'. Supported values: "
                    f"{', '.join(SUPPORTED_CONTRACTS)}"
                )
            if part not in selected:
                selected.append(part)

    return selected


def render_command(command: Sequence[str]) -> str:
    return shlex.join(command)


def run_command(
    command: Sequence[str],
    *,
    workspace_root: Path,
    dry_run: bool,
) -> subprocess.CompletedProcess[str] | None:
    rendered = render_command(command)
    print(f"  $ {rendered}")

    if dry_run:
        return None

    completed = subprocess.run(
        list(command),
        cwd=workspace_root,
        text=True,
        capture_output=True,
        check=False,
    )

    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="", file=sys.stderr)
    if completed.returncode != 0:
        raise subprocess.CalledProcessError(
            completed.returncode,
            list(command),
            output=completed.stdout,
            stderr=completed.stderr,
        )
    return completed


def resolve_placeholder(value: str, *, context: BootstrapContext) -> str:
    return value.format(
        admin_account=context.admin_account,
        source_account=context.source_account,
    )


def build_wasm_path(workspace_root: Path, crate: str) -> Path:
    return workspace_root / "target" / "wasm32-unknown-unknown" / "release" / f"{crate}.wasm"


def build_test_command(crate: str) -> list[str]:
    return ["cargo", "test", "-p", crate, "--lib", "--tests"]


def build_compile_command(crate: str) -> list[str]:
    return [
        "cargo",
        "build",
        "-p",
        crate,
        "--target",
        "wasm32-unknown-unknown",
        "--release",
    ]


def build_deploy_command(context: BootstrapContext, wasm_path: Path) -> list[str]:
    return [
        "stellar",
        "contract",
        "deploy",
        "--network",
        context.network,
        "--source-account",
        context.source_account,
        "--wasm",
        str(wasm_path),
    ]


def build_invoke_command(
    context: BootstrapContext,
    contract_id: str,
    recipe: ContractRecipe,
) -> list[str]:
    if recipe.init_function is None:
        raise ValueError(f"Contract '{recipe.crate}' does not define an init function")

    command = [
        "stellar",
        "contract",
        "invoke",
        "--network",
        context.network,
        "--id",
        contract_id,
        "--source-account",
        context.source_account,
        "--",
        recipe.init_function,
    ]

    for arg in recipe.init_arguments:
        command.append(resolve_placeholder(arg, context=context))

    return command


def extract_contract_id(output: str) -> str:
    matches = CONTRACT_ID_PATTERN.findall(output)
    if not matches:
        raise ValueError("Could not find a Stellar contract id in deploy output.")
    return matches[-1]


def bootstrap_contract(contract_name: str, context: BootstrapContext) -> None:
    recipe = SUPPORTED_CONTRACTS[contract_name]
    print(f"\n[{contract_name}]")

    if context.run_tests:
        print("  tests:")
        run_command(
            build_test_command(recipe.crate),
            workspace_root=context.workspace_root,
            dry_run=context.dry_run,
        )
    else:
        print("  tests: skipped")

    if context.skip_build:
        wasm_path = build_wasm_path(context.workspace_root, recipe.crate)
        print(f"  build: skipped (using {wasm_path})")
    else:
        print("  build:")
        run_command(
            build_compile_command(recipe.crate),
            workspace_root=context.workspace_root,
            dry_run=context.dry_run,
        )
        wasm_path = build_wasm_path(context.workspace_root, recipe.crate)

    print("  deploy:")
    deploy_result = run_command(
        build_deploy_command(context, wasm_path),
        workspace_root=context.workspace_root,
        dry_run=context.dry_run,
    )

    contract_id = "deployed-contract-id"
    if deploy_result is not None:
        contract_id = extract_contract_id(
            (deploy_result.stdout or "") + "\n" + (deploy_result.stderr or "")
        )
        print(f"  -> contract id: {contract_id}")

    if recipe.init_function is None:
        if recipe.note:
            print(f"  init: skipped ({recipe.note})")
        else:
            print("  init: skipped")
        return

    print("  init:")
    init_command = build_invoke_command(context, contract_id, recipe)
    run_command(init_command, workspace_root=context.workspace_root, dry_run=context.dry_run)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Build, deploy, and bootstrap local Soroban contracts for the PayD workspace."
        )
    )
    parser.add_argument(
        "--contract",
        action="append",
        default=[],
        help=(
            "Contract name to process. Can be repeated or comma-separated. "
            "Defaults to all workspace contracts."
        ),
    )
    parser.add_argument(
        "--network",
        default="local",
        help="Stellar network name to pass to the CLI (default: local).",
    )
    parser.add_argument(
        "--source-account",
        default="psalmuel",
        help=(
            "Identity or address used to deploy and submit contract calls "
            "(default: psalmuel)."
        ),
    )
    parser.add_argument(
        "--admin-account",
        default=None,
        help=(
            "Address passed to init functions that require an admin. "
            "Defaults to --source-account."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the commands without executing them.",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip the cargo test step before building and deploying.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip the wasm build step and reuse the existing artifact path.",
    )
    parser.add_argument(
        "--workspace-root",
        default=None,
        help="Override the repo root used for cargo commands.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    workspace_root = (
        Path(args.workspace_root).resolve()
        if args.workspace_root
        else Path(__file__).resolve().parents[1]
    )

    try:
        selected_contracts = parse_contracts(args.contract)
    except ValueError as exc:
        parser.error(str(exc))
        return 2

    context = BootstrapContext(
        workspace_root=workspace_root,
        network=args.network,
        source_account=args.source_account,
        admin_account=args.admin_account or args.source_account,
        dry_run=args.dry_run,
        run_tests=not args.skip_tests,
        skip_build=args.skip_build,
    )

    print("Local Soroban contract bootstrap")
    print(f"workspace: {context.workspace_root}")
    print(f"network: {context.network}")
    print(f"source account: {context.source_account}")
    print(f"admin account: {context.admin_account}")
    print(f"mode: {'dry-run' if context.dry_run else 'execute'}")

    for contract_name in selected_contracts:
        bootstrap_contract(contract_name, context)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
