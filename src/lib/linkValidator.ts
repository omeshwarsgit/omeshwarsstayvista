import { prisma } from '@/lib/prisma';
import { repairChannelUrl } from './linkRepair';

export interface LinkValidationResult {
  linkId: string;
  propertyId: string;
  channel: string;
  originalUrl: string;
  repairedUrl: string | null;
  linkStatus: 'VALID' | 'REDIRECTED' | 'BROKEN' | 'UNREACHABLE' | 'UNCHECKED';
  httpStatus?: number;
  finalUrl?: string;
  error?: string;
}

/**
 * Validates a single channel URL by attempting an HTTP probe.
 */
export async function validateSingleUrl(
  channel: string,
  url: string,
  timeoutMs: number = 8000
): Promise<{ status: 'VALID' | 'REDIRECTED' | 'BROKEN' | 'UNREACHABLE'; httpStatus?: number; finalUrl?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Use a realistic user agent
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    const finalUrl = res.url || url;
    const httpStatus = res.status;

    if (httpStatus === 404 || httpStatus === 410) {
      return { status: 'BROKEN', httpStatus, finalUrl };
    }

    // Check if the final URL redirected to a generic home/search page
    const normChannel = channel.toUpperCase();
    if (normChannel === 'MMT') {
      const originalHotelIdMatch = url.match(/hotelId=(\d+)/i);
      if (originalHotelIdMatch) {
        const expectedHotelId = originalHotelIdMatch[1];
        if (!finalUrl.includes(expectedHotelId)) {
          return { status: 'REDIRECTED', httpStatus, finalUrl };
        }
      }
      if (finalUrl === 'https://www.makemytrip.com/' || finalUrl.includes('/hotels/search') || finalUrl.includes('funnelType=city')) {
        return { status: 'REDIRECTED', httpStatus, finalUrl };
      }
    } else if (normChannel === 'AGODA') {
      if (finalUrl === 'https://www.agoda.com/' || finalUrl.includes('/city/') || !finalUrl.includes('/hotel/')) {
        return { status: 'REDIRECTED', httpStatus, finalUrl };
      }
    } else if (normChannel === 'SV') {
      if (finalUrl === 'https://www.stayvista.com/' || !finalUrl.includes('/villa/')) {
        return { status: 'REDIRECTED', httpStatus, finalUrl };
      }
    } else if (normChannel === 'BOOKING') {
      if (!finalUrl.includes('/hotel/')) {
        return { status: 'REDIRECTED', httpStatus, finalUrl };
      }
    } else if (normChannel === 'AIRBNB') {
      if (!finalUrl.includes('/rooms/')) {
        return { status: 'REDIRECTED', httpStatus, finalUrl };
      }
    }

    if (httpStatus >= 200 && httpStatus < 400) {
      return { status: 'VALID', httpStatus, finalUrl };
    }

    return { status: 'BROKEN', httpStatus, finalUrl };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { status: 'UNREACHABLE', error: 'Request timeout' };
    }
    return { status: 'UNREACHABLE', error: err.message || 'Connection failed' };
  }
}

/**
 * Validates a batch of channel links and records validation + repair state back to DB.
 */
export async function validateChannelLinksBatch(options: {
  limit?: number;
  offset?: number;
  channel?: string;
  propertyId?: string;
  onlyUnchecked?: boolean;
}): Promise<{
  totalChecked: number;
  validCount: number;
  repairedCount: number;
  redirectedCount: number;
  brokenCount: number;
  unreachableCount: number;
  results: LinkValidationResult[];
}> {
  const whereClause: any = {};
  if (options.channel) whereClause.channel = options.channel.toUpperCase();
  if (options.propertyId) whereClause.propertyId = options.propertyId;
  if (options.onlyUnchecked) whereClause.linkStatus = 'UNCHECKED';

  const links = await prisma.channelLink.findMany({
    where: whereClause,
    take: options.limit || 50,
    skip: options.offset || 0,
    include: { property: true },
  });

  const results: LinkValidationResult[] = [];
  let validCount = 0;
  let repairedCount = 0;
  let redirectedCount = 0;
  let brokenCount = 0;
  let unreachableCount = 0;

  for (const link of links) {
    // 1. Check if URL needs repair
    const repairInfo = repairChannelUrl(link.channel, link.url);
    const effectiveUrl = repairInfo.repairedUrl || link.url;
    if (repairInfo.wasRepaired) repairedCount++;

    // 2. Validate the effective URL
    const probe = await validateSingleUrl(link.channel, effectiveUrl, 6000);

    if (probe.status === 'VALID') validCount++;
    else if (probe.status === 'REDIRECTED') redirectedCount++;
    else if (probe.status === 'BROKEN') brokenCount++;
    else if (probe.status === 'UNREACHABLE') unreachableCount++;

    // 3. Update DB
    await prisma.channelLink.update({
      where: { id: link.id },
      data: {
        linkStatus: probe.status,
        repairedUrl: repairInfo.repairedUrl,
        lastValidatedAt: new Date(),
      },
    });

    results.push({
      linkId: link.id,
      propertyId: link.propertyId,
      channel: link.channel,
      originalUrl: link.url,
      repairedUrl: repairInfo.repairedUrl,
      linkStatus: probe.status,
      httpStatus: probe.httpStatus,
      finalUrl: probe.finalUrl,
      error: probe.error,
    });
  }

  return {
    totalChecked: links.length,
    validCount,
    repairedCount,
    redirectedCount,
    brokenCount,
    unreachableCount,
    results,
  };
}
