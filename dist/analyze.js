import { readFileSync } from "node:fs";
import path from "node:path";
import { baselineFindings, loadBaseline } from "./baseline.js";
import { loadConfig } from "./config.js";
import { listTrackedFiles } from "./git.js";
import { isDenied, matchGlob, normalizePosix } from "./glob.js";
import { packPackage } from "./pack.js";
import { matchSecretContent, matchSecretFilename } from "./secrets.js";
export async function analyze(options = {}) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const config = loadConfig(cwd, options.configPath, {
        ...options.config,
        ...(options.scanContents === undefined ? {} : { scanContents: options.scanContents }),
        ...(options.git === undefined ? {} : { git: options.git }),
        ...(options.oracle === undefined ? {} : { oracle: options.oracle }),
        ...(options.baseline === undefined ? {} : { baseline: options.baseline }),
    });
    const packed = packPackage(cwd, config.oracle);
    const findings = [];
    const packedPaths = new Set(packed.files.map((file) => normalizePosix(file.path)));
    findings.push(...dangerousFilesField(cwd, packed.files));
    if (config.git) {
        const tracked = listTrackedFiles(cwd);
        if (tracked) {
            const trackedSet = new Set(tracked.map(normalizePosix));
            for (const file of packed.files) {
                const relative = normalizePosix(file.path);
                if (trackedSet.has(relative)) {
                    continue;
                }
                if (isPythonMetadataPath(relative)) {
                    continue;
                }
                if (config.allowUntracked.some((glob) => matchGlob(relative, glob))) {
                    continue;
                }
                findings.push({
                    id: `packed-untracked:${relative}`,
                    kind: "packed-untracked",
                    severity: "high",
                    path: relative,
                    message: `Packed file '${relative}' is not tracked by git. ${packed.oracle} pack can include files git never saw, so untracked files can be published.`,
                });
            }
        }
    }
    for (const file of packed.files) {
        const relative = normalizePosix(file.path);
        if (isDenied(relative, config.deny)) {
            findings.push({
                id: `deny-glob:${relative}`,
                kind: "deny-glob",
                severity: "high",
                path: relative,
                message: `Packed file '${relative}' matches the deny list. Remove it from the tarball via package.json "files" or .npmignore.`,
            });
        }
        const filenameHit = matchSecretFilename(relative);
        if (filenameHit) {
            findings.push({
                id: `secret-filename:${relative}`,
                kind: "secret-filename",
                severity: "critical",
                path: relative,
                evidence: filenameHit.evidence,
                message: `Packed file '${relative}' looks like a secret or credential file (${filenameHit.rule}).`,
            });
        }
        if (config.scanContents) {
            const content = packed.contents.get(relative);
            if (content) {
                const contentHit = matchSecretContent(relative, content);
                if (contentHit) {
                    findings.push({
                        id: `secret-content:${relative}:${contentHit.rule}`,
                        kind: "secret-content",
                        severity: "critical",
                        path: relative,
                        evidence: contentHit.evidence,
                        message: `Packed file '${relative}' contains a high-confidence secret pattern (${contentHit.rule}).`,
                    });
                }
            }
        }
    }
    for (const required of config.require) {
        const found = packed.files.some((file) => normalizePosix(file.path) === normalizePosix(required) || matchGlob(file.path, required));
        if (!found) {
            findings.push({
                id: `missing-required:${required}`,
                kind: "missing-required",
                severity: "high",
                path: required,
                message: `Required file '${required}' is not in the ${packed.oracle} pack tarball.`,
            });
        }
    }
    for (const packagePath of collectDeclaredPackagePaths(cwd)) {
        if (packagePath.endsWith("/")) {
            const prefix = packagePath.replace(/\/$/, "");
            const found = [...packedPaths].some((item) => item === prefix || item.startsWith(`${prefix}/`));
            if (!found) {
                findings.push(missingPackagePath(packagePath, packed.oracle));
            }
            continue;
        }
        if (!packedPaths.has(packagePath)) {
            findings.push(missingPackagePath(packagePath, packed.oracle));
        }
    }
    if (config.maxUnpackedBytes !== null && packed.unpackedSize > config.maxUnpackedBytes) {
        findings.push({
            id: "unpacked-size",
            kind: "unpacked-size",
            severity: "medium",
            message: `Unpacked tarball is ${packed.unpackedSize} bytes, which exceeds the configured budget of ${config.maxUnpackedBytes} bytes.`,
        });
    }
    const baseline = await loadBaseline(cwd, config.baseline, packed.oracle);
    if (baseline) {
        findings.push(...baselineFindings(packed.files, baseline));
    }
    return {
        packageName: packed.packageName,
        version: packed.version,
        cwd,
        oracle: packed.oracle,
        packedSize: packed.packedSize,
        unpackedSize: packed.unpackedSize,
        packedFiles: packed.files,
        baseline: baseline
            ? { spec: baseline.spec, resolved: baseline.resolved, packedFileCount: baseline.packedFileCount }
            : null,
        findings: dedupe(findings),
        counts: countBySeverity(findings),
    };
}
function missingPackagePath(packagePath, oracle) {
    return {
        id: `missing-package-path:${packagePath}`,
        kind: "missing-package-path",
        severity: "critical",
        path: packagePath,
        message: `package.json declares '${packagePath}' but ${oracle} pack does not include that path. Publishing would ship a broken package.`,
    };
}
function dangerousFilesField(cwd, packedFiles) {
    try {
        const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
        if (!Array.isArray(pkg.files)) {
            return [];
        }
        const patterns = pkg.files.filter((item) => typeof item === "string");
        const overlyBroad = patterns.filter((item) => item === "*" || item === "**" || item === "**/*" || item === ".**");
        if (overlyBroad.length === 0) {
            return [];
        }
        const packedSecrets = packedFiles.filter((file) => matchSecretFilename(file.path));
        return [
            {
                id: "dangerous-files-field",
                kind: "dangerous-files-field",
                severity: packedSecrets.length > 0 ? "high" : "medium",
                evidence: `files: ${JSON.stringify(patterns)}`,
                message: `package.json "files" contains overly broad pattern(s) ${overlyBroad.join(", ")}. ` +
                    `That pattern can pack gitignored files such as .env. Prefer an explicit allow list (for example ["dist", "LICENSE", "README.md"]).`,
            },
        ];
    }
    catch {
        return [];
    }
}
function collectDeclaredPackagePaths(cwd) {
    try {
        const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
        const collected = new Set();
        const add = (value) => {
            if (typeof value === "string") {
                if (!value || value.startsWith("http://") || value.startsWith("https://") || value.includes(":")) {
                    return;
                }
                collected.add(normalizePosix(value.replace(/^\.\//, "")));
                return;
            }
            if (Array.isArray(value)) {
                for (const item of value) {
                    add(item);
                }
                return;
            }
            if (value && typeof value === "object") {
                for (const item of Object.values(value)) {
                    add(item);
                }
            }
        };
        add(pkg["main"]);
        add(pkg["module"]);
        add(pkg["types"]);
        add(pkg["typings"]);
        add(pkg["bin"]);
        add(pkg["exports"]);
        return [...collected].filter((item) => item !== "package.json" && !item.startsWith("#"));
    }
    catch {
        return [];
    }
}
function isPythonMetadataPath(relative) {
    return (/(^|\/)[^/]+\.dist-info(\/|$)/.test(relative) ||
        /(^|\/)[^/]+\.egg-info(\/|$)/.test(relative) ||
        relative === "PKG-INFO" ||
        relative === "setup.cfg");
}
function countBySeverity(findings) {
    const counts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
    };
    for (const finding of findings) {
        counts[finding.severity] += 1;
    }
    return counts;
}
function dedupe(findings) {
    const seen = new Set();
    const result = [];
    for (const finding of findings) {
        if (seen.has(finding.id)) {
            continue;
        }
        seen.add(finding.id);
        result.push(finding);
    }
    return result;
}
