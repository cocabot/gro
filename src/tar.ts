import { gunzipSync } from "node:zlib";

export interface TarEntry {
  name: string;
  size: number;
  content: Buffer;
}

/**
 * Read files from an npm pack tarball (gzipped ustar, usually with a `package/` prefix).
 * Handles GNU long names and a subset of PAX `path=` headers used by npm.
 */
export function readTarGz(archive: Buffer): TarEntry[] {
  const data = gunzipSync(archive);
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingName: string | null = null;

  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (isZeroBlock(header)) {
      break;
    }

    const typeflag = String.fromCharCode(header[156] ?? 0);
    const size = parseOctal(header.subarray(124, 136));
    let name = readCString(header.subarray(0, 100));
    const prefix = readCString(header.subarray(345, 500));
    if (prefix) {
      name = `${prefix}/${name}`;
    }
    if (pendingName) {
      name = pendingName;
      pendingName = null;
    }

    offset += 512;
    const content = Buffer.from(data.subarray(offset, offset + size));
    offset += Math.ceil(size / 512) * 512;

    if (typeflag === "L") {
      pendingName = content.toString("utf8").replace(/\0.*$/u, "");
      continue;
    }
    if (typeflag === "x" || typeflag === "g") {
      const pathMatch = content.toString("utf8").match(/(?:^|\n)path=([^\n]+)/u);
      if (pathMatch?.[1]) {
        pendingName = pathMatch[1];
      }
      continue;
    }
    if (typeflag === "0" || typeflag === "" || typeflag === "\0") {
      entries.push({ name, size, content });
    }
  }

  return entries;
}

export function stripPackagePrefix(name: string): string {
  const posix = name.replaceAll("\\", "/");
  if (posix === "package") {
    return "";
  }
  if (posix.startsWith("package/")) {
    return posix.slice("package/".length);
  }
  return posix;
}

function readCString(buf: Buffer): string {
  const nul = buf.indexOf(0);
  return buf.subarray(0, nul === -1 ? buf.length : nul).toString("utf8");
}

function parseOctal(buf: Buffer): number {
  const text = readCString(buf).trim();
  if (!text) {
    return 0;
  }
  return Number.parseInt(text, 8);
}

function isZeroBlock(buf: Buffer): boolean {
  for (const byte of buf) {
    if (byte !== 0) {
      return false;
    }
  }
  return true;
}
