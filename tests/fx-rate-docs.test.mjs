import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const readmePath = new URL('../README.md', import.meta.url);
const fxDocPath = new URL('../docs/FX_RATE_FETCHING_LOGIC.md', import.meta.url);

test('FX_RATE_FETCHING_LOGIC.md exists and is well-formed', () => {
  // 1. File exists
  assert.ok(existsSync(fxDocPath), 'FX_RATE_FETCHING_LOGIC.md should exist');

  const fxDoc = readFileSync(fxDocPath, 'utf8');

  // 2. Contains the required architecture explanation
  assert.match(fxDoc, /Redis Cache/i);
  assert.match(fxDoc, /open\.er-api\.com/i);
  assert.match(fxDoc, /api\.coinbase\.com/i);
});

test('README.md links to the FX Rate Fetching Logic docs', () => {
  const readme = readFileSync(readmePath, 'utf8');

  // 1. Contains a link to the FX_RATE_FETCHING_LOGIC.md file under FX system
  assert.match(readme, /\[.*\]\(docs\/FX_RATE_FETCHING_LOGIC\.md\)/i);
});
