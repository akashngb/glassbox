import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const url = process.env.SHOT_URL ?? "http://localhost:3300";
const outDir = resolve(process.cwd(), "screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

// Find the DATAPOINTS card (the top-left one)
const card = page.locator('text=DATAPOINTS').locator(
  'xpath=ancestor::*[contains(@class, "absolute") and contains(@class, "cursor-grab") or contains(@class, "cursor-grabbing")][1]'
);

const exists = await card.count();
console.log("draggable container count:", exists);
if (exists === 0) {
  // Fallback locator
  const alt = page.locator('div:has-text("DATAPOINTS")').first();
  console.log("alt count:", await alt.count());
}

const before = await card.boundingBox();
console.log("before:", before);

// Simulate a drag of +120px right and +60px down
await card.hover();
await page.mouse.down();
await page.mouse.move(
  before.x + before.width / 2 + 50,
  before.y + before.height / 2 + 30,
  { steps: 5 },
);
await page.mouse.move(
  before.x + before.width / 2 + 120,
  before.y + before.height / 2 + 60,
  { steps: 10 },
);
await page.waitForTimeout(120);
await page.mouse.up();
await page.waitForTimeout(400);

const after = await card.boundingBox();
console.log("after:", after);

const dx = (after?.x ?? 0) - (before?.x ?? 0);
const dy = (after?.y ?? 0) - (before?.y ?? 0);
console.log(`moved dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);

await page.screenshot({
  path: resolve(outDir, "drag-after.png"),
  fullPage: false,
});
console.log("saved drag-after.png");

// Also try dragging way past the canvas edge to verify clamping
const card2 = page.locator('text=PARAMETERS').locator(
  'xpath=ancestor::*[contains(@class, "cursor-grab") or contains(@class, "cursor-grabbing")][1]'
);
const before2 = await card2.boundingBox();
console.log("\ncard2 before:", before2);
await card2.hover();
await page.mouse.down();
// Try to drag 2000px to the right — should be clamped to canvas right edge
await page.mouse.move(before2.x + 2000, before2.y + 2000, { steps: 20 });
await page.waitForTimeout(120);
await page.mouse.up();
await page.waitForTimeout(400);
const after2 = await card2.boundingBox();
console.log("card2 after (clamp test):", after2);

await page.screenshot({
  path: resolve(outDir, "drag-clamped.png"),
  fullPage: false,
});
console.log("saved drag-clamped.png");

await browser.close();
