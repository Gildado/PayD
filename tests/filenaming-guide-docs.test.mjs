import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const contributing = readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../docs/FILENAMING_CONVENTIONS.md', import.meta.url), 'utf8');

test('README links filenaming convention guide', () => {
  assert.match(readme, /FILENAMING_CONVENTIONS\.md/);
});

test('CONTRIBUTING links the filenaming guide for contributors', () => {
  assert.match(contributing, /FILENAMING_CONVENTIONS\.md/);
  assert.match(contributing, /PascalCase/);
  assert.match(contributing, /camelCase/);
  assert.match(contributing, /kebab-case/i);
});

test('filenaming guide documents kebab-case and camelCase usage', () => {
  assert.match(guide, /kebab-case/i);
  assert.match(guide, /camelCase/);
  assert.match(guide, /PascalCase/);
  assert.match(guide, /Naming Matrix/i);
});
