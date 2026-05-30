import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadConfig } from "./config.js";
import { HubConnection } from "./ws/client.js";
import { AgentRunner } from "./agent/runner.js";

const WORKSPACE = "/workspace";
const AUTO_SAVE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const IS_CONTAINER = existsSync(WORKSPACE);

function setupContainer(): void {
  try {
    execSync('git config --global user.name "Viv" && git config --global user.email "viv@vivarium.local"', {
      stdio: "ignore",
    });
  } catch {
    // Home dir may not be writable (e.g. SmolVM uid mismatch) — git -c flags below handle this
  }

  if (!existsSync(`${WORKSPACE}/.git`)) {
    execSync(`git init && git add -A && git -c user.name=Viv -c user.email=viv@vivarium.local commit -m "Initial commit" --allow-empty`, {
      cwd: WORKSPACE,
      stdio: "ignore",
    });
    console.log("[vivarium] Initialized git in /workspace");
  }

  if (!existsSync(`${WORKSPACE}/.claude/skills`)) {
    execSync(`mkdir -p ${WORKSPACE}/.claude/skills && cp -r /app/skills/* ${WORKSPACE}/.claude/skills/`, {
      stdio: "ignore",
    });
    console.log("[vivarium] Skills installed to /workspace/.claude/skills/");
  }

  if (!existsSync(`${WORKSPACE}/CLAUDE.md`)) {
    execSync(`cp /app/workspace-template/CLAUDE.md ${WORKSPACE}/CLAUDE.md`, {
      stdio: "ignore",
    });
    console.log("[vivarium] CLAUDE.md installed to /workspace/");
  }

  const startScript = `${WORKSPACE}/.vivarium/start.sh`;
  if (existsSync(startScript)) {
    try {
      execSync(`bash ${startScript}`, { cwd: WORKSPACE, stdio: "ignore" });
      console.log("[vivarium] Ran start.sh");
    } catch {
      console.warn("[vivarium] start.sh failed (non-fatal)");
    }
  }

  setInterval(() => {
    try {
      execSync(
        'git add -A && git diff-index --quiet HEAD || git commit -m "auto-save"',
        { cwd: WORKSPACE, stdio: "ignore" }
      );
    } catch {}
  }, AUTO_SAVE_INTERVAL_MS);
  console.log("[vivarium] Auto-save enabled (every 15 min)");
}

async function main() {
  const config = loadConfig();

  if (IS_CONTAINER) {
    setupContainer();
  } else {
    console.log("[vivarium] Running outside container, skipping workspace setup");
  }

  const runner = new AgentRunner(config);
  const hub = new HubConnection(config, runner);
  await hub.connect();

  console.log("[vivarium] Viv is ready 🌱");
}

main().catch((err) => {
  console.error("[vivarium] Fatal error:", err);
  process.exit(1);
});
