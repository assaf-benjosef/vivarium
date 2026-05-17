import puppeteer from "puppeteer-core";

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
const TARGET_URL = "http://localhost:3000";

/**
 * Creates an MCP server config for the screenshot tool.
 * The agent calls this via mcp__terrarium__screenshot.
 */
export function createScreenshotServer() {
  return {
    command: "node",
    args: ["/app/dist/agent/screenshot-server.js"],
    env: {
      PUPPETEER_EXECUTABLE_PATH: CHROMIUM_PATH,
    },
  };
}

/**
 * Take a screenshot of localhost:3000.
 * Returns base64-encoded PNG.
 */
export async function takeScreenshot(): Promise<string> {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(TARGET_URL, { waitUntil: "networkidle0", timeout: 10000 });

    const screenshot = await page.screenshot({ encoding: "base64" });
    return screenshot as string;
  } finally {
    await browser.close();
  }
}
