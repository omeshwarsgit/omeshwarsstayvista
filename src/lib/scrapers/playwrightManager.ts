import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, BrowserContext, Page } from 'playwright';

// Initialize Playwright Extra with Stealth Plugin
chromium.use(stealthPlugin());

const BLOCKED_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)(\?.*)?$/i;
const BLOCKED_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'connect.facebook.net',
  'segment.com',
  'segment.io',
  'hotjar.com',
  'clarity.ms',
  'criteo.com',
  'criteo.net',
  'branch.io',
  'scorecardresearch.com',
  'optimizely.com',
  'mixpanel.com',
  'bat.bing.com',
];

/**
 * Aggressively intercepts requests to abort images, fonts, media, and tracking scripts.
 * Saves bandwidth, memory, and reduces page load times drastically.
 */
export async function setupPageInterception(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = request.url().toLowerCase();
    const resourceType = request.resourceType();

    if (
      resourceType === 'image' ||
      resourceType === 'media' ||
      resourceType === 'font' ||
      BLOCKED_EXTENSIONS.test(url) ||
      BLOCKED_DOMAINS.some((domain) => url.includes(domain))
    ) {
      return route.abort();
    }
    return route.continue();
  });
}

/**
 * Shared Playwright Browser Manager
 * Manages Chromium instance, stealth contexts, domain-level pacing, and resource interception.
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
      this.browser = (await chromium.launch({
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
      })) as unknown as Browser;
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

    // Mask webdriver property and WebGL fingerprint
    await context.addInitScript(() => {
      // Mask webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mask languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-IN', 'en-GB', 'en-US', 'en'],
      });

      // Mask plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock WebGL vendor & renderer
      try {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.apply(this, [parameter]);
        };
      } catch {}
    });

    return context;
  }

  /**
   * Paces requests to the same domain to prevent rapid-fire blocking.
   */
  public async waitForDomainSlot(domain: string): Promise<void> {
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
