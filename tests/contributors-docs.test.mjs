import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const readmePath = new URL('../README.md', import.meta.url);
const contributorsPath = new URL('../CONTRIBUTORS.md', import.meta.url);

test('CONTRIBUTORS.md exists and is well-formed', () => {
  // 1. File exists
  assert.ok(existsSync(contributorsPath), 'CONTRIBUTORS.md should exist');

  const contributors = readFileSync(contributorsPath, 'utf8');

  // 2. Contains a top-level Contributors heading
  assert.match(contributors, /^#\s+.*Contributors/im);

  // 3. Contains at least one contributor entry (a github.com link in a table)
  assert.match(contributors, /https:\/\/github\.com\//i);
});

test('README.md links to the Contributors section', () => {
  const readme = readFileSync(readmePath, 'utf8');

  // 1. Contains a Contributors heading
  assert.match(readme, /##\s+.*Contributors/im);

  // 2. Contains a link to the CONTRIBUTORS.md file
  assert.match(readme, /\[.*\]\(CONTRIBUTORS\.md\)/i);
});
