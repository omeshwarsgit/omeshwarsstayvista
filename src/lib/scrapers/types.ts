export type ScrapeStatus = 'OK' | 'BLOCKED' | 'REDIRECTED' | 'PARSE_ERROR' | 'TIMEOUT' | 'ESTIMATED' | 'SYNTHETIC';

export interface ChannelScrapeResult {
  channel: 'SV' | 'AGODA' | 'MMT' | 'BOOKING' | 'AIRBNB';
  basePrice: number;
  taxAmount: number;
  cleaningFee?: number;
  serviceFee?: number;
  finalPrice: number;
  currency: string;
  categoryRaw: string;
  availability: boolean;
  scrapeStatus: ScrapeStatus;
  scrapedUrl?: string;
  error?: string;
}

export interface PropertyScrapeResult {
  propertyId: string;
  csvId: number;
  primaryPropertyId: number;
  name: string;
  location: string;
  categoryNormalized: string;
  checkInDate: string;
  checkOutDate: string;
  channels: Record<string, ChannelScrapeResult>;
}
