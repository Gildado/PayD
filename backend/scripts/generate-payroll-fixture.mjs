// Deterministic CSV fixture generator for the 10k-row import benchmark.
// Run with: node scripts/generate-payroll-fixture.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROWS = Number(process.env.PAYROLL_FIXTURE_ROWS ?? 10_000);
const OUTPUT = resolve(process.cwd(), 'src/benchmarks/fixtures/payroll-10k.csv');

const WALLET = 'GA3FCUM5BQJY64JGGOFLBOV6BHQ3TGTZGWX3F4GUCQUWFDT3KTJMFQUE';
const CURRENCIES = ['USDC', 'XLM', 'USD', 'EUR', 'GBP', 'KES', 'NGN'];
const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Operations'];
const POSITIONS = ['Software Engineer', 'Product Manager', 'Designer', 'Operations Specialist'];

const lines = [
  'first_name,last_name,email,wallet_address,position,department,base_salary,base_currency',
];

for (let i = 1; i <= ROWS; i += 1) {
  const id = String(i).padStart(5, '0');
  lines.push(
    [
      'Employee',
      id,
      `employee${id}@example.com`,
      WALLET,
      POSITIONS[i % POSITIONS.length],
      DEPARTMENTS[i % DEPARTMENTS.length],
      String(3000 + (i % 5000)),
      CURRENCIES[i % CURRENCIES.length],
    ].join(',')
  );
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${ROWS} rows to ${OUTPUT}`);
