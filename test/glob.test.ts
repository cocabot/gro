import assert from "node:assert/strict";
import { test } from "node:test";
import { isDenied, matchGlob } from "../dist/glob.js";

test("matchGlob treats ** as zero or more directories", () => {
  assert.equal(matchGlob(".env", "**/.env"), true);
  assert.equal(matchGlob("config/.env", "**/.env"), true);
  assert.equal(matchGlob("a/b/.env.local", "**/.env.*"), true);
  assert.equal(matchGlob("README.md", "**/.env"), false);
  assert.equal(matchGlob("secrets.pem", "**/*.pem"), true);
  assert.equal(matchGlob("certs/prod.pem", "**/*.pem"), true);
});

test("isDenied honors negations", () => {
  const deny = ["**/.env", "**/.env.*", "!**/.env.example"];
  assert.equal(isDenied(".env", deny), true);
  assert.equal(isDenied(".env.local", deny), true);
  assert.equal(isDenied(".env.example", deny), false);
});
