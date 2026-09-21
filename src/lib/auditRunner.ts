import { prisma } from '@/lib/prisma';
import { scrapeStayVistaDirect } from './scrapers/stayvistaScraper';
import { scrapeAgoda, scrapeMakeMyTrip, scrapeBooking, scrapeAirbnb } from './scrapers/otaScrapers';
import { calculatePropertyParity } from './parityEngine';
import { ChannelScrapeResult } from './scrapers/types';
import crypto from 'crypto';

export const LOCAL_SAFE_CAP = 50;

export interface ActiveJob {
  auditRunId: string;
  isCancelled: boolean;
  processedCount: number;
  totalCount: number;
  currentProperty?: {
    index: number;
    name: string;
    location: string;
  };
  channelStats: Record<string, { ok: number; estimated: number; blocked: number; error: number }>;
}

const activeJobs = new Map<string, ActiveJob>();

export function getActiveJob(runId: string): ActiveJob | undefined {
  return activeJobs.get(runId);
}

export function cancelAuditRun(runId: string): boolean {
  const job = activeJobs.get(runId);
  if (job) {
    job.isCancelled = true;
    return true;
  }
  return false;
}

export async function startAuditRun(
  auditRunId: string,
  options: {
    checkInDate: string;
    checkOutDate: string;
    mode: 'FULL' | 'INCREMENTAL';
    limit?: number;
    region?: string;
  }
): Promise<void> {
  const { checkInDate, checkOutDate, mode, limit, region } = options;

  // Build property filter
  const whereClause: any = {};
  if (region) {
    whereClause.location = { contains: region };
  }

  // Enforce safe local execution limit capped at safe threshold of 50 properties
  const safeLimit = Math.min(limit || (mode === 'INCREMENTAL' ? 25 : LOCAL_SAFE_CAP), LOCAL_SAFE_CAP);

  const properties = await prisma.property.findMany({
    where: whereClause,
    take: safeLimit,
    include: { channelLinks: true },
  });

  // Ensure totalAudited on AuditRun reflects the actual run batch size
  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { totalAudited: properties.length },
  });

  const job: ActiveJob = {
    auditRunId,
    isCancelled: false,
    processedCount: 0,
    totalCount: properties.length,
    channelStats: {
      SV: { ok: 0, estimated: 0, blocked: 0, error: 0 },
      AGODA: { ok: 0, estimated: 0, blocked: 0, error: 0 },
      MMT: { ok: 0, estimated: 0, blocked: 0, error: 0 },
      BOOKING: { ok: 0, estimated: 0, blocked: 0, error: 0 },
      AIRBNB: { ok: 0, estimated: 0, blocked: 0, error: 0 },
    },
  };
  activeJobs.set(auditRunId, job);

  // Detached asynchronous execution
  (async () => {
    let undercutCount = 0;
    let parityMatchCount = 0;
    let directAdvantageCount = 0;
    let totalLeakage = 0;

    try {
      for (let i = 0; i < properties.length; i++) {
        const property = properties[i];

        if (job.isCancelled) {
          await prisma.auditRun.update({
            where: { id: auditRunId },
            data: { status: 'CANCELLED', processedCount: job.processedCount },
          });
          activeJobs.delete(auditRunId);
          return;
        }

        // Live progress tracking
        job.currentProperty = {
          index: i + 1,
          name: property.name,
          location: property.location,
        };

        const linksMap: Record<string, string> = {};
        for (const l of property.channelLinks) {
          linksMap[l.channel] = l.repairedUrl || l.url;
        }

        const channelResults: Record<string, ChannelScrapeResult> = {};

        // 1. Direct StayVista API
        try {
          const svRes = await scrapeStayVistaDirect(
            property.primaryPropertyId,
            checkInDate,
            checkOutDate,
            linksMap['SV']
          );
          channelResults['SV'] = svRes;
          if (svRes.scrapeStatus === 'OK') job.channelStats.SV.ok++;
          else if (svRes.scrapeStatus === 'BLOCKED') job.channelStats.SV.blocked++;
          else job.channelStats.SV.error++;
        } catch {
          channelResults['SV'] = {
            channel: 'SV',
            basePrice: property.basePrice,
            taxAmount: Math.round(property.basePrice * 0.18),
            finalPrice: property.basePrice,
            currency: 'INR',
            categoryRaw: property.categoryNormalized,
            availability: true,
            scrapeStatus: 'ESTIMATED',
          };
          job.channelStats.SV.estimated++;
        }

        const directPrice = channelResults['SV']?.finalPrice || property.basePrice;

        // 2. OTA Channels: Sequential execution without Promise.all
        const otaList = ['AGODA', 'MMT', 'BOOKING', 'AIRBNB'] as const;
        for (const ota of otaList) {
          const rawUrl = linksMap[ota];
          if (!rawUrl) continue;

          try {
            let otaResult: ChannelScrapeResult | null = null;
            if (ota === 'AGODA') {
              otaResult = await scrapeAgoda(rawUrl, checkInDate, checkOutDate);
            } else if (ota === 'MMT') {
              otaResult = await scrapeMakeMyTrip(rawUrl, checkInDate, checkOutDate);
            } else if (ota === 'BOOKING') {
              otaResult = await scrapeBooking(rawUrl, checkInDate, checkOutDate);
            } else if (ota === 'AIRBNB') {
              otaResult = await scrapeAirbnb(rawUrl, checkInDate, checkOutDate);
            }

            if (otaResult && (otaResult.scrapeStatus === 'OK' || otaResult.scrapeStatus === 'REDIRECTED')) {
              channelResults[ota] = otaResult;
              if (otaResult.scrapeStatus === 'OK') job.channelStats[ota].ok++;
            } else {
              // Mark fallback clearly as ESTIMATED to protect data integrity
              const variance = 0.90 + ((property.primaryPropertyId * 17) % 25) / 100;
              const estPrice = Math.round(directPrice * variance);
              channelResults[ota] = {
                channel: ota,
                basePrice: Math.round(estPrice * 0.82),
                taxAmount: Math.round(estPrice * 0.18),
                finalPrice: estPrice,
                currency: 'INR',
                categoryRaw: `${property.categoryNormalized} on ${ota}`,
                availability: true,
                scrapeStatus: 'ESTIMATED',
                scrapedUrl: rawUrl,
              };
              job.channelStats[ota].estimated++;
            }
          } catch {
            const variance = 0.90 + ((property.primaryPropertyId * 17) % 25) / 100;
            const estPrice = Math.round(directPrice * variance);
            channelResults[ota] = {
              channel: ota,
              basePrice: Math.round(estPrice * 0.82),
              taxAmount: Math.round(estPrice * 0.18),
              finalPrice: estPrice,
              currency: 'INR',
              categoryRaw: `${property.categoryNormalized} on ${ota}`,
              availability: true,
              scrapeStatus: 'ESTIMATED',
              scrapedUrl: rawUrl,
            };
            job.channelStats[ota].estimated++;
          }
        }

        // 3. Compute Parity Logic (standardized on basePrice)
        const parity = await calculatePropertyParity({
          propertyId: property.id,
          directPrice,
          channelResults,
          date: checkInDate,
          auditRunId,
        });

        if (parity.parityStatus.includes('UNDERCUT')) {
          undercutCount++;
          totalLeakage += parity.marginLeakage;
        } else if (parity.parityStatus === 'DIRECT_ADVANTAGE') {
          directAdvantageCount++;
        } else {
          parityMatchCount++;
        }

        // 4. Record Price Snapshots with compound constraint safety
        const snapshotsData: any[] = [];
        for (const ch of ['SV', 'AGODA', 'MMT', 'BOOKING', 'AIRBNB'] as const) {
          const res = channelResults[ch];
          if (res) {
            snapshotsData.push({
              id: crypto.randomUUID(),
              auditRunId,
              propertyId: property.id,
              channel: ch,
              basePrice: res.basePrice,
              taxAmount: res.taxAmount,
              serviceFee: res.serviceFee || 0,
              finalPrice: res.finalPrice,
              currency: res.currency,
              categoryRaw: res.categoryRaw,
              availability: res.availability,
              scrapeStatus: res.scrapeStatus,
            });
          }
        }
        if (snapshotsData.length > 0) {
          // Delete prior snapshots for this property in this run if any to ensure idempotency
          await prisma.priceSnapshot.deleteMany({
            where: {
              auditRunId,
              propertyId: property.id,
            },
          });
          await prisma.priceSnapshot.createMany({
            data: snapshotsData,
          });
        }

        // 5. Record Parity Audit
        await prisma.parityAudit.deleteMany({
          where: {
            auditRunId,
            propertyId: property.id,
          },
        });
        await prisma.parityAudit.create({
          data: {
            id: crypto.randomUUID(),
            auditRunId,
            propertyId: property.id,
            date: checkInDate,
            directPrice: parity.directPrice,
            agodaPrice: parity.agodaPrice,
            mmtPrice: parity.mmtPrice,
            bookingPrice: parity.bookingPrice,
            airbnbPrice: parity.airbnbPrice,
            lowestOtaChannel: parity.lowestOtaChannel,
            lowestOtaPrice: parity.lowestOtaPrice,
            parityStatus: parity.parityStatus,
            marginLeakage: parity.marginLeakage,
            priceDifference: parity.priceDifference,
            previousStatus: parity.previousStatus,
            statusChanged: parity.statusChanged,
          },
        });

        job.processedCount++;

        // Update progress in DB after each property
        await prisma.auditRun.update({
          where: { id: auditRunId },
          data: {
            processedCount: job.processedCount,
            undercutCount,
            parityMatchCount,
            directAdvantageCount,
            totalLeakage,
          },
        });

        // 6. Enforce Sequential Pacing: Asynchronous sleep between 6,000ms and 10,000ms
        if (job.processedCount < properties.length && !job.isCancelled) {
          const randomJitter = Math.floor(Math.random() * (10000 - 6000 + 1)) + 6000;
          await new Promise((r) => setTimeout(r, randomJitter));
        }
      }

      // Mark run COMPLETED
      await prisma.auditRun.update({
        where: { id: auditRunId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processedCount: job.processedCount,
          undercutCount,
          parityMatchCount,
          directAdvantageCount,
          totalLeakage,
        },
      });
    } catch (err: any) {
      console.error('Audit runner error:', err);
      await prisma.auditRun.update({
        where: { id: auditRunId },
        data: { status: 'FAILED' },
      });
    } finally {
      activeJobs.delete(auditRunId);
    }
  })();
}

