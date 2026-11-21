import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexFiles = ['docs/README.md', 'docs/archive/README.md'];
const linked = new Map();
const broken = [];
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
for (const relativeFile of indexFiles) {
  const file = path.join(root, relativeFile);
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(markdownLink)) {
    let target = match[1].trim().split(/\s+/, 1)[0];
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    const pathname = decodeURIComponent(target.split('#', 1)[0].split('?', 1)[0]);
    if (!pathname) continue;
    const resolved = path.resolve(path.dirname(file), pathname);
    if (!fs.existsSync(resolved)) {
      broken.push(`${relativeFile}: ${target}`);
      continue;
    }
    if (pathname.toLowerCase().endsWith('.md')) {
      const normalized = path.relative(root, resolved);
      linked.set(normalized, (linked.get(normalized) ?? 0) + 1);
    }
  }
}

const expected = new Set();
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) expected.add(entry.name);
}
function collectDocs(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectDocs(fullPath);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const relative = path.relative(root, fullPath);
      if (relative !== 'docs/README.md') expected.add(relative);
    }
  }
}
collectDocs(path.join(root, 'docs'));
const missing = [...expected].filter((file) => !linked.has(file));
const repeated = [...linked].filter(([file, count]) => expected.has(file) && count !== 1).map(([file, count]) => `${file} (${count} entries)`);
if (broken.length || missing.length || repeated.length) {
  console.error('Documentation index check failed.');
  for (const item of broken) console.error(`- Broken link: ${item}`);
  for (const item of missing) console.error(`- Missing from index: ${item}`);
  for (const item of repeated) console.error(`- Listed more than once: ${item}`);
  process.exitCode = 1;
} else {
  console.log(`Checked index links and coverage for ${expected.size} Markdown documents.`);
}
