import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const contributors = readFileSync(new URL("../CONTRIBUTORS.md", import.meta.url), "utf8");

test("README includes a visible credits section for contributors", () => {
  assert.match(readme, /##\s+Credits/i);
  assert.match(readme, /\[CONTRIBUTORS\.md\]\(CONTRIBUTORS\.md\)/i);
  assert.match(readme, /thank(s| you)/i);
});

test("CONTRIBUTORS.md includes an explicit credits message", () => {
  assert.match(contributors, /##\s+.*Credits/i);
  assert.match(contributors, /thank you to everyone who has contributed/i);
});
