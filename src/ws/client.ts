import WebSocket from "ws";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { HubMessageSchema, type VivariumMessage, type HubMessage } from "./protocol.js";
import type { AgentRunner } from "../agent/runner.js";
import type { Config } from "../config.js";

const MAX_RECONNECT_DELAY_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const TOKEN_FILE = "/workspace/.vivarium/hub-token";

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export class HubConnection {
  private ws: WebSocket | null = null;
  private config: Config;
  private runner: AgentRunner;
  private reconnectDelay = 1000;
  private registered = false;
  private vivariumId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = Date.now();
  private processing = false;
  private messageQueue: Array<{ id: string; text: string }> = [];
  private version: string;

  constructor(config: Config, runner: AgentRunner) {
    this.config = config;
    this.runner = runner;
    this.version = getVersion();
  }

  async connect(): Promise<void> {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }
    this.cleanup();

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.hubUrl);

      ws.on("open", () => {
        console.log("[ws] Connected to hub");
        this.ws = ws;
        this.reconnectDelay = 1000;
        this.lastPongAt = Date.now();
        this.register();
        this.startHeartbeat();
        resolve();
      });

      ws.on("message", (data) => {
        this.handleMessage(data as Buffer);
      });

      ws.on("close", (code, reason) => {
        console.log(`[ws] Disconnected: ${code} ${reason}`);
        if (this.ws !== ws) return;
        this.cleanup();
        this.scheduleReconnect();
      });

      ws.on("error", (err) => {
        console.error("[ws] Error:", err.message);
        if (!this.ws) reject(err);
      });

      ws.on("pong", () => {
        this.lastPongAt = Date.now();
      });
    });
  }

  private register(): void {
    this.send({
      type: "register",
      token: this.config.hubToken,
      name: this.config.vivariumName,
      version: this.version,
    });
  }

  private handleMessage(data: Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      console.warn("[ws] Received invalid JSON");
      return;
    }

    const result = HubMessageSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("[ws] Received invalid message:", result.error.message);
      return;
    }

    const msg = result.data;

    switch (msg.type) {
      case "registered":
        this.vivariumId = msg.vivariumId;
        this.registered = true;
        this.persistToken();
        console.log(`[ws] Registered as ${msg.vivariumId}`);
        break;

      case "message":
        if (this.processing) {
          this.messageQueue.push({ id: msg.id, text: msg.text });
        } else {
          this.processMessage(msg.id, msg.text);
        }
        break;

      case "wake":
        console.log(`[ws] Wake: ${msg.reason}`);
        break;

      case "health_check": {
        const stats = this.runner.getStatus();
        this.send({
          type: "status",
          appRunning: true,
          uptime: process.uptime(),
          totalCostUsd: stats.totalCostUsd,
          inputTokens: stats.lastInputTokens,
        });
        break;
      }

      case "shutdown": {
        console.log("[ws] Shutdown requested by hub");
        this.ws?.close(1000, "shutdown");
        try { execSync("/sbin/poweroff -f", { stdio: "ignore", timeout: 5000 }); } catch {}
        process.exit(0);
      }
    }
  }

  private async processMessage(msgId: string, text: string): Promise<void> {
    this.processing = true;

    // Handle /new command locally
    if (text === "/new" || text === "/clear") {
      this.runner.clearSession();
      this.send({ type: "event", msgId, event: "text", content: "🧹 My memory has been wiped. We are starting fresh!" });
      this.send({ type: "event", msgId, event: "done" });
      this.processing = false;
      this.drainQueue();
      return;
    }

    const typingInterval = setInterval(() => {
      this.send({ type: "event", msgId, event: "typing" });
    }, 4000);

    // Send initial typing
    this.send({ type: "event", msgId, event: "typing" });

    try {
      await this.runner.run(text, 0, (event) => {
        if (event.type === "text") {
          this.send({ type: "event", msgId, event: "text", content: event.text });
        } else if (event.type === "screenshot") {
          this.send({
            type: "event",
            msgId,
            event: "screenshot",
            image: event.buffer.toString("base64"),
          });
        }
      });

      clearInterval(typingInterval);
      const status = this.runner.getStatus();
      this.send({ type: "event", msgId, event: "done", cost: status.totalCostUsd, inputTokens: status.lastInputTokens });
    } catch (err) {
      clearInterval(typingInterval);
      this.send({ type: "event", msgId, event: "error", message: String(err) });
    }

    this.processing = false;
    this.drainQueue();
  }

  private drainQueue(): void {
    const next = this.messageQueue.shift();
    if (next) {
      this.processMessage(next.id, next.text);
    }
  }

  private persistToken(): void {
    try {
      mkdirSync(dirname(TOKEN_FILE), { recursive: true });
      writeFileSync(TOKEN_FILE, this.config.hubToken);
    } catch {
      console.warn("[ws] Failed to persist hub token");
    }
  }

  private send(msg: VivariumMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        console.warn("[ws] Heartbeat timeout, reconnecting...");
        this.ws.terminate();
        return;
      }

      this.ws.ping();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private cleanup(): void {
    this.registered = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    console.log(`[ws] Reconnecting in ${this.reconnectDelay}ms...`);
    setTimeout(() => {
      this.connect().catch(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }
}
