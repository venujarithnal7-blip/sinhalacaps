import { chromium } from "playwright";

export async function renderFrame(html, outputPath, width = 1080, height = 1920) {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });

  await page.setContent(html);

  // ✅ Wait for animation to reach peak (60% of 0.2s = ~120ms)
  await page.waitForTimeout(120);

  await page.screenshot({
    path: outputPath,
    omitBackground: true,
    clip: { x: 0, y: 0, width, height },
  });

  await browser.close();
}