import assert from "node:assert/strict";
import { matchSecretContent, matchSecretFilename } from "../dist/secrets.js";
import { test } from "node:test";

test("secret filenames catch .env and private keys but not .env.example", () => {
  assert.equal(matchSecretFilename(".env")?.rule, "env-file");
  assert.equal(matchSecretFilename("deploy/.env.local")?.rule, "env-file");
  assert.equal(matchSecretFilename(".env.example"), null);
  assert.equal(matchSecretFilename("id_rsa")?.rule, "private-key-file");
  assert.equal(matchSecretFilename("id_rsa.pub"), null);
});

test("content scanner matches private keys and access tokens without echoing them", () => {
  const hit = matchSecretContent(
    "dist/oops.js",
    Buffer.from("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----\n"),
  );
  assert.equal(hit?.rule, "pkcs-private-key");
  const token = matchSecretContent("dist/oops.js", Buffer.from("token=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n"));
  assert.equal(token?.rule, "github-pat");
  assert.equal(token?.evidence.includes("ghp_abcdefghijklmnopqrstuvwxyz0123456789"), false);
});
