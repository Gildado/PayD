import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const scriptPath = new URL('../scripts/local_contract_bootstrap.py', import.meta.url);
const scriptFilePath = fileURLToPath(scriptPath);

test('bootstrap script compiles and prints the local deploy plan', () => {
  execFileSync('python3', ['-m', 'py_compile', scriptFilePath], {
    stdio: 'pipe',
  });

  const output = execFileSync(
    'python3',
    [
      scriptFilePath,
      '--dry-run',
      '--skip-tests',
      '--contract',
      'bulk_payment,cross_asset_payment,asset_path_payment,revenue_split',
      '--source-account',
      'psalmuel',
    ],
    { encoding: 'utf8' }
  );

  assert.match(output, /Local Soroban contract bootstrap/);
  assert.match(output, /bulk_payment/);
  assert.match(
    output,
    /cargo build -p bulk_payment --target wasm32-unknown-unknown --release/
  );
  assert.match(
    output,
    /stellar contract deploy --network local --source-account psalmuel --wasm/
  );
  assert.match(
    output,
    /stellar contract invoke --network local --id deployed-contract-id --source-account psalmuel -- initialize --admin psalmuel/
  );
  assert.match(output, /init: skipped \(Deploy-only by default\./);
});

test('bootstrap script documents the supported contracts in its source', () => {
  const source = readFileSync(scriptFilePath, 'utf8');
  assert.match(source, /bulk_payment/);
  assert.match(source, /revenue_split/);
  assert.match(source, /vesting_escrow/);
});
