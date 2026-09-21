import { playwrightManager, setupPageInterception } from './playwrightManager';
import { ChannelScrapeResult } from './types';
import { repairChannelUrl } from '../linkRepair';

/**
 * Helper to clean and parse price text into numeric values.
 * e.g. "₹ 24,500" -> 24500, "INR 31,999.00" -> 31999
 */
function parsePriceString(str: string): number {
  if (!str) return 0;
  const digits = str.replace(/[^0-9.]/g, '');
  const val = parseFloat(digits);
  return isNaN(val) ? 0 : Math.round(val);
}

/**
 * Checks if HTML or title indicates anti-bot blockage.
 */
function isBlockedPage(title: string, text: string): boolean {
  const t = (title + ' ' + text).toLowerCase();
  return (
    t.includes('cloudflare') ||
    t.includes('access denied') ||
    t.includes('security check') ||
    t.includes('human verification') ||
    t.includes('verify you are human') ||
    t.includes('captcha') ||
    t.includes('bot challenge') ||
    t.includes('pardon our interruption') ||
    t.includes('shieldsquare') ||
    t.includes('akamai') ||
    t.includes('perimeterx')
  );
}

/**
 * Helper to extract prices via proximity search when standard selectors fail.
 */
async function extractPriceViaProximity(page: any): Promise<number> {
  try {
    const rawPrice = await page.evaluate(() => {
      // Look for elements with currency symbols or "Total"
      const candidates = Array.from(document.querySelectorAll('span, div, p, strong, b'));
      for (const el of candidates) {
        const text = el.textContent?.trim() || '';
        if (text.startsWith('₹') || text.startsWith('INR')) {
          const match = text.match(/(?:₹|INR)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
          if (match) {
            const num = parseFloat(match[1].replace(/,/g, ''));
            if (num >= 2000 && num <= 500000) {
              return num;
            }
          }
        }
      }
      return 0;
    });
    return rawPrice || 0;
  } catch {
    return 0;
  }
}

/**
 * Scrapes Agoda property listing with fresh dates.
 */
export async function scrapeAgoda(
  rawUrl: string,
  checkInDate: string,
  checkOutDate: string
): Promise<ChannelScrapeResult> {
  const domain = 'agoda.com';
  const { repairedUrl } = repairChannelUrl('AGODA', rawUrl, checkInDate, checkOutDate);
  const targetUrl = repairedUrl || rawUrl;

  await playwrightManager.waitForDomainSlot(domain);
  let context;

  try {
    context = await playwrightManager.createStealthContext();
    const page = await context.newPage();

    // Aggressive interception of images, fonts, analytics
    await setupPageInterception(page);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 18000 });
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    const finalUrl = page.url();
    const title = await page.title();
    const bodyText = await page.innerText('body').catch(() => '');

    // Check redirect
    if (finalUrl.includes('/city/') || finalUrl === 'https://www.agoda.com/' || !finalUrl.includes('/hotel/')) {
      return {
        channel: 'AGODA',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'Agoda Listing',
        availability: false,
        scrapeStatus: 'REDIRECTED',
        scrapedUrl: finalUrl,
        error: 'Redirected to generic search/city page',
      };
    }

    // Check Bot Block
    if (isBlockedPage(title, bodyText)) {
      return {
        channel: 'AGODA',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'Agoda Listing',
        availability: false,
        scrapeStatus: 'BLOCKED',
        scrapedUrl: finalUrl,
        error: 'Anti-bot challenge encountered',
      };
    }

    // Price extraction with standard attributes and proximity
    const priceSelectors = [
      '[data-element-name="final-price"]',
      '[data-selenium="price-box"]',
      '[data-testid="price-item-total"]',
      '[data-element-name="property-price"]',
      '.PriceProperty__Amount',
      'span[class*="price-box"]',
      'span[class*="final-price"]',
      '.PropertyCard__Price',
      'span.pd-price',
    ];

    let extractedPrice = 0;
    for (const selector of priceSelectors) {
      const el = await page.$(selector);
      if (el) {
        const text = await el.innerText();
        const price = parsePriceString(text);
        if (price > 1000) {
          extractedPrice = price;
          break;
        }
      }
    }

    if (extractedPrice === 0) {
      extractedPrice = await extractPriceViaProximity(page);
    }

    let categoryRaw = 'Villa by Vista';
    const categoryEl = await page.$('h1, [data-selenium="hotel-header-name"], .Header__Title');
    if (categoryEl) {
      const h1Text = await categoryEl.innerText();
      if (h1Text.toLowerCase().includes('cottage')) categoryRaw = 'Cottage by Vista';
      else if (h1Text.toLowerCase().includes('mansion')) categoryRaw = 'Mansion by Vista';
      else if (h1Text.toLowerCase().includes('bungalow')) categoryRaw = 'Bungalow by Vista';
    }

    if (extractedPrice > 0) {
      return {
        channel: 'AGODA',
        basePrice: Math.round(extractedPrice * 0.82),
        taxAmount: Math.round(extractedPrice * 0.18),
        finalPrice: extractedPrice,
        currency: 'INR',
        categoryRaw,
        availability: true,
        scrapeStatus: 'OK',
        scrapedUrl: finalUrl,
      };
    }

    return {
      channel: 'AGODA',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw,
      availability: false,
      scrapeStatus: 'PARSE_ERROR',
      scrapedUrl: finalUrl,
      error: 'Price selector not resolved on page',
    };
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.includes('timeout'));
    return {
      channel: 'AGODA',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'Agoda Listing',
      availability: false,
      scrapeStatus: isTimeout ? 'TIMEOUT' : 'PARSE_ERROR',
      error: err.message || 'Scrape failed',
    };
  } finally {
    if (context) await context.close().catch(() => {});
    playwrightManager.releaseDomainSlot(domain);
  }
}

/**
 * Scrapes MakeMyTrip property listing with fresh dates.
 * Akamai Bot Manager blocks standard desktop Playwright on residential IPs;
 * includes fast detection and graceful early exit to prevent stalling the audit runner.
 */
export async function scrapeMakeMyTrip(
  rawUrl: string,
  checkInDate: string,
  checkOutDate: string
): Promise<ChannelScrapeResult> {
  const domain = 'makemytrip.com';
  const { repairedUrl, extractedId } = repairChannelUrl('MMT', rawUrl, checkInDate, checkOutDate);
  const targetUrl = repairedUrl || rawUrl;

  await playwrightManager.waitForDomainSlot(domain);
  let context;

  try {
    context = await playwrightManager.createStealthContext();
    const page = await context.newPage();

    // Aggressive interception of images, fonts, analytics
    await setupPageInterception(page);

    // Fast navigation with reduced 12s timeout to prevent hanging on Akamai WAF challenges
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 12000 });
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    const finalUrl = page.url();
    const title = await page.title();
    const bodyText = await page.innerText('body').catch(() => '');

    // Check Redirect away from expected hotelId
    if (extractedId && !finalUrl.includes(extractedId)) {
      return {
        channel: 'MMT',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'MakeMyTrip Listing',
        availability: false,
        scrapeStatus: 'REDIRECTED',
        scrapedUrl: finalUrl,
        error: `Redirected away from hotelId ${extractedId}`,
      };
    }

    // Akamai WAF Block detection
    if (isBlockedPage(title, bodyText) || title.includes('Access Denied') || bodyText.includes('Reference #')) {
      return {
        channel: 'MMT',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'MakeMyTrip Listing',
        availability: false,
        scrapeStatus: 'BLOCKED',
        scrapedUrl: finalUrl,
        error: 'Akamai WAF challenge encountered on desktop endpoint',
      };
    }

    const priceSelectors = [
      '[id*="revamped_price"]',
      '#revamped_price',
      '[data-testid="room-rate"]',
      'p[class*="priceText"]',
      'span[class*="font28"]',
      '.latoBlack',
      'p.blackText',
    ];

    let extractedPrice = 0;
    for (const selector of priceSelectors) {
      const el = await page.$(selector);
      if (el) {
        const text = await el.innerText();
        const price = parsePriceString(text);
        if (price > 1000) {
          extractedPrice = price;
          break;
        }
      }
    }

    if (extractedPrice === 0) {
      extractedPrice = await extractPriceViaProximity(page);
    }

    let categoryRaw = 'StayVista Premium Villa';
    const catEl = await page.$('h1, [class*="hotelName"], .pdpHeader__hotelName');
    if (catEl) {
      const text = await catEl.innerText();
      if (text.toLowerCase().includes('mansion')) categoryRaw = 'StayVista Premium Mansion';
      else if (text.toLowerCase().includes('cottage')) categoryRaw = 'StayVista Premium Cottage';
    }

    if (extractedPrice > 0) {
      return {
        channel: 'MMT',
        basePrice: Math.round(extractedPrice * 0.82),
        taxAmount: Math.round(extractedPrice * 0.18),
        finalPrice: extractedPrice,
        currency: 'INR',
        categoryRaw,
        availability: true,
        scrapeStatus: 'OK',
        scrapedUrl: finalUrl,
      };
    }

    return {
      channel: 'MMT',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw,
      availability: false,
      scrapeStatus: 'PARSE_ERROR',
      scrapedUrl: finalUrl,
      error: 'MMT rate selector not resolved',
    };
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.includes('timeout'));
    return {
      channel: 'MMT',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'MakeMyTrip Listing',
      availability: false,
      scrapeStatus: isTimeout ? 'TIMEOUT' : 'PARSE_ERROR',
      error: err.message || 'MMT Scrape failed',
    };
  } finally {
    if (context) await context.close().catch(() => {});
    playwrightManager.releaseDomainSlot(domain);
  }
}

/**
 * Scrapes Booking.com listing with fresh dates.
 */
export async function scrapeBooking(
  rawUrl: string,
  checkInDate: string,
  checkOutDate: string
): Promise<ChannelScrapeResult> {
  const domain = 'booking.com';
  const { repairedUrl } = repairChannelUrl('BOOKING', rawUrl, checkInDate, checkOutDate);
  const targetUrl = repairedUrl || rawUrl;

  await playwrightManager.waitForDomainSlot(domain);
  let context;

  try {
    context = await playwrightManager.createStealthContext();
    const page = await context.newPage();

    // Aggressive interception of images, fonts, analytics
    await setupPageInterception(page);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 18000 });
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    const finalUrl = page.url();
    const title = await page.title();
    const bodyText = await page.innerText('body').catch(() => '');

    if (!finalUrl.includes('/hotel/')) {
      return {
        channel: 'BOOKING',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'Booking.com Listing',
        availability: false,
        scrapeStatus: 'REDIRECTED',
        scrapedUrl: finalUrl,
        error: 'Redirected away from hotel details',
      };
    }

    if (isBlockedPage(title, bodyText)) {
      return {
        channel: 'BOOKING',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'Booking.com Listing',
        availability: false,
        scrapeStatus: 'BLOCKED',
        scrapedUrl: finalUrl,
        error: 'Booking challenge page encountered',
      };
    }

    const priceSelectors = [
      '[data-testid="price-and-discounted-price"]',
      '[data-testid="room-rate"]',
      '[data-testid="total-price"]',
      '.prco-valign-middle-helper',
      'span[class*="prco_defaultstyle"]',
      '.bui-price-display__value',
      'span[class*="price-display"]',
    ];

    let extractedPrice = 0;
    for (const selector of priceSelectors) {
      const el = await page.$(selector);
      if (el) {
        const text = await el.innerText();
        const price = parsePriceString(text);
        if (price > 1000) {
          extractedPrice = price;
          break;
        }
      }
    }

    if (extractedPrice === 0) {
      extractedPrice = await extractPriceViaProximity(page);
    }

    if (extractedPrice > 0) {
      return {
        channel: 'BOOKING',
        basePrice: Math.round(extractedPrice * 0.82),
        taxAmount: Math.round(extractedPrice * 0.18),
        finalPrice: extractedPrice,
        currency: 'INR',
        categoryRaw: 'Private Villa',
        availability: true,
        scrapeStatus: 'OK',
        scrapedUrl: finalUrl,
      };
    }

    return {
      channel: 'BOOKING',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'Private Villa',
      availability: false,
      scrapeStatus: 'PARSE_ERROR',
      scrapedUrl: finalUrl,
      error: 'Price selector not resolved',
    };
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.includes('timeout'));
    return {
      channel: 'BOOKING',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'Booking.com Listing',
      availability: false,
      scrapeStatus: isTimeout ? 'TIMEOUT' : 'PARSE_ERROR',
      error: err.message,
    };
  } finally {
    if (context) await context.close().catch(() => {});
    playwrightManager.releaseDomainSlot(domain);
  }
}

/**
 * Scrapes Airbnb listing with fresh dates.
 */
export async function scrapeAirbnb(
  rawUrl: string,
  checkInDate: string,
  checkOutDate: string
): Promise<ChannelScrapeResult> {
  const domain = 'airbnb.com';
  const { repairedUrl } = repairChannelUrl('AIRBNB', rawUrl, checkInDate, checkOutDate);
  const targetUrl = repairedUrl || rawUrl;

  await playwrightManager.waitForDomainSlot(domain);
  let context;

  try {
    context = await playwrightManager.createStealthContext();
    const page = await context.newPage();

    // Aggressive interception of images, fonts, analytics
    await setupPageInterception(page);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 18000 });
    } catch {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    const finalUrl = page.url();
    const title = await page.title();
    const bodyText = await page.innerText('body').catch(() => '');

    if (!finalUrl.includes('/rooms/')) {
      return {
        channel: 'AIRBNB',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'Airbnb Listing',
        availability: false,
        scrapeStatus: 'REDIRECTED',
        scrapedUrl: finalUrl,
        error: 'Redirected away from rooms listing',
      };
    }

    if (isBlockedPage(title, bodyText)) {
      return {
        channel: 'AIRBNB',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'Airbnb Listing',
        availability: false,
        scrapeStatus: 'BLOCKED',
        scrapedUrl: finalUrl,
        error: 'Airbnb verification screen encountered',
      };
    }

    // Move away from obfuscated CSS classes to standard data-testids & sidebar locators
    const priceSelectors = [
      '[data-testid="price-item-total"]',
      '[data-section-id="BOOK_IT_SIDEBAR"] [data-testid*="price"]',
      'div[data-testid="book-it-default"] span',
      'div[data-section-id="BOOK_IT_SIDEBAR"] span[class*="_"]',
      'span[class*="_1y74zjx"]',
      'span[class*="_tyxjp1"]',
      'span._11jcbg2',
    ];

    let extractedPrice = 0;
    for (const selector of priceSelectors) {
      const el = await page.$(selector);
      if (el) {
        const text = await el.innerText();
        const price = parsePriceString(text);
        if (price > 1000) {
          extractedPrice = price;
          break;
        }
      }
    }

    if (extractedPrice === 0) {
      extractedPrice = await extractPriceViaProximity(page);
    }

    if (extractedPrice > 0) {
      return {
        channel: 'AIRBNB',
        basePrice: Math.round(extractedPrice * 0.82),
        taxAmount: Math.round(extractedPrice * 0.18),
        finalPrice: extractedPrice,
        currency: 'INR',
        categoryRaw: 'Entire Villa by Vista',
        availability: true,
        scrapeStatus: 'OK',
        scrapedUrl: finalUrl,
      };
    }

    return {
      channel: 'AIRBNB',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'Entire Villa by Vista',
      availability: false,
      scrapeStatus: 'PARSE_ERROR',
      scrapedUrl: finalUrl,
      error: 'Airbnb total price element not found',
    };
  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.includes('timeout'));
    return {
      channel: 'AIRBNB',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'Airbnb Listing',
      availability: false,
      scrapeStatus: isTimeout ? 'TIMEOUT' : 'PARSE_ERROR',
      error: err.message,
    };
  } finally {
    if (context) await context.close().catch(() => {});
    playwrightManager.releaseDomainSlot(domain);
  }
}

