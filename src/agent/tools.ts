import puppeteer from "puppeteer-core";

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
const DEFAULT_URL = "http://localhost:3000";

/**
 * Take a screenshot of a URL (defaults to localhost:3000).
 * Returns base64-encoded PNG.
 */
export async function takeScreenshot(url?: string): Promise<string> {
  const targetUrl = url || DEFAULT_URL;

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
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 10000 });

    const screenshot = await page.screenshot({ encoding: "base64" });
    return screenshot as string;
  } finally {
    await browser.close();
  }
}
