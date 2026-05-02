import { chromium } from "playwright";

export async function renderFrame(html, outputPath, width = 1080, height = 1920) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  });

  const page = await browser.newPage({
    viewport: { width, height }, // ← removed deviceScaleFactor
  });

  await page.setContent(html);
  await page.waitForTimeout(120);

  await page.screenshot({
    path: outputPath,
    omitBackground: true,
    clip: { x: 0, y: 0, width, height },
  });

  await browser.close();
}