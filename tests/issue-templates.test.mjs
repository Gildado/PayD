import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const bugTemplatePath = new URL('../.github/ISSUE_TEMPLATE/bug_report.yml', import.meta.url);
const featureTemplatePath = new URL('../.github/ISSUE_TEMPLATE/feature_request.yml', import.meta.url);

test('bug report issue template exists with required sections', () => {
  assert.equal(existsSync(bugTemplatePath), true, 'bug_report.yml should exist');
  const template = readFileSync(bugTemplatePath, 'utf8');

  assert.match(template, /name:\s*Bug Report/i);
  assert.match(template, /label:\s*Summary/i);
  assert.match(template, /label:\s*Steps To Reproduce/i);
  assert.match(template, /label:\s*Expected Behavior/i);
  assert.match(template, /label:\s*Actual Behavior/i);
  assert.match(template, /label:\s*Accessibility Impact/i);
});

test('feature request issue template exists with required sections', () => {
  assert.equal(existsSync(featureTemplatePath), true, 'feature_request.yml should exist');
  const template = readFileSync(featureTemplatePath, 'utf8');

  assert.match(template, /name:\s*Feature Request/i);
  assert.match(template, /label:\s*Problem Statement/i);
  assert.match(template, /label:\s*Proposed Solution/i);
  assert.match(template, /label:\s*Category/i);
  assert.match(template, /label:\s*Accessibility Considerations/i);
  assert.match(template, /label:\s*Acceptance Criteria/i);
});
