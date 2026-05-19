import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig } from "./config.js";
import { TelegramChat } from "./chat/telegram.js";
import { AgentRunner } from "./agent/runner.js";

const WORKSPACE = "/workspace";
const AUTO_SAVE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function main() {
  const config = loadConfig();

  // Configure git identity for the container
  try {
    execSync('git config --global user.name "Terry" && git config --global user.email "terry@terrarium.local"', {
      stdio: "ignore",
    });
  } catch {
    // May already be configured
  }

  // Initialize git in workspace if needed
  if (!existsSync(`${WORKSPACE}/.git`)) {
    execSync(`git init && git add -A && git commit -m "Initial commit" --allow-empty`, {
      cwd: WORKSPACE,
      stdio: "ignore",
    });
    console.log("[terrarium] Initialized git in /workspace");
  }

  // Copy skills into workspace if not present
  if (!existsSync(`${WORKSPACE}/.claude/skills`)) {
    execSync(`mkdir -p ${WORKSPACE}/.claude/skills && cp -r /app/skills/* ${WORKSPACE}/.claude/skills/`, {
      stdio: "ignore",
    });
    console.log("[terrarium] Skills installed to /workspace/.claude/skills/");
  }

  // Copy CLAUDE.md to workspace root if not present (SDK loads it from here)
  if (!existsSync(`${WORKSPACE}/CLAUDE.md`)) {
    execSync(`cp /app/workspace-template/CLAUDE.md ${WORKSPACE}/CLAUDE.md`, {
      stdio: "ignore",
    });
    console.log("[terrarium] CLAUDE.md installed to /workspace/");
  }

  // Run auto-start script if it exists
  const startScript = `${WORKSPACE}/.terrarium/start.sh`;
  if (existsSync(startScript)) {
    try {
      execSync(`bash ${startScript}`, { cwd: WORKSPACE, stdio: "ignore" });
      console.log("[terrarium] Ran start.sh");
    } catch {
      console.warn("[terrarium] start.sh failed (non-fatal)");
    }
  }

  // Periodic auto-save (every 15 minutes)
  setInterval(() => {
    try {
      execSync(
        'git add -A && git diff-index --quiet HEAD || git commit -m "auto-save"',
        { cwd: WORKSPACE, stdio: "ignore" }
      );
    } catch {
      // Ignore — workspace might not have changes
    }
  }, AUTO_SAVE_INTERVAL_MS);
  console.log("[terrarium] Auto-save enabled (every 15 min)");

  // Start the agent runner and chat
  const runner = new AgentRunner(config);
  const chat = new TelegramChat(config, runner);
  await chat.start();

  console.log("[terrarium] Terry is ready 🌱");
}

main().catch((err) => {
  console.error("[terrarium] Fatal error:", err);
  process.exit(1);
});
