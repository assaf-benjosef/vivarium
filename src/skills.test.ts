import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");

describe("Skills directory structure", () => {
  const expectedSkills = [
    "writing-notes",
    "building-quality-apps",
    "serving-apps",
    "managing-snapshots",
    "taking-screenshots",
    "managing-databases",
    "environment-info",
  ];

  it("should have all expected skill directories", () => {
    for (const skill of expectedSkills) {
      expect(existsSync(join(SKILLS_DIR, skill)), `Missing skill: ${skill}`).toBe(true);
    }
  });

  it("should have a SKILL.md in each skill directory", () => {
    for (const skill of expectedSkills) {
      const skillFile = join(SKILLS_DIR, skill, "SKILL.md");
      expect(existsSync(skillFile), `Missing SKILL.md in ${skill}`).toBe(true);
    }
  });

  it("should have YAML frontmatter with name and description in each SKILL.md", () => {
    for (const skill of expectedSkills) {
      const content = readFileSync(join(SKILLS_DIR, skill, "SKILL.md"), "utf-8");

      // Check for YAML frontmatter markers
      expect(content.startsWith("---"), `${skill}/SKILL.md missing opening ---`).toBe(true);
      const secondDash = content.indexOf("---", 3);
      expect(secondDash > 0, `${skill}/SKILL.md missing closing ---`).toBe(true);

      // Check for required fields
      const frontmatter = content.slice(3, secondDash);
      expect(frontmatter).toContain("name:");
      expect(frontmatter).toContain("description:");
    }
  });

  it("should have the skill name match the directory name", () => {
    for (const skill of expectedSkills) {
      const content = readFileSync(join(SKILLS_DIR, skill, "SKILL.md"), "utf-8");
      const frontmatter = content.slice(3, content.indexOf("---", 3));

      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      expect(nameMatch, `${skill}/SKILL.md missing name field`).toBeTruthy();
      expect(nameMatch![1].trim()).toBe(skill);
    }
  });
});

describe("CLAUDE.md", () => {
  const claudeMdPath = join(ROOT, "workspace-template", "CLAUDE.md");

  it("should exist in workspace-template/", () => {
    expect(existsSync(claudeMdPath)).toBe(true);
  });

  it("should mention Viv", () => {
    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("Viv");
  });

  it("should have non-technical communication rules", () => {
    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("Never use jargon");
  });

  it("should mention auto-save", () => {
    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("15 minutes");
  });

  it("should have onboarding for empty workspace", () => {
    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("workspace is empty");
  });
});

describe("Snapshot scripts", () => {
  const scriptsDir = join(SKILLS_DIR, "managing-snapshots", "scripts");

  it("should have all three scripts", () => {
    expect(existsSync(join(scriptsDir, "snapshot.sh"))).toBe(true);
    expect(existsSync(join(scriptsDir, "rollback.sh"))).toBe(true);
    expect(existsSync(join(scriptsDir, "list-snapshots.sh"))).toBe(true);
  });

  it("should have executable permissions", () => {
    const scripts = ["snapshot.sh", "rollback.sh", "list-snapshots.sh"];
    for (const script of scripts) {
      const mode = statSync(join(scriptsDir, script)).mode;
      expect(mode & 0o111, `${script} should be executable`).toBeGreaterThan(0);
    }
  });

  it("snapshot.sh should require a name argument", () => {
    const content = readFileSync(join(scriptsDir, "snapshot.sh"), "utf-8");
    expect(content).toContain("Usage:");
  });

  it("rollback.sh should require a name argument", () => {
    const content = readFileSync(join(scriptsDir, "rollback.sh"), "utf-8");
    expect(content).toContain("Usage:");
  });

  it("rollback.sh should save current state before rolling back", () => {
    const content = readFileSync(join(scriptsDir, "rollback.sh"), "utf-8");
    // Should commit before rollback to avoid losing work
    expect(content).toContain("git add -A");
    expect(content).toContain("git commit");
  });
});
