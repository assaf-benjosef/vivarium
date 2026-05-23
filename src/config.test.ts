import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function getLoadConfig() {
    const { loadConfig } = await import("./config.js");
    return loadConfig;
  }

  it("should throw if ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.HUB_URL = "ws://localhost:8080/ws";
    process.env.HUB_TOKEN = "test-token";

    const loadConfig = await getLoadConfig();
    expect(() => loadConfig()).toThrow();
  });

  it("should throw if HUB_URL is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.HUB_URL;
    process.env.HUB_TOKEN = "test-token";

    const loadConfig = await getLoadConfig();
    expect(() => loadConfig()).toThrow();
  });

  it("should throw if HUB_TOKEN is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.HUB_URL = "ws://localhost:8080/ws";
    delete process.env.HUB_TOKEN;

    const loadConfig = await getLoadConfig();
    expect(() => loadConfig()).toThrow();
  });

  it("should parse valid config with defaults", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.HUB_URL = "ws://localhost:8080/ws";
    process.env.HUB_TOKEN = "test-token";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.anthropicApiKey).toBe("sk-ant-test");
    expect(config.hubUrl).toBe("ws://localhost:8080/ws");
    expect(config.hubToken).toBe("test-token");
    expect(config.vivariumName).toBe("my-vivarium");
    expect(config.maxTurns).toBe(30);
    expect(config.model).toBe("claude-sonnet-4-5");
  });

  it("should use custom VIVARIUM_NAME if set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.HUB_URL = "ws://localhost:8080/ws";
    process.env.HUB_TOKEN = "test-token";
    process.env.VIVARIUM_NAME = "chore-tracker";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.vivariumName).toBe("chore-tracker");
  });

  it("should use custom MAX_TURNS if set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.HUB_URL = "ws://localhost:8080/ws";
    process.env.HUB_TOKEN = "test-token";
    process.env.MAX_TURNS = "10";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.maxTurns).toBe(10);
  });

  it("should use custom MODEL if set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.HUB_URL = "ws://localhost:8080/ws";
    process.env.HUB_TOKEN = "test-token";
    process.env.MODEL = "claude-opus-4-20250514";

    const loadConfig = await getLoadConfig();
    const config = loadConfig();

    expect(config.model).toBe("claude-opus-4-20250514");
  });
});
