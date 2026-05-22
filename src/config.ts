import { z } from "zod";

const ConfigSchema = z.object({
  anthropicApiKey: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  telegramBotToken: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  allowedUsers: z.array(z.number()).default([]),
  maxTurns: z.number().default(30),
  model: z.string().default("claude-sonnet-4-5"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const allowedUsersRaw = process.env.ALLOWED_USERS ?? "";
  const allowedUsers = allowedUsersRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n));

  return ConfigSchema.parse({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    allowedUsers,
    maxTurns: process.env.MAX_TURNS ? Number(process.env.MAX_TURNS) : undefined,
    model: process.env.MODEL,
  });
}
