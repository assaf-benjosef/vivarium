import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { HubConnection } from "./client.js";
import type { Config } from "../config.js";
import type { AgentRunner, AgentEvent } from "../agent/runner.js";

function createMockRunner(): AgentRunner {
  return {
    clearSession: () => {},
    getStatus: () => ({ sessionId: "test", totalCostUsd: 0.05 }),
    run: async (_msg: string, _chatId: number, onEvent?: (e: AgentEvent) => void) => {
      if (onEvent) {
        onEvent({ type: "text", text: "I built your app!" });
      }
      return { text: "I built your app!" };
    },
  } as unknown as AgentRunner;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("HubConnection", () => {
  let httpServer: Server;
  let wss: WebSocketServer;
  let port: number;
  let serverMessages: unknown[];
  let serverConnections: WebSocket[];

  beforeEach(async () => {
    serverMessages = [];
    serverConnections = [];

    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer, path: "/ws" });

    wss.on("connection", (ws) => {
      serverConnections.push(ws);
      ws.on("message", (data) => {
        serverMessages.push(JSON.parse(data.toString()));
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(() => {
    for (const ws of serverConnections) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    wss.close();
    httpServer.close();
  });

  function createConfig(): Config {
    return {
      anthropicApiKey: "sk-ant-test",
      hubUrl: `ws://localhost:${port}/ws`,
      hubToken: "test-token",
      vivariumName: "test-viv",
      maxTurns: 30,
      model: "claude-sonnet-4-5",
    };
  }

  it("should connect and send register message", async () => {
    const hub = new HubConnection(createConfig(), createMockRunner());
    await hub.connect();
    await waitMs(50);

    expect(serverMessages).toHaveLength(1);
    const reg = serverMessages[0] as Record<string, unknown>;
    expect(reg.type).toBe("register");
    expect(reg.name).toBe("test-viv");
    expect(reg.token).toBe("test-token");
  });

  it("should process messages from hub and send events back", async () => {
    const hub = new HubConnection(createConfig(), createMockRunner());
    await hub.connect();
    await waitMs(50);

    // Send registered response
    const ws = serverConnections[0];
    ws.send(JSON.stringify({ type: "registered", vivariumId: "viv_1" }));
    await waitMs(50);

    // Send a user message
    serverMessages.length = 0;
    ws.send(JSON.stringify({ type: "message", id: "msg_1", text: "build me an app" }));
    await waitMs(200);

    // Should have received: typing + text + done events
    const events = serverMessages.filter((m: any) => m.type === "event");
    expect(events.length).toBeGreaterThanOrEqual(2);

    const textEvent = events.find((e: any) => e.event === "text") as Record<string, unknown>;
    expect(textEvent).toBeDefined();
    expect(textEvent.content).toBe("I built your app!");
    expect(textEvent.msgId).toBe("msg_1");

    const doneEvent = events.find((e: any) => e.event === "done") as Record<string, unknown>;
    expect(doneEvent).toBeDefined();
    expect(doneEvent.msgId).toBe("msg_1");
  });

  it("should handle /new command locally", async () => {
    const runner = createMockRunner();
    let cleared = false;
    runner.clearSession = () => {
      cleared = true;
    };

    const hub = new HubConnection(createConfig(), runner);
    await hub.connect();
    await waitMs(50);

    const ws = serverConnections[0];
    ws.send(JSON.stringify({ type: "registered", vivariumId: "viv_1" }));
    await waitMs(50);

    serverMessages.length = 0;
    ws.send(JSON.stringify({ type: "message", id: "msg_1", text: "/new" }));
    await waitMs(100);

    expect(cleared).toBe(true);

    const events = serverMessages.filter((m: any) => m.type === "event");
    const textEvent = events.find((e: any) => e.event === "text") as Record<string, unknown>;
    expect(textEvent).toBeDefined();
    expect((textEvent.content as string)).toContain("wiped");
  });

  it("should respond to health_check", async () => {
    const hub = new HubConnection(createConfig(), createMockRunner());
    await hub.connect();
    await waitMs(50);

    const ws = serverConnections[0];
    ws.send(JSON.stringify({ type: "registered", vivariumId: "viv_1" }));
    await waitMs(50);

    serverMessages.length = 0;
    ws.send(JSON.stringify({ type: "health_check" }));
    await waitMs(100);

    const status = serverMessages.find((m: any) => m.type === "status") as Record<string, unknown>;
    expect(status).toBeDefined();
    expect(status.appRunning).toBe(true);
    expect(typeof status.uptime).toBe("number");
  });
});
