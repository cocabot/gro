import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readTarGz, stripPackagePrefix } from "./tar.js";
export function npmPack(cwd) {
    const temp = mkdtempSync(path.join(tmpdir(), "packgate-"));
    try {
        const stdout = execFileSync("npm", ["pack", "--json", "--pack-destination", temp], {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_AUDIT: "false" },
        });
        const parsed = parseNpmJson(stdout);
        const packedPath = path.join(temp, parsed.filename ?? "");
        const archive = readFileSync(packedPath);
        const entries = readTarGz(archive);
        const contents = new Map();
        for (const entry of entries) {
            const relative = stripPackagePrefix(entry.name);
            if (relative) {
                contents.set(relative, entry.content);
            }
        }
        return {
            packageName: parsed.name ?? "package",
            version: parsed.version ?? "0.0.0",
            filename: parsed.filename ?? path.basename(packedPath),
            packedSize: parsed.size ?? archive.length,
            unpackedSize: parsed.unpackedSize ?? [...contents.values()].reduce((sum, buf) => sum + buf.length, 0),
            files: (parsed.files ?? []).map((file) => ({
                path: file.path.replaceAll("\\", "/").replace(/^\.\//, ""),
                size: file.size,
                ...(file.mode === undefined ? {} : { mode: file.mode }),
            })),
            contents,
        };
    }
    finally {
        rmSync(temp, { recursive: true, force: true });
    }
}
function parseNpmJson(stdout) {
    const start = stdout.indexOf("[");
    const jsonText = start === -1 ? stdout : stdout.slice(start);
    const payload = JSON.parse(jsonText);
    if (Array.isArray(payload) && payload[0] && typeof payload[0] === "object") {
        return payload[0];
    }
    if (payload && typeof payload === "object") {
        return payload;
    }
    throw new Error("npm pack --json returned an unexpected payload");
}
