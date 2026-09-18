import { prisma } from '@/lib/prisma';
import { ChannelScrapeResult } from './scrapers/types';

export const PARITY_BAND_PERCENT = 0.02; // ±2% percentage parity band

export interface ParityCalculationInput {
  propertyId: string;
  directPrice: number;
  channelResults: Record<string, ChannelScrapeResult>;
  date: string;
  auditRunId: string;
}

export interface ParityCalculationResult {
  directPrice: number;
  agodaPrice: number;
  mmtPrice: number;
  bookingPrice: number;
  airbnbPrice: number;
  lowestOtaChannel: string;
  lowestOtaPrice: number;
  parityStatus: 'PARITY_MATCH' | 'OTA_UNDERCUT' | 'DIRECT_ADVANTAGE' | 'PARTIAL_OTA_UNDERCUT' | 'PARTIAL_PARITY_MATCH';
  marginLeakage: number;
  priceDifference: number;
  isPartial: boolean;
  successfulChannelsCount: number;
  statusChanged: boolean;
  previousStatus: string | null;
}

/**
 * Maps a location name to its regional branch cluster.
 */
export function getRegionalCluster(location: string): string {
  const loc = (location || '').toLowerCase();
  if (loc.includes('lonavala') || loc.includes('karjat') || loc.includes('alibaug') || loc.includes('nashik') || loc.includes('panchgani') || loc.includes('mumbai')) {
    return 'Western Maharashtra';
  }
  if (loc.includes('goa')) {
    return 'Goa';
  }
  if (loc.includes('manali') || loc.includes('shimla') || loc.includes('kasauli') || loc.includes('nainital')) {
    return 'North Hills';
  }
  if (loc.includes('ooty') || loc.includes('coorg')) {
    return 'South Estates';
  }
  if (loc.includes('rajasthan') || loc.includes('jaipur') || loc.includes('udaipur')) {
    return 'Rajasthan Palaces';
  }
  return 'Outskirts & Other';
}

/**
 * Computes rate parity for a property across all scraped channels using percentage bands.
 */
export async function calculatePropertyParity(
  input: ParityCalculationInput
): Promise<ParityCalculationResult> {
  const { propertyId, channelResults } = input;

  // 1. Direct price from StayVista snapshot if OK, else base rate
  const svResult = channelResults['SV'];
  const directPrice = svResult && svResult.scrapeStatus === 'OK' && svResult.finalPrice > 0
    ? svResult.finalPrice
    : input.directPrice;

  // 2. Filter ONLY successfully scraped channels (scrapeStatus === 'OK')
  const validOtas: { channel: string; price: number }[] = [];
  let successfulChannelsCount = svResult && svResult.scrapeStatus === 'OK' ? 1 : 0;

  const otaChannels = ['AGODA', 'MMT', 'BOOKING', 'AIRBNB'] as const;
  for (const ch of otaChannels) {
    const res = channelResults[ch];
    if (res && res.scrapeStatus === 'OK' && res.finalPrice > 0) {
      validOtas.push({ channel: ch, price: res.finalPrice });
      successfulChannelsCount++;
    }
  }

  // Prices per channel for DB record (defaults to 0 if not scraped)
  const agodaPrice = channelResults['AGODA']?.scrapeStatus === 'OK' ? channelResults['AGODA'].finalPrice : 0;
  const mmtPrice = channelResults['MMT']?.scrapeStatus === 'OK' ? channelResults['MMT'].finalPrice : 0;
  const bookingPrice = channelResults['BOOKING']?.scrapeStatus === 'OK' ? channelResults['BOOKING'].finalPrice : 0;
  const airbnbPrice = channelResults['AIRBNB']?.scrapeStatus === 'OK' ? channelResults['AIRBNB'].finalPrice : 0;

  const isPartial = successfulChannelsCount < 4;

  let lowestOtaChannel = 'NONE';
  let lowestOtaPrice = 0;
  let baseParityStatus: 'PARITY_MATCH' | 'OTA_UNDERCUT' | 'DIRECT_ADVANTAGE' = 'PARITY_MATCH';
  let marginLeakage = 0;
  let priceDifference = 0;

  if (validOtas.length > 0) {
    validOtas.sort((a, b) => a.price - b.price);
    const lowest = validOtas[0];
    lowestOtaChannel = lowest.channel;
    lowestOtaPrice = lowest.price;

    const lowerBound = directPrice * (1 - PARITY_BAND_PERCENT);
    const upperBound = directPrice * (1 + PARITY_BAND_PERCENT);

    if (lowestOtaPrice < lowerBound) {
      baseParityStatus = 'OTA_UNDERCUT';
      marginLeakage = directPrice - lowestOtaPrice;
      priceDifference = marginLeakage;
    } else if (lowestOtaPrice > upperBound) {
      baseParityStatus = 'DIRECT_ADVANTAGE';
      priceDifference = directPrice - lowestOtaPrice;
    } else {
      baseParityStatus = 'PARITY_MATCH';
    }
  }

  const finalParityStatus = isPartial && baseParityStatus === 'OTA_UNDERCUT'
    ? 'PARTIAL_OTA_UNDERCUT'
    : isPartial && baseParityStatus === 'PARITY_MATCH'
    ? 'PARTIAL_PARITY_MATCH'
    : baseParityStatus;

  // 3. Status Changed & Previous Status lookup
  const priorAudit = await prisma.parityAudit.findFirst({
    where: {
      propertyId,
      auditRunId: { not: input.auditRunId },
    },
    orderBy: { createdAt: 'desc' },
  });

  const previousStatus = priorAudit ? priorAudit.parityStatus : null;
  const statusChanged = Boolean(previousStatus && previousStatus !== finalParityStatus);

  return {
    directPrice,
    agodaPrice,
    mmtPrice,
    bookingPrice,
    airbnbPrice,
    lowestOtaChannel,
    lowestOtaPrice,
    parityStatus: finalParityStatus,
    marginLeakage,
    priceDifference,
    isPartial,
    successfulChannelsCount,
    statusChanged,
    previousStatus,
  };
}
