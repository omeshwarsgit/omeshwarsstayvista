import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

function cleanMmtUrl(rawUrl: string): { cleanUrl: string | null; hotelId?: string } {
  if (!rawUrl) return { cleanUrl: null };
  const trimmed = rawUrl.trim();
  const hotelIdMatch = trimmed.match(/hotelId=(\d+)/i);
  if (!hotelIdMatch) return { cleanUrl: trimmed };
  const hotelId = hotelIdMatch[1];
  return {
    cleanUrl: `https://www.makemytrip.com/hotels/hotel-details/?hotelId=${hotelId}&_uCurrency=INR`,
    hotelId,
  };
}

function cleanAgodaUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();
  if (trimmed.includes('/en-in/en-in/')) {
    trimmed = trimmed.replace('/en-in/en-in/', '/en-in/');
  }
  if (trimmed.includes('/en-gb/en-gb/')) {
    trimmed = trimmed.replace('/en-gb/en-gb/', '/en-gb/');
  }
  return trimmed;
}

function parsePropertyMetadata(name: string, svUrl: string, agodaUrl: string) {
  const text = (name + ' ' + svUrl + ' ' + agodaUrl).toLowerCase();

  let bhk = 3;
  const bhkMatch =
    text.match(/(\d+)\s*bhk/) ||
    text.match(/(\d+)-bhk/) ||
    text.match(/(\d+)\s*bedroom/) ||
    text.match(/(\d+)\s*bed/);

  if (bhkMatch) bhk = parseInt(bhkMatch[1], 10);
  else if (text.includes('mansion') || text.includes('manor')) bhk = 8;
  else if (text.includes('estate') || text.includes('grand')) bhk = 5;
  else if (text.includes('dorms') || text.includes('room')) bhk = 1;
  bhk = Math.max(1, Math.min(12, bhk));

  let loc = 'Lonavala';
  if (text.includes('karjat')) loc = 'Karjat';
  else if (text.includes('alibaug') || text.includes('alibag') || text.includes('zirad')) loc = 'Alibaug';
  else if (text.includes('goa') || text.includes('morjim') || text.includes('candolim')) loc = 'Goa';
  else if (text.includes('nashik') || text.includes('nasik')) loc = 'Nashik';
  else if (text.includes('manali')) loc = 'Manali';
  else if (text.includes('shimla')) loc = 'Shimla';
  else if (text.includes('kasauli')) loc = 'Kasauli';
  else if (text.includes('panchgani') || text.includes('mahabaleshwar')) loc = 'Panchgani';

  let categoryNormalized = 'Villa';
  if (text.includes('bungalow')) categoryNormalized = 'Bungalow';
  else if (text.includes('cottage')) categoryNormalized = 'Cottage';
  else if (text.includes('mansion') || text.includes('manor')) categoryNormalized = 'Mansion';
  else if (text.includes('homestay') || text.includes('farm')) categoryNormalized = 'Homestay';

  let baseRate = 21000;
  if (bhk === 1) baseRate = 7500;
  else if (bhk === 2) baseRate = 14000;
  else if (bhk === 3) baseRate = 21000;
  else if (bhk === 4) baseRate = 28000;
  else if (bhk === 5) baseRate = 36000;
  else baseRate = 45000 + (bhk - 6) * 9000;

  if (loc === 'Goa' || loc === 'Alibaug') baseRate = Math.round(baseRate * 1.25);
  else if (loc === 'Lonavala' || loc === 'Manali') baseRate = Math.round(baseRate * 1.15);

  baseRate = Math.round(baseRate / 100) * 100;
  return { bhk, location: loc, categoryNormalized, baseRate };
}

async function main() {
  console.log('🌱 Seeding exactly 50 properties from DOC-20260916-WA0006.csv...');

  // 1. Wipe existing data to guarantee clean 50-property database
  await prisma.priceSnapshot.deleteMany();
  await prisma.parityAudit.deleteMany();
  await prisma.channelLink.deleteMany();
  await prisma.auditRun.deleteMany();
  await prisma.property.deleteMany();

  const csvPath = path.join(process.cwd(), 'DOC-20260916-WA0006.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const rawRecords = parse(fileContent, { columns: true, skip_empty_lines: true });

  const first50 = rawRecords.slice(0, 50);
  console.log(`Processing ${first50.length} properties...`);

  // Create baseline AuditRun
  const today = '2026-10-10';
  const tomorrow = '2026-10-11';
  const auditRun = await prisma.auditRun.create({
    data: {
      status: 'COMPLETED',
      triggeredBy: 'SEED_INITIALIZER',
      mode: 'FULL',
      checkInDate: today,
      checkOutDate: tomorrow,
      totalAudited: 50,
      processedCount: 50,
    },
  });

  let undercutCount = 0;
  let parityMatchCount = 0;
  let directAdvantageCount = 0;
  let totalLeakage = 0;

  for (let i = 0; i < first50.length; i++) {
    const row = first50[i];
    const idRaw = row['ID ']?.trim() || row['ID']?.trim();
    const primaryIdRaw = row['Primary_Property_ID ']?.trim() || row['Primary_Property_ID']?.trim();
    const name = row['Property_Name']?.trim();

    const csvId = parseInt(idRaw, 10);
    const primaryPropertyId = primaryIdRaw ? parseInt(primaryIdRaw, 10) : csvId;

    const svUrl = (row['SV ']?.trim() || row['SV']?.trim() || '');
    const agodaUrl = cleanAgodaUrl(row['Agoda']?.trim() || '');
    const { cleanUrl: mmtUrl } = cleanMmtUrl(row['MMT ']?.trim() || row['MMT']?.trim() || '');
    const bookingUrl = (row['Booking ']?.trim() || row['Booking']?.trim() || '');
    const airbnbUrl = (row['Airbnb']?.trim() || '');

    const meta = parsePropertyMetadata(name, svUrl, agodaUrl);

    // StayVista verified baseline
    let directPrice = meta.baseRate;
    // For Property 1 (The Boulevard Villa), match the exact verified live rate
    if (csvId === 5) directPrice = 16114;
    else if (csvId === 7) directPrice = 22936;
    else if (csvId === 29) directPrice = 18928;
    else if (csvId === 32) directPrice = 39619;

    // Create Property
    const property = await prisma.property.create({
      data: {
        csvId,
        primaryPropertyId,
        name,
        location: meta.location,
        categoryNormalized: meta.categoryNormalized,
        basePrice: directPrice,
      },
    });

    // Create Channel Links
    const links = [
      { channel: 'SV', url: svUrl, repairedUrl: svUrl },
      { channel: 'AGODA', url: row['Agoda']?.trim() || '', repairedUrl: agodaUrl },
      { channel: 'MMT', url: row['MMT ']?.trim() || row['MMT']?.trim() || '', repairedUrl: mmtUrl || '' },
      { channel: 'BOOKING', url: bookingUrl, repairedUrl: bookingUrl },
      { channel: 'AIRBNB', url: airbnbUrl, repairedUrl: airbnbUrl },
    ];

    for (const l of links) {
      if (l.url) {
        await prisma.channelLink.create({
          data: {
            propertyId: property.id,
            channel: l.channel,
            url: l.url,
            repairedUrl: l.repairedUrl !== l.url ? l.repairedUrl : null,
            linkStatus: 'VALID',
            lastValidatedAt: new Date(),
          },
        });
      }
    }

    // Determine realistic channel rates
    // Property 1 verified: Booking is 15615 (Undercut), Airbnb is 17043 (Direct Advantage)
    let bookingPrice = Math.round(directPrice * 0.97); // 3% undercut
    let agodaPrice = Math.round(directPrice * 1.01);   // Parity match
    let mmtPrice = Math.round(directPrice * 0.98);     // Parity match / slight discount
    let airbnbPrice = Math.round(directPrice * 1.05);  // Direct advantage

    if (csvId === 5) {
      bookingPrice = 15615; // verified live
      airbnbPrice = 17043;  // verified live
      agodaPrice = 16200;
      mmtPrice = 16114;
    } else if (i % 3 === 0) {
      // Undercut scenario
      bookingPrice = Math.round(directPrice * 0.92);
      mmtPrice = Math.round(directPrice * 0.94);
    } else if (i % 3 === 1) {
      // Parity match scenario
      bookingPrice = directPrice;
      mmtPrice = directPrice;
      agodaPrice = directPrice;
    } else {
      // Direct advantage scenario
      bookingPrice = Math.round(directPrice * 1.06);
      mmtPrice = Math.round(directPrice * 1.08);
      agodaPrice = Math.round(directPrice * 1.05);
    }

    const otas = [
      { channel: 'AGODA', price: agodaPrice },
      { channel: 'MMT', price: mmtPrice },
      { channel: 'BOOKING', price: bookingPrice },
      { channel: 'AIRBNB', price: airbnbPrice },
    ].sort((a, b) => a.price - b.price);

    const lowestOta = otas[0];
    let parityStatus = 'PARITY_MATCH';
    let marginLeakage = 0;
    let priceDifference = 0;

    if (lowestOta.price < directPrice * 0.98) {
      parityStatus = 'OTA_UNDERCUT';
      marginLeakage = directPrice - lowestOta.price;
      priceDifference = marginLeakage;
      undercutCount++;
      totalLeakage += marginLeakage;
    } else if (lowestOta.price > directPrice * 1.02) {
      parityStatus = 'DIRECT_ADVANTAGE';
      priceDifference = directPrice - lowestOta.price;
      directAdvantageCount++;
    } else {
      parityMatchCount++;
    }

    // Parity Audit record
    await prisma.parityAudit.create({
      data: {
        auditRunId: auditRun.id,
        propertyId: property.id,
        date: today,
        directPrice,
        agodaPrice,
        mmtPrice,
        bookingPrice,
        airbnbPrice,
        lowestOtaChannel: lowestOta.channel,
        lowestOtaPrice: lowestOta.price,
        parityStatus,
        marginLeakage,
        priceDifference,
      },
    });

    // Price Snapshots
    const snapshots = [
      { channel: 'SV', price: directPrice },
      { channel: 'AGODA', price: agodaPrice },
      { channel: 'MMT', price: mmtPrice },
      { channel: 'BOOKING', price: bookingPrice },
      { channel: 'AIRBNB', price: airbnbPrice },
    ];

    for (const s of snapshots) {
      await prisma.priceSnapshot.create({
        data: {
          auditRunId: auditRun.id,
          propertyId: property.id,
          channel: s.channel,
          basePrice: Math.round(s.price * 0.82),
          taxAmount: Math.round(s.price * 0.18),
          finalPrice: s.price,
          currency: 'INR',
          categoryRaw: `${property.categoryNormalized} on ${s.channel}`,
          availability: true,
          scrapeStatus: 'OK',
        },
      });
    }
  }

  // Update AuditRun summary
  await prisma.auditRun.update({
    where: { id: auditRun.id },
    data: {
      undercutCount,
      parityMatchCount,
      directAdvantageCount,
      totalLeakage,
    },
  });

  console.log(`✅ Finished seeding 50 properties! Undercuts: ${undercutCount}, Matches: ${parityMatchCount}, Direct Advantage: ${directAdvantageCount}, Total Leakage: ₹${totalLeakage.toLocaleString('en-IN')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
