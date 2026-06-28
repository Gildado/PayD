import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("README includes a three-step quick start section", () => {
  assert.match(readme, /##\s+[^\n]*Quick Start/i);
  assert.match(readme, /1\.\s+\*\*Clone and enter the repo\*\*/);
  assert.match(readme, /2\.\s+\*\*Install dependencies\*\*/);
  assert.match(
    readme,
    /3\.\s+\*\*Create your local environment and start the app\*\*/,
  );
  assert.ok(
    readme.indexOf("1. **Clone and enter the repo**") <
      readme.indexOf("2. **Install dependencies**"),
  );
  assert.ok(
    readme.indexOf("2. **Install dependencies**") <
      readme.indexOf("3. **Create your local environment and start the app**"),
  );
});
