import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rootEnvExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const backendEnvExample = readFileSync(new URL('../backend/.env.example', import.meta.url), 'utf8');

function hasNearbyComment(content, variableName) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex(
    (line) => line.trim().startsWith(`${variableName}=`) && !line.trim().startsWith('#')
  );

  if (index <= 0) {
    return false;
  }

  const priorLines = lines.slice(Math.max(0, index - 3), index);
  return priorLines.some((line) => line.trim().startsWith('#'));
}

function countVariableDefinitions(content, variableName) {
  const lines = content.split(/\r?\n/);
  return lines.filter(
    (line) => line.trim().startsWith(`${variableName}=`) && !line.trim().startsWith('#')
  ).length;
}

test('root .env.example documents required frontend/runtime variables', () => {
  const requiredRootVariables = [
    'STELLAR_SCAFFOLD_ENV',
    'PUBLIC_STELLAR_NETWORK',
    'PUBLIC_STELLAR_NETWORK_PASSPHRASE',
    'PUBLIC_STELLAR_RPC_URL',
    'PUBLIC_STELLAR_HORIZON_URL',
    'VITE_API_URL',
    'VITE_BACKEND_URL',
  ];

  for (const variableName of requiredRootVariables) {
    assert.match(rootEnvExample, new RegExp(`^${variableName}=`, 'm'));
    assert.equal(hasNearbyComment(rootEnvExample, variableName), true);
  }
});

test('backend .env.example documents required backend variables', () => {
  const requiredBackendVariables = [
    'PORT',
    'NODE_ENV',
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGIN',
    'STELLAR_NETWORK_PASSPHRASE',
    'STELLAR_HORIZON_URL',
    'EMAIL_PROVIDER',
  ];

  for (const variableName of requiredBackendVariables) {
    assert.match(backendEnvExample, new RegExp(`^${variableName}=`, 'm'));
    assert.equal(hasNearbyComment(backendEnvExample, variableName), true);
  }
});

test('backend .env.example does not duplicate core keys', () => {
  const keysExpectedOnce = ['PORT', 'NODE_ENV', 'DATABASE_URL'];

  for (const variableName of keysExpectedOnce) {
    assert.equal(
      countVariableDefinitions(backendEnvExample, variableName),
      1,
      `${variableName} should be defined exactly once in backend/.env.example`
    );
  }
});
