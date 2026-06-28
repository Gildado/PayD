import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const license = readFileSync(new URL("../LICENSE", import.meta.url), "utf8");

test("README highlights the MIT license", () => {
  assert.match(readme, /\[!\[License(?:: MIT)?\][^\]]*\]\(LICENSE\)/i);
  assert.match(readme, /##\s+License/i);
  assert.match(readme, /\[MIT License\]\(LICENSE\)/i);
});

test("LICENSE reflects the current year", () => {
  assert.match(license, /^MIT License/m);
  assert.match(license, /Copyright \(c\) 2026 The Aha Company/i);
});
