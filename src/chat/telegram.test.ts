import { describe, it, expect } from "vitest";

// Extract the splitMessage logic to test it in isolation.
// We can't easily instantiate TelegramChat without a bot token,
// so we replicate the logic here and test it.
function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) {
      // No good newline, split at space
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < maxLen * 0.5) {
      // No good split point, hard cut
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

describe("splitMessage", () => {
  it("should return single chunk for short messages", () => {
    const result = splitMessage("Hello");
    expect(result).toEqual(["Hello"]);
  });

  it("should not split messages under max length", () => {
    const msg = "a".repeat(3999);
    const result = splitMessage(msg);
    expect(result).toHaveLength(1);
  });

  it("should split at newlines when possible", () => {
    const line = "a".repeat(2500);
    const msg = `${line}\n${line}`;
    const result = splitMessage(msg, 3000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(line);
    expect(result[1]).toBe(line);
  });

  it("should split at spaces when no good newline", () => {
    const word = "word ";
    const msg = word.repeat(1000); // ~5000 chars
    const result = splitMessage(msg, 4000);
    expect(result.length).toBeGreaterThan(1);
    // Every chunk should be within limit
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(4000);
    }
  });

  it("should hard-cut when no newline or space is available", () => {
    const msg = "x".repeat(8000);
    const result = splitMessage(msg, 4000);
    expect(result).toHaveLength(2);
    expect(result[0].length).toBe(4000);
    expect(result[1].length).toBe(4000);
  });

  it("should handle empty string", () => {
    const result = splitMessage("");
    expect(result).toEqual([""]);
  });
});
