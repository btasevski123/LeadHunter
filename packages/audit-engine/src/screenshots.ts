import path from 'node:path';
import type { StorageService } from '@leadhunter/shared';
import { normalizeUrl } from '@leadhunter/shared';

export interface ScreenshotResult {
  desktopPath: string | null;
  mobilePath: string | null;
}

export async function captureScreenshots(
  companyId: string,
  website: string | null | undefined,
  storage: StorageService,
): Promise<ScreenshotResult> {
  const url = normalizeUrl(website);
  if (!url) {
    return { desktopPath: null, mobilePath: null };
  }

  let browser: Awaited<ReturnType<Awaited<typeof import('playwright')>['chromium']['launch']>> | null =
    null;

  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const desktopPath = path.posix.join('screenshots', companyId, 'desktop.png');
    const mobilePath = path.posix.join('screenshots', companyId, 'mobile.png');

    const desktop = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await desktop.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await desktop.waitForTimeout(1200);
    const desktopBuffer = await desktop.screenshot({ fullPage: false, type: 'png' });
    await storage.put(desktopPath, desktopBuffer);
    await desktop.close();

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await mobile.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mobile.waitForTimeout(1200);
    const mobileBuffer = await mobile.screenshot({ fullPage: false, type: 'png' });
    await storage.put(mobilePath, mobileBuffer);
    await mobile.close();

    return { desktopPath, mobilePath };
  } catch {
    return { desktopPath: null, mobilePath: null };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
