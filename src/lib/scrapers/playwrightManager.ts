import { chromium, Browser, BrowserContext } from 'playwright';

/**
 * Shared Playwright Browser Manager
 * Manages Chromium instance, stealth contexts, domain-level pacing, and concurrency limits.
 */
class PlaywrightManager {
  private browser: Browser | null = null;
  private isLaunching = false;
  private lastRequestTimeByDomain: Map<string, number> = new Map();
  private activeRequestsByDomain: Map<string, number> = new Map();
  private readonly maxConcurrencyPerDomain = 2;
  private readonly minDelayMs = 2000;
  private readonly maxDelayMs = 4500;

  public async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isLaunching) {
      // Wait for ongoing launch
      while (this.isLaunching) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (this.browser && this.browser.isConnected()) {
        return this.browser;
      }
    }

    this.isLaunching = true;
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--hide-scrollbars',
          '--mute-audio',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-extensions',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--enable-features=NetworkService,NetworkServiceInProcess',
        ],
      });
      return this.browser;
    } finally {
      this.isLaunching = false;
    }
  }

  public async createStealthContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: {
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Mask webdriver property
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    return context;
  }

  /**
   * Paces requests to the same domain to prevent rapid-fire blocking.
   */
  public async waitForDomainSlot(domain: string): Promise<void> {
    // Wait for slot under concurrency cap
    while ((this.activeRequestsByDomain.get(domain) || 0) >= this.maxConcurrencyPerDomain) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const lastTime = this.lastRequestTimeByDomain.get(domain) || 0;
    const now = Date.now();
    const elapsed = now - lastTime;
    const requiredDelay = Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;

    if (elapsed < requiredDelay) {
      await new Promise((resolve) => setTimeout(resolve, requiredDelay - elapsed));
    }

    const currentCount = this.activeRequestsByDomain.get(domain) || 0;
    this.activeRequestsByDomain.set(domain, currentCount + 1);
    this.lastRequestTimeByDomain.set(domain, Date.now());
  }

  public releaseDomainSlot(domain: string): void {
    const currentCount = this.activeRequestsByDomain.get(domain) || 1;
    this.activeRequestsByDomain.set(domain, Math.max(0, currentCount - 1));
    this.lastRequestTimeByDomain.set(domain, Date.now());
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

export const playwrightManager = new PlaywrightManager();
