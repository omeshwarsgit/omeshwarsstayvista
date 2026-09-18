/**
 * Link Repair Utility for StayVista Rate Parity Engine
 * 
 * Auto-corrects malformed URLs from legacy CSV datasets:
 * - MakeMyTrip: extracts valid hotelId from fused URLs (91.6% of MMT entries in raw CSV)
 * - Agoda: fixes doubled locale segments (/en-in/en-in/ -> /en-in/)
 * - StayVista / Booking / Airbnb: cleans and normalizes slugs and query params
 */

export interface LinkRepairResult {
  originalUrl: string;
  repairedUrl: string | null;
  wasRepaired: boolean;
  channel: string;
  extractedId?: string;
}

/**
 * Repairs MakeMyTrip URLs where two URLs or key values are fused together.
 * Example input:
 * https://www.makemytrip.com/hotels/hotel-details/?hotelId=201812311719539456&...mtkeys=defaultMtkey1000225027https://www.makemytrip.com/hotels/hotel-details/?hotelId=
 */
export function cleanMmtUrl(
  rawUrl: string,
  checkInDate?: string,
  checkOutDate?: string
): { cleanUrl: string | null; hotelId?: string; wasRepaired: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') return { cleanUrl: null, wasRepaired: false };

  const trimmed = rawUrl.trim();
  const hotelIdMatch = trimmed.match(/hotelId=(\d+)/i);

  if (!hotelIdMatch) {
    return { cleanUrl: trimmed, wasRepaired: false };
  }

  const hotelId = hotelIdMatch[1];
  const isFused = trimmed.includes('https://') && trimmed.indexOf('https://') !== trimmed.lastIndexOf('https://');
  const hasMalformedMtkeys = trimmed.includes('mtkeys=') && trimmed.includes('https');

  let cleanUrl = `https://www.makemytrip.com/hotels/hotel-details/?hotelId=${hotelId}&_uCurrency=INR`;

  if (checkInDate && checkOutDate) {
    // Format dates for MMT query params (MMDDYYYY)
    const formatMmtDate = (dStr: string) => {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[1]}${parts[2]}${parts[0]}`;
      }
      return dStr;
    };
    cleanUrl += `&checkin=${formatMmtDate(checkInDate)}&checkout=${formatMmtDate(checkOutDate)}&roomStayQualifier=2e0e`;
  }

  return {
    cleanUrl,
    hotelId,
    wasRepaired: isFused || hasMalformedMtkeys || !trimmed.startsWith('https://www.makemytrip.com/hotels/hotel-details/?hotelId='),
  };
}

/**
 * Repairs Agoda URLs with doubled locale paths (e.g. /en-in/en-in/)
 */
export function cleanAgodaUrl(
  rawUrl: string,
  checkInDate?: string,
  checkOutDate?: string
): { cleanUrl: string | null; wasRepaired: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') return { cleanUrl: null, wasRepaired: false };

  let trimmed = rawUrl.trim();
  let wasRepaired = false;

  if (trimmed.includes('/en-in/en-in/')) {
    trimmed = trimmed.replace('/en-in/en-in/', '/en-in/');
    wasRepaired = true;
  }

  if (trimmed.includes('/en-gb/en-gb/')) {
    trimmed = trimmed.replace('/en-gb/en-gb/', '/en-gb/');
    wasRepaired = true;
  }

  if (checkInDate && checkOutDate) {
    try {
      const urlObj = new URL(trimmed);
      urlObj.searchParams.set('checkIn', checkInDate);
      urlObj.searchParams.set('checkOut', checkOutDate);
      urlObj.searchParams.set('rooms', '1');
      urlObj.searchParams.set('adults', '2');
      urlObj.searchParams.set('children', '0');
      trimmed = urlObj.toString();
    } catch {
      // Keep trimmed if URL constructor fails
    }
  }

  return { cleanUrl: trimmed, wasRepaired };
}

/**
 * Normalizes StayVista direct URLs
 */
export function cleanStayVistaUrl(
  rawUrl: string,
  checkInDate?: string,
  checkOutDate?: string
): { cleanUrl: string | null; wasRepaired: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') return { cleanUrl: null, wasRepaired: false };

  let trimmed = rawUrl.trim();
  let wasRepaired = false;

  // Strip trailing slashes or queries
  const baseMatch = trimmed.match(/^(https?:\/\/(?:www\.)?stayvista\.com\/villa\/[a-zA-Z0-9_-]+)/i);
  if (baseMatch) {
    const canonical = baseMatch[1];
    if (trimmed !== canonical) {
      trimmed = canonical;
      wasRepaired = true;
    }
  }

  if (checkInDate && checkOutDate) {
    trimmed = `${trimmed}?checkin=${checkInDate}&checkout=${checkOutDate}&adult=2&child=0`;
  }

  return { cleanUrl: trimmed, wasRepaired };
}

/**
 * Normalizes Booking.com URLs
 */
export function cleanBookingUrl(
  rawUrl: string,
  checkInDate?: string,
  checkOutDate?: string
): { cleanUrl: string | null; wasRepaired: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') return { cleanUrl: null, wasRepaired: false };

  let trimmed = rawUrl.trim();
  let wasRepaired = false;

  // Strip excessive affiliate tags if needed
  if (checkInDate && checkOutDate) {
    try {
      const urlObj = new URL(trimmed);
      urlObj.searchParams.set('checkin', checkInDate);
      urlObj.searchParams.set('checkout', checkOutDate);
      urlObj.searchParams.set('group_adults', '2');
      urlObj.searchParams.set('no_rooms', '1');
      urlObj.searchParams.set('group_children', '0');
      trimmed = urlObj.toString();
      wasRepaired = true;
    } catch {
      // ignore
    }
  }

  return { cleanUrl: trimmed, wasRepaired };
}

/**
 * Normalizes Airbnb URLs
 */
export function cleanAirbnbUrl(
  rawUrl: string,
  checkInDate?: string,
  checkOutDate?: string
): { cleanUrl: string | null; wasRepaired: boolean } {
  if (!rawUrl || typeof rawUrl !== 'string') return { cleanUrl: null, wasRepaired: false };

  let trimmed = rawUrl.trim();
  let wasRepaired = false;

  if (checkInDate && checkOutDate) {
    try {
      const urlObj = new URL(trimmed);
      urlObj.searchParams.set('check_in', checkInDate);
      urlObj.searchParams.set('check_out', checkOutDate);
      urlObj.searchParams.set('adults', '2');
      trimmed = urlObj.toString();
      wasRepaired = true;
    } catch {
      // ignore
    }
  }

  return { cleanUrl: trimmed, wasRepaired };
}

/**
 * Universal channel link repair dispatcher
 */
export function repairChannelUrl(
  channel: string,
  rawUrl: string,
  checkInDate?: string,
  checkOutDate?: string
): LinkRepairResult {
  const normChannel = (channel || '').toUpperCase().trim();

  switch (normChannel) {
    case 'MMT': {
      const { cleanUrl, hotelId, wasRepaired } = cleanMmtUrl(rawUrl, checkInDate, checkOutDate);
      return {
        originalUrl: rawUrl,
        repairedUrl: wasRepaired ? cleanUrl : null,
        wasRepaired,
        channel: 'MMT',
        extractedId: hotelId,
      };
    }

    case 'AGODA': {
      const { cleanUrl, wasRepaired } = cleanAgodaUrl(rawUrl, checkInDate, checkOutDate);
      return {
        originalUrl: rawUrl,
        repairedUrl: wasRepaired ? cleanUrl : null,
        wasRepaired,
        channel: 'AGODA',
      };
    }

    case 'SV': {
      const { cleanUrl, wasRepaired } = cleanStayVistaUrl(rawUrl, checkInDate, checkOutDate);
      return {
        originalUrl: rawUrl,
        repairedUrl: wasRepaired ? cleanUrl : null,
        wasRepaired,
        channel: 'SV',
      };
    }

    case 'BOOKING': {
      const { cleanUrl, wasRepaired } = cleanBookingUrl(rawUrl, checkInDate, checkOutDate);
      return {
        originalUrl: rawUrl,
        repairedUrl: wasRepaired ? cleanUrl : null,
        wasRepaired,
        channel: 'BOOKING',
      };
    }

    case 'AIRBNB': {
      const { cleanUrl, wasRepaired } = cleanAirbnbUrl(rawUrl, checkInDate, checkOutDate);
      return {
        originalUrl: rawUrl,
        repairedUrl: wasRepaired ? cleanUrl : null,
        wasRepaired,
        channel: 'AIRBNB',
      };
    }

    default:
      return {
        originalUrl: rawUrl,
        repairedUrl: null,
        wasRepaired: false,
        channel,
      };
  }
}
