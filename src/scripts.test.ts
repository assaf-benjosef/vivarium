import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPTS_DIR = join(import.meta.dirname, "..", "skills", "managing-snapshots", "scripts");

describe("Snapshot scripts (integration)", () => {
  let workDir: string;

  beforeEach(() => {
    // Create a temp directory with a git repo
    workDir = mkdtempSync(join(tmpdir(), "terrarium-test-"));
    execSync('git init && git config user.name "Test" && git config user.email "test@test"', {
      cwd: workDir,
      stdio: "ignore",
    });
    // Create an initial file and commit
    writeFileSync(join(workDir, "hello.txt"), "hello world");
    execSync('git add -A && git commit -m "initial"', { cwd: workDir, stdio: "ignore" });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  /** Run a script with /workspace overridden to our temp dir */
  function runScript(script: string, args: string = ""): string {
    // The scripts hardcode `cd /workspace`, so we sed-replace it for testing
    const scriptPath = join(SCRIPTS_DIR, script);
    const cmd = `sed 's|cd /workspace|cd ${workDir}|g' '${scriptPath}' | bash -s -- ${args}`;
    return execSync(cmd, { cwd: workDir, encoding: "utf-8" });
  }

  it("snapshot.sh should create a named tag", () => {
    const output = runScript("snapshot.sh", "v1");
    expect(output).toContain("✅");

    // Verify the tag exists
    const tags = execSync("git tag", { cwd: workDir, encoding: "utf-8" });
    expect(tags.trim()).toBe("v1");
  });

  it("snapshot.sh should refuse duplicate names", () => {
    runScript("snapshot.sh", "v1");

    // Second snapshot with same name should fail
    expect(() => runScript("snapshot.sh", "v1")).toThrow();
  });

  it("snapshot.sh should auto-commit uncommitted changes", () => {
    // Create a new file without committing
    writeFileSync(join(workDir, "new.txt"), "new content");

    runScript("snapshot.sh", "with-uncommitted");

    // The auto-commit should have captured the new file
    const log = execSync('git log --oneline', { cwd: workDir, encoding: "utf-8" });
    expect(log).toContain("auto: before snapshot");
  });

  it("list-snapshots.sh should list created snapshots", () => {
    runScript("snapshot.sh", "alpha");
    runScript("snapshot.sh", "beta");

    const output = runScript("list-snapshots.sh");
    expect(output).toContain("alpha");
    expect(output).toContain("beta");
  });

  it("rollback.sh should restore files to snapshot state", () => {
    runScript("snapshot.sh", "before-change");

    // Modify the file after the snapshot
    writeFileSync(join(workDir, "hello.txt"), "CHANGED");
    execSync('git add -A && git commit -m "changed"', { cwd: workDir, stdio: "ignore" });

    // Rollback
    runScript("rollback.sh", "before-change");

    // File should be restored
    const content = execSync(`cat ${join(workDir, "hello.txt")}`, { encoding: "utf-8" });
    expect(content.trim()).toBe("hello world");
  });

  it("rollback.sh should fail for non-existent snapshot", () => {
    expect(() => runScript("rollback.sh", "nonexistent")).toThrow();
  });
});
