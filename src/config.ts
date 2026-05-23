import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";

const TOKEN_FILE = "/workspace/.vivarium/hub-token";

const ConfigSchema = z.object({
  anthropicApiKey: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  hubUrl: z.string().min(1, "HUB_URL is required"),
  hubToken: z.string().min(1, "HUB_TOKEN is required"),
  vivariumName: z.string().default("my-vivarium"),
  maxTurns: z.number().default(30),
  model: z.string().default("claude-sonnet-4-5"),
});

export type Config = z.infer<typeof ConfigSchema>;

function readTokenFromFile(): string | undefined {
  try {
    if (existsSync(TOKEN_FILE)) {
      return readFileSync(TOKEN_FILE, "utf-8").trim();
    }
  } catch {
    // File not readable — fall through
  }
  return undefined;
}

export function loadConfig(): Config {
  const hubToken = process.env.HUB_TOKEN || readTokenFromFile();

  return ConfigSchema.parse({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    hubUrl: process.env.HUB_URL,
    hubToken,
    vivariumName: process.env.VIVARIUM_NAME || undefined,
    maxTurns: process.env.MAX_TURNS ? Number(process.env.MAX_TURNS) : undefined,
    model: process.env.MODEL,
  });
}
