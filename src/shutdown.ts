import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const IN_MICROVM = existsSync("/workspace");

export function shutdownVM(): never {
  if (IN_MICROVM) {
    console.log("[vivarium] Powering off microVM");
    spawn("poweroff", { detached: true, stdio: "ignore" }).unref();
  }
  process.exit(0);
}
