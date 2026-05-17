import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { Config } from "../config.js";
import { z } from "zod";
import { takeScreenshot } from "./tools.js";

const WORKSPACE = "/workspace";

export interface AgentResponse {
  text: string;
  screenshot?: Buffer;
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
  name: "terrarium",
  tools: [screenshotTool],
});

export class AgentRunner {
  private config: Config;
  private sessionId?: string;

  constructor(config: Config) {
    this.config = config;
  }

  async run(userMessage: string, _chatId: number): Promise<AgentResponse> {
    let fullText = "";
    let screenshot: Buffer | undefined;

    const options: Record<string, unknown> = {
      cwd: WORKSPACE,
      settingSources: ["project"],
      skills: "all",
      allowedTools: [
        "Read", "Edit", "Write", "Bash", "Glob", "Grep",
        "mcp__terrarium__screenshot",
      ],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      model: this.config.model,
      mcpServers: {
        terrarium: screenshotServer,
      },
      maxTurns: this.config.maxTurns,
    };

    // Resume session if we have one for this chat
    if (this.sessionId) {
      options.resume = this.sessionId;
    }

    const response = query({
      prompt: userMessage,
      options: options as any,
    });

    for await (const message of response) {
      // Capture session ID from init message
      if (message.type === "system" && "subtype" in message) {
        const sys = message as any;
        if (sys.subtype === "init" && sys.data?.session_id) {
          this.sessionId = sys.data.session_id;
        }
      }

      // Capture assistant text
      if (message.type === "assistant") {
        const assistant = message as any;
        if (assistant.message?.content) {
          for (const block of assistant.message.content) {
            if (block.type === "text") {
              fullText += block.text;
            }
          }
        }
      }

      // Capture result text (final agent output)
      if (message.type === "result") {
        const result = message as any;
        if (result.result) {
          fullText = result.result; // Use the final result as the response
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
