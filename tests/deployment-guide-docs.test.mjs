import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const guide = readFileSync(
  new URL('../docs/DEPLOYMENT_GUIDE_VERCEL_RENDER.md', import.meta.url),
  'utf8'
);

test('README links deployment guide', () => {
  assert.match(readme, /DEPLOYMENT_GUIDE_VERCEL_RENDER\.md/);
});

test('deployment guide covers Vercel and Render setup', () => {
  assert.match(guide, /Deploy Backend on Render/i);
  assert.match(guide, /Deploy Frontend on Vercel/i);
  assert.match(guide, /Post-Deploy Validation Checklist/i);
});
