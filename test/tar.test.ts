import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { readTarGz, stripPackagePrefix } from "../dist/tar.js";

function ustarHeader(name: string, size: number, typeflag = "0"): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0);
  header.write(size.toString(8).padStart(11, "0"), 124, 11, "utf8");
  header[155] = 0x20;
  header.write(typeflag, 156, 1, "utf8");
  header.write("ustar\0", 257);
  header.write("00", 263);
  let checksum = 0;
  header.fill(0x20, 148, 156);
  for (const byte of header) {
    checksum += byte;
  }
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  return header;
}

test("readTarGz lists files and stripPackagePrefix removes npm's package/ prefix", () => {
  const body = Buffer.from("hello packgate\n", "utf8");
  const pad = (512 - (body.length % 512)) % 512;
  const archive = Buffer.concat([
    ustarHeader("package/README.md", body.length),
    body,
    Buffer.alloc(pad),
    Buffer.alloc(1024),
  ]);
  const entries = readTarGz(gzipSync(archive));
  assert.equal(entries.length, 1);
  assert.equal(stripPackagePrefix(entries[0]!.name), "README.md");
  assert.equal(entries[0]!.content.toString("utf8"), "hello packgate\n");
});
