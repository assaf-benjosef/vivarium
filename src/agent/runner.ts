import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { Config } from "../config.js";
import { z } from "zod";
import { takeScreenshot } from "./tools.js";

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const WORKSPACE = "/workspace";
const SESSION_FILE = `${WORKSPACE}/.vivarium/session.json`;

export type AgentEvent = 
  | { type: "text"; text: string }
  | { type: "screenshot"; buffer: Buffer };

export interface AgentResponse {
  text: string;
  screenshot?: Buffer;
  usage?: { input_tokens: number; output_tokens: number };
}

interface SessionState {
  sessionId?: string;
  totalCostUsd: number;
}

// Define the screenshot tool using the SDK's tool() helper
const screenshotTool = tool(
  "screenshot",
  "Take a screenshot of the web app running on port 3000. Returns a base64-encoded PNG image.",
  { url: z.string().optional().describe("URL to screenshot. Defaults to http://localhost:3000") },
  async ({ url }) => {
    try {
      const base64 = await takeScreenshot(url);
      return {
        content: [
          { type: "image" as const, data: base64, mimeType: "image/png" as const },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Screenshot failed: ${String(err)}` }],
        isError: true,
      };
    }
  },
  { annotations: { readOnlyHint: true } }
);

// Create an in-process MCP server for the screenshot tool
const screenshotServer = createSdkMcpServer({
  name: "vivarium",
  tools: [screenshotTool],
});

export class AgentRunner {
  private config: Config;
  private state: SessionState;

  constructor(config: Config) {
    this.config = config;
    this.state = this.loadState();
  }

  private loadState(): SessionState {
    try {
      if (existsSync(SESSION_FILE)) {
        return JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
      }
    } catch (err) {
      console.warn("[agent] Failed to load session state", err);
    }
    return { totalCostUsd: 0 };
  }

  private saveState() {
    try {
      mkdirSync(dirname(SESSION_FILE), { recursive: true });
      writeFileSync(SESSION_FILE, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.warn("[agent] Failed to save session state", err);
    }
  }

  public clearSession() {
    this.state = { totalCostUsd: 0 };
    this.saveState();
  }

  public getStatus() {
    return {
      sessionId: this.state.sessionId,
      totalCostUsd: this.state.totalCostUsd
    };
  }

  async run(
    userMessage: string,
    _chatId: number,
    onEvent?: (event: AgentEvent) => void
  ): Promise<AgentResponse> {
    let fullText = "";
    let screenshot: Buffer | undefined;

    const options: Record<string, unknown> = {
      cwd: WORKSPACE,
      settingSources: ["project"],
      skills: "all",
      allowedTools: [
        "Read", "Edit", "Write", "Bash", "Glob", "Grep",
        "mcp__vivarium__screenshot",
      ],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      model: this.config.model,
      mcpServers: {
        vivarium: screenshotServer,
      },
      maxTurns: this.config.maxTurns,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: this.config.anthropicApiKey,
        CLAUDE_CONFIG_DIR: `${WORKSPACE}/.vivarium/claude_config`,
      },
      stderr: (data: string) => {
        console.error("[agent:stderr]", data);
      },
    };

    // Resume session if we have one for this chat
    if (this.state.sessionId) {
      options.resume = this.state.sessionId;
    }

    console.log(`\n[user] 👤 ${userMessage}`);

    const response = query({
      prompt: userMessage,
      options: options as any,
    });

    for await (const message of response) {
      // Capture session ID from init message
      if (message.type === "system") {
        const sys = message as any;
        const sessionId = sys.session_id ?? sys.data?.session_id;
        if (sessionId && this.state.sessionId !== sessionId) {
          this.state.sessionId = sessionId;
          this.saveState();
        }
      }

      // Capture assistant text and log thoughts/tools
      if (message.type === "assistant") {
        const assistant = message as any;
        if (assistant.message?.content) {
          for (const block of assistant.message.content) {
            if (block.type === "text") {
              fullText += block.text;
              if (block.text.trim()) {
                const textChunk = block.text.trim();
                console.log(`[agent:text] 🤖 ${textChunk}`);
                if (onEvent) onEvent({ type: "text", text: textChunk });
              }
            } else if (block.type === "thinking") {
              console.log(`[agent:thought] ${block.thinking}`);
            } else if (block.type === "tool_use") {
              console.log(`[agent:tool] 🛠️  ${block.name}(${JSON.stringify(block.input)})`);
            }
          }
        }
      }

      // Capture screenshot from tool results
      if (message.type === "user") {
        const userMsg = message as any;
        if (userMsg.message?.content) {
          for (const block of userMsg.message.content) {
            if (block.type === "tool_result" && block.tool_use_id) {
               if (Array.isArray(block.content)) {
                 for (const c of block.content) {
                   if (c.type === "image") {
                     // SDK may return image data at c.data (older) or c.source.data (newer)
                     const base64 = c.data ?? c.source?.data;
                     if (base64) {
                       const buffer = Buffer.from(base64, "base64");
                       screenshot = buffer;
                       if (onEvent) onEvent({ type: "screenshot", buffer });
                     }
                   }
                 }
               }
            }
          }
        }
      }

      // Capture result text (final agent output)
      if (message.type === "result") {
        const result = message as any;
        if (result.total_cost_usd) {
          this.state.totalCostUsd += result.total_cost_usd;
          this.saveState();
        }
        // Check for cost info
        if (result.usage) {
          console.log(
            `[agent] Tokens: ${result.usage.input_tokens} in, ${result.usage.output_tokens} out`
          );
        }
      }
    }

    return { text: fullText.trim(), screenshot };
  }
}
