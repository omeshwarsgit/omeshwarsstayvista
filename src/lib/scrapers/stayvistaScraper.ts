import { ChannelScrapeResult } from './types';

/**
 * Fast-path Direct StayVista API Scraper
 * Calls production pricing endpoint: POST https://v3api.stayvista.com/api/price-breakup
 * Runs in ~400ms without browser overhead.
 */
export async function scrapeStayVistaDirect(
  primaryPropertyId: number,
  checkInDate: string,
  checkOutDate: string,
  slugUrl?: string
): Promise<ChannelScrapeResult> {
  const apiUrl = 'https://v3api.stayvista.com/api/price-breakup';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const body = {
      property_id: primaryPropertyId,
      checkin: checkInDate,
      checkout: checkOutDate,
      adult: 2,
      child: 0,
      infant: 0,
      rooms_booked: 0,
      guest: 2,
      package_type: '',
      credit_note: '',
      coupon_code: '',
      bank_offer_code: '',
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        return {
          channel: 'SV',
          basePrice: 0,
          taxAmount: 0,
          finalPrice: 0,
          currency: 'INR',
          categoryRaw: 'StayVista Direct',
          availability: false,
          scrapeStatus: 'BLOCKED',
          error: `HTTP ${res.status}`,
        };
      }
      return {
        channel: 'SV',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'StayVista Direct',
        availability: false,
        scrapeStatus: 'PARSE_ERROR',
        error: `HTTP ${res.status}`,
      };
    }

    const json = await res.json();

    if (json.error || json.message === 'dates unavailable') {
      return {
        channel: 'SV',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'StayVista Direct',
        availability: false,
        scrapeStatus: 'OK',
        error: json.error || 'Dates unavailable',
      };
    }

    const priceData = json.data?.price;
    if (!priceData) {
      return {
        channel: 'SV',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'StayVista Direct',
        availability: false,
        scrapeStatus: 'PARSE_ERROR',
        error: 'Missing price payload',
      };
    }

    const finalPrice = Math.round(priceData.total_rental_cost_with_tax || priceData.total_rental_cost_without_tax || 0);
    const basePrice = Math.round(priceData.total_rental_cost_without_tax || finalPrice * 0.82);
    const taxAmount = Math.round(priceData.tax || finalPrice - basePrice);
    const serviceFee = Math.round(priceData.service_charge || 0);

    return {
      channel: 'SV',
      basePrice,
      taxAmount,
      serviceFee,
      finalPrice,
      currency: 'INR',
      categoryRaw: 'StayVista Direct Luxury Villa',
      availability: true,
      scrapeStatus: 'OK',
      scrapedUrl: slugUrl,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        channel: 'SV',
        basePrice: 0,
        taxAmount: 0,
        finalPrice: 0,
        currency: 'INR',
        categoryRaw: 'StayVista Direct',
        availability: false,
        scrapeStatus: 'TIMEOUT',
        error: 'Request timed out',
      };
    }

    return {
      channel: 'SV',
      basePrice: 0,
      taxAmount: 0,
      finalPrice: 0,
      currency: 'INR',
      categoryRaw: 'StayVista Direct',
      availability: false,
      scrapeStatus: 'PARSE_ERROR',
      error: err.message,
    };
  }
}
