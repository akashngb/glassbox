import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const url = process.env.SHOT_URL ?? "http://localhost:3000";
const outDir = resolve(process.cwd(), "screenshots");
await mkdir(outDir, { recursive: true });

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900, deviceScaleFactor: 2 },
  { name: "mobile-375", width: 375, height: 812, deviceScaleFactor: 2 },
];

const browser = await chromium.launch();
try {
  for (const v of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.deviceScaleFactor,
      colorScheme: "dark",
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // wait for any custom font swap
    await page.waitForTimeout(400);
    const path = resolve(outDir, `${v.name}.png`);
    await page.screenshot({ path, fullPage: false });
    console.log(`saved ${path}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
