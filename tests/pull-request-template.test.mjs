import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const templatePath = new URL('../.github/pull_request_template.md', import.meta.url);
const contributingPath = new URL('../CONTRIBUTING.md', import.meta.url);

test('pull request template exists and includes the required checklist items', () => {
  assert.equal(existsSync(templatePath), true, 'pull_request_template.md should exist');

  const template = readFileSync(templatePath, 'utf8');
  assert.match(template, /##\s+Summary/i);
  assert.match(template, /##\s+What Changed/i);
  assert.match(template, /##\s+Checklist/i);
  assert.match(template, /\[\s\]\s+I added or updated tests for the change\./i);
  assert.match(template, /\[\s\]\s+I updated documentation where needed, or explained why it was not needed\./i);
  assert.match(
    template,
    /\[\s\]\s+If this change touches the UI, I verified responsive behavior and accessibility\./i
  );
  assert.match(template, /##\s+Testing/i);
  assert.match(template, /##\s+Documentation/i);
  assert.match(template, /##\s+Accessibility \/ Responsiveness/i);
});

test('contributing guide points contributors to the pull request template', () => {
  const contributing = readFileSync(contributingPath, 'utf8');

  assert.match(contributing, /pull_request_template\.md/i);
  assert.match(contributing, /tests, docs, and accessibility/i);
});
