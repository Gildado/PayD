import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  WORKFLOW_REGISTRY,
  NON_WORKFLOW_FILES,
  REGISTERED_WORKFLOW_FILES,
} from '../registry.js';

const workflowsDir = path.resolve(__dirname, '..');
const docPath = path.resolve(__dirname, '../../../../docs/ORCHESTRATION_WORKFLOWS.md');

function diskWorkflowFiles(): string[] {
  return readdirSync(workflowsDir)
    .filter((entry) => entry.endsWith('.ts'))
    .filter((entry) => !NON_WORKFLOW_FILES.includes(entry))
    .sort();
}

function unbacktick(value: string): string {
  return value.replace(/^`|`$/g, '').trim();
}

/** Parse the "Workflow catalog" table: `| Workflow | Source file |`. */
function documentedWorkflows(): Map<string, string> {
  const doc = readFileSync(docPath, 'utf8');
  const section = doc.split('## Workflow catalog')[1];
  expect(section).toBeDefined();

  const documented = new Map<string, string>();
  for (const line of section.split('\n')) {
    if (!/^\|\s*`/.test(line)) continue;
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    expect(cells).toHaveLength(2);
    const [name, file] = cells.map(unbacktick);
    expect(documented.has(file)).toBe(false); // no duplicate rows
    documented.set(file, name);
  }
  return documented;
}

function slugFromFile(file: string): string {
  const base = file.replace(/\.ts$/, '').replace(/Workflow$/, '');
  return base.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase();
}

describe('Workflow registry consistency', () => {
  it('has no duplicate registry entries', () => {
    const files = WORKFLOW_REGISTRY.map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
    expect(REGISTERED_WORKFLOW_FILES.size).toBe(files.length);
  });

  it('fails when a workflow file is unregistered or a registry entry has no file', () => {
    const onDisk = diskWorkflowFiles();
    const registered = [...REGISTERED_WORKFLOW_FILES].sort();

    const unregistered = onDisk.filter((file) => !REGISTERED_WORKFLOW_FILES.has(file));
    const stale = registered.filter((file) => !onDisk.includes(file));

    expect({ unregistered, stale }).toEqual({ unregistered: [], stale: [] });
    expect(registered).toEqual(onDisk);
  });

  it('fails when a workflow is undocumented or documented without a source file', () => {
    const documented = documentedWorkflows();
    const registeredFiles = [...REGISTERED_WORKFLOW_FILES].sort();
    const documentedFiles = [...documented.keys()].sort();

    const undocumented = registeredFiles.filter((file) => !documented.has(file));
    const notRegistered = documentedFiles.filter((file) => !REGISTERED_WORKFLOW_FILES.has(file));

    expect({ undocumented, notRegistered }).toEqual({ undocumented: [], notRegistered: [] });
  });

  it('keeps documented names aligned with the registry', () => {
    const documented = documentedWorkflows();
    for (const entry of WORKFLOW_REGISTRY) {
      expect(documented.get(entry.file)).toBe(entry.name);
    }
  });

  it('asserts each registered name is actually declared in its source module', () => {
    for (const entry of WORKFLOW_REGISTRY) {
      const source = readFileSync(path.join(workflowsDir, entry.file), 'utf8');
      const declaredInSource = source.includes(entry.name);
      const derivedFromFilename = slugFromFile(entry.file) === entry.name;
      if (!declaredInSource && !derivedFromFilename) {
        throw new Error(
          `${entry.file}: registry name "${entry.name}" is not declared in the source`
        );
      }
      expect(declaredInSource || derivedFromFilename).toBe(true);
    }
  });

  it('catalogs every workflow module (guards against an empty table passing)', () => {
    expect(WORKFLOW_REGISTRY.length).toBeGreaterThan(30);
    expect(documentedWorkflows().size).toBe(WORKFLOW_REGISTRY.length);
  });
});
