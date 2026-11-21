#!/usr/bin/env node
/**
 * Generate TypeScript types for the backend API from backend/openapi.json (issue #1808).
 *
 * Output: src/api/generated/openapi.ts
 *
 *   npm run api:types         Regenerate the file (commit the result)
 *   npm run api:types:check   Exit 1 if the committed file is stale (used in CI)
 *
 * The generated file is never edited by hand. To change a type, change the
 * OpenAPI spec in backend/openapi.json and regenerate.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
export const SPEC_PATH = resolve(here, '../../backend/openapi.json');
export const OUTPUT_PATH = resolve(here, '../src/api/generated/openapi.ts');

const HEADER = `// AUTO-GENERATED from backend/openapi.json by frontend/scripts/generate-api-types.mjs.
// Do not edit by hand. Regenerate with \`npm run api:types\`.
// CI runs \`npm run api:types:check\` and fails when this file is stale.

`;

/** Build the full contents of the generated module from the spec on disk. */
export async function generateApiTypes(specPath = SPEC_PATH) {
  const spec = JSON.parse(await readFile(specPath, 'utf8'));
  const ast = await openapiTS(spec);
  return HEADER + astToString(ast);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const next = await generateApiTypes();

  let current = null;
  try {
    current = await readFile(OUTPUT_PATH, 'utf8');
  } catch {
    current = null;
  }

  if (checkOnly) {
    if (current !== next) {
      console.error(
        `${OUTPUT_PATH} is out of date with backend/openapi.json.\n` +
          'Run "npm run api:types" in frontend/ and commit the result.'
      );
      process.exit(1);
    }
    console.log('Generated API types are up to date.');
    return;
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, next);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
