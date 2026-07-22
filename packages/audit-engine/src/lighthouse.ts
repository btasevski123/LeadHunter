export interface LighthouseScores {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

export async function runLighthouse(
  url: string,
  timeoutMs = 120000,
): Promise<LighthouseScores> {
  const chromeLauncher = await import('chrome-launcher');
  const lighthouse = (await import('lighthouse')).default;

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const result = await Promise.race([
      lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'seo', 'accessibility', 'best-practices'],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Lighthouse timeout')), timeoutMs),
      ),
    ]);

    const cats = result?.lhr?.categories;
    return {
      performance: scoreOf(cats?.performance?.score),
      seo: scoreOf(cats?.seo?.score),
      accessibility: scoreOf(cats?.accessibility?.score),
      bestPractices: scoreOf(cats?.['best-practices']?.score),
    };
  } finally {
    await chrome.kill();
  }
}

function scoreOf(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value * 100);
}
