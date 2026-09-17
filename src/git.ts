import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export function listTrackedFiles(cwd: string): string[] | null {
  const gitDir = findGitRoot(cwd);
  if (!gitDir) {
    return null;
  }
  try {
    const stdout = execFileSync("git", ["ls-files", "-z", "--", "."], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return stdout
      .split("\0")
      .map((item) => item.replaceAll("\\", "/"))
      .filter(Boolean);
  } catch {
    return null;
  }
}

function findGitRoot(cwd: string): string | null {
  let current = path.resolve(cwd);
  while (true) {
    if (existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
