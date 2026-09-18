import { playwrightManager } from './playwrightManager';
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
    t.includes('shieldsquare')
  );
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

    await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2}', (route) => route.abort());

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
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
    if (isBlockedPage(title, bodyText) || response?.status() === 403 || response?.status() === 429) {
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

    // Price extraction with fallback selectors
    const priceSelectors = [
      '[data-element-name="final-price"]',
      '.PriceProperty__Amount',
      '[data-selenium="price-box"]',
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

    // Category extraction
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

    await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2}', (route) => route.abort());

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
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

    if (isBlockedPage(title, bodyText) || response?.status() === 403) {
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
        error: 'Anti-bot challenge encountered',
      };
    }

    const priceSelectors = [
      '[id*="revamped_price"]',
      '#revamped_price',
      'p[class*="priceText"]',
      'span[class*="font28"]',
      '.latoBlack',
      'p.blackText',
      '[data-testid="room-rate"]',
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

    await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2}', (route) => route.abort());

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
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

    if (isBlockedPage(title, bodyText) || response?.status() === 403) {
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

    await page.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2}', (route) => route.abort());

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
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

    if (isBlockedPage(title, bodyText) || response?.status() === 403) {
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

    const priceSelectors = [
      'span[class*="_1y74zjx"]',
      'span[class*="_tyxjp1"]',
      '[data-testid="price-item-total"]',
      'span._11jcbg2',
      'div._1jo4hgw',
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
