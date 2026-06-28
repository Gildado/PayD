import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doc = readFileSync(
  new URL("../docs/API_AUTHENTICATION_FLOW.md", import.meta.url),
  "utf8",
);

test("auth flow docs describe JWT usage and the current lack of session cookies", () => {
  assert.match(doc, /JWT bearer tokens/i);
  assert.match(
    doc,
    /Session cookies are not currently set by the backend auth controller/i,
  );
  assert.match(doc, /Authorization` header/i);
  assert.match(doc, /localStorage/i);
  assert.match(doc, /POST \/api\/auth\/refresh/i);
});
