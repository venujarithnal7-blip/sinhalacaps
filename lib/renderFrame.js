import { chromium } from "playwright";

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserInstance;
}

export async function renderFrame(html, outputPath, width = 1080, height = 1920) {
  const browser = await getBrowser();

  const page = await browser.newPage({
    viewport: { width, height },
  });

  try {
    await page.setContent(html);
    await page.waitForTimeout(120);

    await page.screenshot({
      path: outputPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width, height },
    });
  } finally {
    await page.close(); // ✅ Close page but keep browser open
  }
}