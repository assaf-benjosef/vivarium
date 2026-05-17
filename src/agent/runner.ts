import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Config } from "../config.js";
import { createScreenshotServer } from "./tools.js";

const WORKSPACE = "/workspace";

export interface AgentResponse {
  text: string;
  screenshot?: Buffer;
}

export class AgentRunner {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async run(userMessage: string, _chatId: number): Promise<AgentResponse> {
    let fullText = "";
    let screenshot: Buffer | undefined;

    const response = query({
      prompt: userMessage,
      options: {
        cwd: WORKSPACE,
        settingSources: ["project"],
        skills: "all",
        tools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
        allowedTools: [
          "Read", "Edit", "Write", "Bash", "Glob", "Grep",
          "mcp__terrarium__screenshot",
        ],
        permissionMode: "bypassPermissions",
        model: this.config.model,
        mcpServers: {
          terrarium: createScreenshotServer(),
        },
        maxTurns: this.config.maxTurns,
      },
    });

    // Stream the agent response
    for await (const event of response) {
      if (event.type === "text") {
        fullText += event.content;
      }

      // Capture screenshot tool result
      if (
        event.type === "tool_result" &&
        event.toolName === "mcp__terrarium__screenshot" &&
        event.content
      ) {
        try {
          // The screenshot tool returns base64-encoded PNG
          screenshot = Buffer.from(event.content as string, "base64");
        } catch {
          // Non-fatal — screenshot failed but agent can continue
        }
      }
    }

    return { text: fullText.trim(), screenshot };
  }
}
