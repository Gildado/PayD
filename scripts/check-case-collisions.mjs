import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const byFoldedPath = new Map();
const collisions = [];
for (const file of files) {
  const folded = file.toLocaleLowerCase('en-US');
  const previous = byFoldedPath.get(folded);
  if (previous && previous !== file) collisions.push([previous, file]);
  else byFoldedPath.set(folded, file);
}

if (collisions.length) {
  console.error('Case-insensitive path collisions found:');
  for (const [first, second] of collisions) console.error(`- ${first}\n- ${second}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} tracked paths; no case-insensitive collisions found.`);
}
