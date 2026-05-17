import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We test loadConfig by manipulating process.env directly
describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Dynamic import to get fresh module each time
  async function getLoadConfig() {
    // Vitest caches modules, so we use import directly
    const { loadConfig } = await import("./config.js");
    return loadConfig;
  }

  it("should throw if ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";

    const loadConfig = await getLoadConfig();
    expect(() => loadConfig()).toThrow();
  });

  it("should throw if TELEGRAM_BOT_TOKEN is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.TELEGRAM_BOT_TOKEN;

    const loadConfig = await getLoadConfig();
    expect(() => loadConfig()).toThrow();
  });

  it("should parse valid config with defaults", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.anthropicApiKey).toBe("sk-ant-test");
    expect(config.telegramBotToken).toBe("123:ABC");
    expect(config.allowedUsers).toEqual([]);
    expect(config.maxTurns).toBe(30);
    expect(config.model).toBe("claude-sonnet-4-20250514");
  });

  it("should parse ALLOWED_USERS as comma-separated numbers", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.ALLOWED_USERS = "111,222,333";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.allowedUsers).toEqual([111, 222, 333]);
  });

  it("should handle ALLOWED_USERS with spaces and empty segments", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.ALLOWED_USERS = " 111 , , 222 , ";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.allowedUsers).toEqual([111, 222]);
  });

  it("should filter out NaN from ALLOWED_USERS", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.ALLOWED_USERS = "111,notanumber,222";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.allowedUsers).toEqual([111, 222]);
  });

  it("should use custom MAX_TURNS if set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.MAX_TURNS = "10";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.maxTurns).toBe(10);
  });

  it("should use custom MODEL if set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.MODEL = "claude-opus-4-20250514";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.model).toBe("claude-opus-4-20250514");
  });
});
