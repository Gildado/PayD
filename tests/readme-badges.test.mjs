import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("README exposes build, license, and Stellar badges near the top", () => {
  const readmeHeader = readme.split("\n").slice(0, 8).join("\n");

  assert.match(
    readmeHeader,
    /\[!\[Build Status\]\(https:\/\/github\.com\/Gildado\/PayD\/actions\/workflows\/build\.yml\/badge\.svg\?branch=main\)\]\(https:\/\/github\.com\/Gildado\/PayD\/actions\/workflows\/build\.yml\)/,
  );
  assert.match(
    readmeHeader,
    /\[!\[License: MIT\]\(https:\/\/img\.shields\.io\/badge\/License-MIT-blue\.svg\?style=flat-square\)\]\(LICENSE\)/,
  );
  assert.match(
    readmeHeader,
    /\[!\[Stellar Compatible\]\(https:\/\/img\.shields\.io\/badge\/Stellar-Compatible-08B5E5\?style=flat-square&logo=stellar\)\]\(https:\/\/www\.stellar\.org\/\)/,
  );
});
