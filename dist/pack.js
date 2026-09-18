import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readTarGz, stripPackagePrefix } from "./tar.js";
export function resolveOracle(cwd, requested = "auto") {
    if (requested === "npm" || requested === "pnpm" || requested === "yarn" || requested === "python") {
        return requested;
    }
    if (existsSync(path.join(cwd, "package.json"))) {
        const fromField = packageManagerField(cwd);
        if (fromField) {
            return fromField;
        }
        if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
            return "pnpm";
        }
        if (existsSync(path.join(cwd, "yarn.lock"))) {
            return "yarn";
        }
        return "npm";
    }
    if (existsSync(path.join(cwd, "pyproject.toml")) || existsSync(path.join(cwd, "setup.py"))) {
        return "python";
    }
    return "npm";
}
export function packPackage(cwd, requested = "auto") {
    const oracle = resolveOracle(cwd, requested);
    const temp = mkdtempSync(path.join(tmpdir(), "packgate-"));
    try {
        const archives = createArchives(cwd, oracle, temp);
        const contents = new Map();
        const files = [];
        for (const archivePath of archives) {
            for (const entry of readArchive(archivePath)) {
                if (contents.has(entry.path)) {
                    continue;
                }
                contents.set(entry.path, entry.content);
                files.push({ path: entry.path, size: entry.size });
            }
        }
        const identity = readPackedIdentity(cwd, oracle, contents);
        const primary = archives[0];
        return {
            oracle,
            packageName: identity.name ?? "package",
            version: identity.version ?? "0.0.0",
            filename: primary ? path.basename(primary) : "package",
            packedSize: archives.reduce((sum, file) => sum + readFileSync(file).length, 0),
            unpackedSize: files.reduce((sum, file) => sum + file.size, 0),
            files,
            contents,
        };
    }
    finally {
        rmSync(temp, { recursive: true, force: true });
    }
}
/** @deprecated Use packPackage. Kept as the npm-named alias. */
export const npmPack = packPackage;
function createArchives(cwd, oracle, temp) {
    switch (oracle) {
        case "python":
            run(cwd, "python3", ["-m", "build", "--outdir", temp]);
            return pythonArtifacts(temp);
        case "pnpm":
            run(cwd, "pnpm", ["pack", "--pack-destination", temp]);
            return [onlyTarball(temp, "pnpm pack")];
        case "yarn": {
            const dest = path.join(temp, "package.tgz");
            run(cwd, "yarn", yarnPackArgs(dest));
            if (existsSync(dest)) {
                return [dest];
            }
            return [onlyTarball(temp, "yarn pack")];
        }
        default:
            run(cwd, "npm", ["pack", "--pack-destination", temp], {
                NPM_CONFIG_FUND: "false",
                NPM_CONFIG_AUDIT: "false",
            });
            return [onlyTarball(temp, "npm pack")];
    }
}
function pythonArtifacts(dir) {
    const wheels = readdirSync(dir).filter((name) => name.endsWith(".whl"));
    const sdists = readdirSync(dir).filter((name) => name.endsWith(".tar.gz"));
    const paths = [...wheels, ...sdists].map((name) => path.join(dir, name));
    if (paths.length === 0) {
        throw new Error(`python -m build produced no wheel or sdist in ${dir}`);
    }
    return paths;
}
function readArchive(archivePath) {
    if (archivePath.endsWith(".whl") || archivePath.endsWith(".zip")) {
        return readZipMembers(archivePath);
    }
    const archive = readFileSync(archivePath);
    const prefix = sdistPrefix(path.basename(archivePath));
    const entries = [];
    for (const entry of readTarGz(archive)) {
        let relative = stripPackagePrefix(entry.name);
        if (prefix && relative === prefix) {
            continue;
        }
        if (prefix && relative.startsWith(`${prefix}/`)) {
            relative = relative.slice(prefix.length + 1);
        }
        if (!relative) {
            continue;
        }
        entries.push({ path: relative, size: entry.size, content: entry.content });
    }
    return entries;
}
function sdistPrefix(filename) {
    const match = filename.match(/^(.*)\.tar\.gz$/);
    return match?.[1] ?? null;
}
function readZipMembers(archivePath) {
    const script = [
        "import json, sys, zipfile, base64",
        "archive = zipfile.ZipFile(sys.argv[1])",
        "items = []",
        "for info in archive.infolist():",
        "    name = info.filename.replace('\\\\', '/')",
        "    if name.endswith('/') or info.is_dir():",
        "        continue",
        "    data = archive.read(info.filename)",
        "    items.append({'path': name, 'size': info.file_size, 'b64': base64.b64encode(data).decode('ascii')})",
        "print(json.dumps(items))",
    ].join("\n");
    const raw = execFileSync("python3", ["-c", script, archivePath], {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const items = JSON.parse(raw);
    return items.map((item) => ({
        path: item.path,
        size: item.size,
        content: Buffer.from(item.b64, "base64"),
    }));
}
function yarnPackArgs(dest) {
    return yarnClassic() ? ["pack", "--filename", dest] : ["pack", "--out", dest];
}
function yarnClassic() {
    try {
        const version = execFileSync("yarn", ["--version"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }).trim();
        return version.startsWith("0.") || version.startsWith("1.");
    }
    catch {
        return true;
    }
}
function run(cwd, command, args, extraEnv = {}) {
    try {
        return execFileSync(command, args, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0", ...extraEnv },
        });
    }
    catch (error) {
        const err = error;
        const detail = (err.stderr ?? err.message ?? String(error)).trim();
        throw new Error(`${command} ${args.join(" ")} failed. Install ${command} or pass --oracle npm.\n${detail}`);
    }
}
function onlyTarball(dir, label) {
    const matches = readdirSync(dir).filter((name) => name.endsWith(".tgz") || name.endsWith(".tar.gz"));
    if (matches.length !== 1 || !matches[0]) {
        throw new Error(`${label} produced ${matches.length} tarball(s) in ${dir}: ${matches.join(", ") || "(none)"}`);
    }
    return path.join(dir, matches[0]);
}
function packageManagerField(cwd) {
    try {
        const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
        if (typeof pkg.packageManager !== "string") {
            return null;
        }
        if (pkg.packageManager.startsWith("pnpm")) {
            return "pnpm";
        }
        if (pkg.packageManager.startsWith("yarn")) {
            return "yarn";
        }
        if (pkg.packageManager.startsWith("npm")) {
            return "npm";
        }
        return null;
    }
    catch {
        return null;
    }
}
function readPackedIdentity(cwd, oracle, contents) {
    if (oracle === "python") {
        for (const [relative, body] of contents) {
            if (relative.endsWith(".dist-info/METADATA") || relative === "PKG-INFO") {
                return parsePkgInfo(body.toString("utf8"));
            }
        }
        return parsePyproject(cwd);
    }
    return readPackedPackageJson(cwd, contents);
}
function parsePkgInfo(text) {
    const name = text.match(/^Name:\s*(.+)$/m)?.[1]?.trim();
    const version = text.match(/^Version:\s*(.+)$/m)?.[1]?.trim();
    return { ...(name ? { name } : {}), ...(version ? { version } : {}) };
}
function parsePyproject(cwd) {
    try {
        const text = readFileSync(path.join(cwd, "pyproject.toml"), "utf8");
        const name = text.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
        const version = text.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
        return { ...(name ? { name } : {}), ...(version ? { version } : {}) };
    }
    catch {
        return {};
    }
}
function readPackedPackageJson(cwd, contents) {
    const packed = contents.get("package.json");
    if (packed) {
        return JSON.parse(packed.toString("utf8"));
    }
    return JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
}
