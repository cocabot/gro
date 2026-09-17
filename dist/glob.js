/**
 * Small glob matcher for POSIX paths.
 * A double-star segment matches zero or more directories, including none.
 */
export function matchGlob(filePath, glob) {
    const path = normalizePosix(filePath);
    const pattern = normalizePosix(glob);
    return globToRegExp(pattern).test(path);
}
export function isDenied(filePath, deny) {
    const positives = [];
    const negatives = [];
    for (const rule of deny) {
        if (rule.startsWith("!")) {
            negatives.push(rule.slice(1));
        }
        else {
            positives.push(rule);
        }
    }
    if (!positives.some((glob) => matchGlob(filePath, glob))) {
        return false;
    }
    return !negatives.some((glob) => matchGlob(filePath, glob));
}
export function normalizePosix(value) {
    return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
}
function globToRegExp(glob) {
    let i = 0;
    let out = "^";
    while (i < glob.length) {
        if (glob.startsWith("**/", i)) {
            out += "(?:.*/)?";
            i += 3;
            continue;
        }
        if (glob.startsWith("**", i) && (i + 2 === glob.length || glob[i + 2] === "/")) {
            out += ".*";
            i += 2;
            continue;
        }
        const ch = glob[i];
        if (ch === "*") {
            out += "[^/]*";
            i += 1;
            continue;
        }
        if (ch === "?") {
            out += "[^/]";
            i += 1;
            continue;
        }
        if ("\\^$+{}()|[]".includes(ch)) {
            out += `\\${ch}`;
        }
        else {
            out += ch;
        }
        i += 1;
    }
    out += "$";
    return new RegExp(out);
}
