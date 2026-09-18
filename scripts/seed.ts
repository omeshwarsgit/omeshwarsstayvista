import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

function parsePropertyDetails(name: string, svUrl: string, agodaUrl: string) {
  const text = (name + ' ' + svUrl + ' ' + agodaUrl).toLowerCase();

  // 1. BHK / Bedroom Extraction
  let bhk = 3; // default median
  const bhkMatch =
    text.match(/(\d+)\s*bhk/) ||
    text.match(/(\d+)-bhk/) ||
    text.match(/(\d+)\s*bedroom/) ||
    text.match(/(\d+)\s*bed/);

  if (bhkMatch) {
    bhk = parseInt(bhkMatch[1], 10);
  } else if (text.includes('mansion') || text.includes('manor')) {
    bhk = 8;
  } else if (text.includes('estate') || text.includes('grand')) {
    bhk = 5;
  } else if (text.includes('dorms') || text.includes('room')) {
    bhk = 1;
  }

  // Cap BHK reasonably between 1 and 12
  bhk = Math.max(1, Math.min(12, bhk));

  // 2. Destination Location Parsing
  let loc = 'Outskirts & Hills';
  if (text.includes('lonavala') || text.includes('lonavla')) loc = 'Lonavala';
  else if (text.includes('karjat')) loc = 'Karjat';
  else if (text.includes('alibaug') || text.includes('alibag') || text.includes('zirad')) loc = 'Alibaug';
  else if (text.includes('goa') || text.includes('morjim') || text.includes('candolim') || text.includes('porvorim')) loc = 'Goa';
  else if (text.includes('nashik') || text.includes('nasik')) loc = 'Nashik';
  else if (text.includes('manali')) loc = 'Manali';
  else if (text.includes('shimla') || text.includes('mashobra')) loc = 'Shimla';
  else if (text.includes('ooty')) loc = 'Ooty';
  else if (text.includes('coorg')) loc = 'Coorg';
  else if (text.includes('nainital') || text.includes('mukteshwar') || text.includes('bhimtal')) loc = 'Nainital';
  else if (text.includes('kasauli')) loc = 'Kasauli';
  else if (text.includes('panchgani') || text.includes('mahabaleshwar')) loc = 'Panchgani';
  else if (text.includes('mumbai') || text.includes('wada') || text.includes('vikramgad')) loc = 'Mumbai Outskirts';
  else if (text.includes('udaipur') || text.includes('jaipur')) loc = 'Rajasthan';

  // 3. Normalized Category Parsing
  let categoryNormalized = 'Villa';
  if (text.includes('bungalow')) categoryNormalized = 'Bungalow';
  else if (text.includes('cottage')) categoryNormalized = 'Cottage';
  else if (text.includes('chalet')) categoryNormalized = 'Chalet';
  else if (text.includes('mansion') || text.includes('manor')) categoryNormalized = 'Mansion';
  else if (text.includes('homestay') || text.includes('farm')) categoryNormalized = 'Homestay';
  else if (text.includes('estate') || text.includes('house')) categoryNormalized = 'Independent House';

  // 4. Mathematical Base Rate Tier Engine
  let baseRate = 21000;
  if (bhk === 1) baseRate = 7500;
  else if (bhk === 2) baseRate = 14000;
  else if (bhk === 3) baseRate = 21000;
  else if (bhk === 4) baseRate = 28000;
  else if (bhk === 5) baseRate = 36000;
  else if (bhk === 6) baseRate = 45000;
  else baseRate = 45000 + (bhk - 6) * 9000;

  // Location Premium Multipliers
  let locMultiplier = 1.0;
  if (loc === 'Goa' || loc === 'Alibaug') locMultiplier = 1.25;
  else if (loc === 'Lonavala' || loc === 'Manali' || loc === 'Kasauli') locMultiplier = 1.15;
  else if (loc === 'Shimla' || loc === 'Ooty' || loc === 'Coorg' || loc === 'Nainital') locMultiplier = 1.1;

  let directPrice = Math.round(baseRate * locMultiplier);

  // Amenity Additions
  if (text.includes('pool')) directPrice += 3500;
  if (categoryNormalized === 'Mansion') directPrice += 6000;

  // Round to nearest clean 100
  directPrice = Math.round(directPrice / 100) * 100;

  return {
    bhk,
    location: loc,
    categoryNormalized,
    directPrice,
    rawAgoda: `${categoryNormalized} by Vista`,
    rawAirbnb: `Entire ${categoryNormalized.toLowerCase()}`,
    rawBooking: `Private ${categoryNormalized.toLowerCase()}`,
    rawMmt: `StayVista Premium ${categoryNormalized}`,
  };
}

async function main() {
  console.log('🌱 Starting Mathematically Accurate StayVista Rate Parity database seed...');

  const csvFilePath = path.join(process.cwd(), 'DOC-20260916-WA0006.csv');
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Loaded ${records.length} total rows from CSV.`);

  // Filter ONLY rows where all 8 required fields are present, non-empty, and not #REF!
  const validRecords = records.filter((r: any) => {
    const id = (r['ID'] || '').trim();
    const primaryId = (r['Primary_Property_ID'] || '').trim();
    const name = (r['Property_Name'] || '').trim();
    const sv = (r['SV'] || '').trim();
    const agoda = (r['Agoda'] || '').trim();
    const mmt = (r['MMT'] || '').trim();
    const booking = (r['Booking'] || '').trim();
    const airbnb = (r['Airbnb'] || '').trim();

    return (
      id !== '' &&
      primaryId !== '' &&
      name !== '' &&
      sv !== '' &&
      sv !== '#REF!' &&
      agoda !== '' &&
      agoda !== '#REF!' &&
      mmt !== '' &&
      mmt !== '#REF!' &&
      booking !== '' &&
      booking !== '#REF!' &&
      airbnb !== '' &&
      airbnb !== '#REF!'
    );
  });

  console.log(`✅ Filtered to ${validRecords.length} complete valid property records.`);

  // Clean existing tables
  await prisma.parityAudit.deleteMany();
  await prisma.priceSnapshot.deleteMany();
  await prisma.auditRun.deleteMany();
  await prisma.channelLink.deleteMany();
  await prisma.property.deleteMany();

  console.log('🧹 Cleaned existing database tables.');

  let insertedCount = 0;
  const createdProperties = [];

  for (const r of validRecords) {
    const csvId = parseInt(r['ID'], 10);
    const primaryPropertyId = parseInt(r['Primary_Property_ID'], 10);
    const name = r['Property_Name'].trim();
    const svUrl = r['SV'].trim();
    const agodaUrl = r['Agoda'].trim();
    const mmtUrl = r['MMT'].trim();
    const bookingUrl = r['Booking'].trim();
    const airbnbUrl = r['Airbnb'].trim();

    const meta = parsePropertyDetails(name, svUrl, agodaUrl);

    // Add deterministic micro-variation per property based on CSV ID
    const basePrice = meta.directPrice + (csvId % 5) * 300;

    const property = await prisma.property.create({
      data: {
        csvId,
        primaryPropertyId,
        name,
        location: meta.location,
        categoryNormalized: meta.categoryNormalized,
        basePrice,
        channelLinks: {
          create: [
            { channel: 'SV', url: svUrl },
            { channel: 'AGODA', url: agodaUrl },
            { channel: 'MMT', url: mmtUrl },
            { channel: 'BOOKING', url: bookingUrl },
            { channel: 'AIRBNB', url: airbnbUrl },
          ],
        },
      },
    });

    createdProperties.push({ property, meta });
    insertedCount++;
  }

  console.log(`🎉 Imported ${insertedCount} properties into SQLite database!`);

  // Seed baseline audit runs for calendar visualization (7 dates: today + next 6 days)
  const today = new Date();
  const dateStrings = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }

  console.log(`📅 Seeding historical audit runs for dates: ${dateStrings.join(', ')}`);

  for (let dateIdx = 0; dateIdx < dateStrings.length; dateIdx++) {
    const checkInDate = dateStrings[dateIdx];
    const nextDay = new Date(checkInDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const checkOutDate = nextDay.toISOString().split('T')[0];

    let totalLeakage = 0;
    let undercutCount = 0;
    let parityMatchCount = 0;
    let directAdvantageCount = 0;

    const auditRun = await prisma.auditRun.create({
      data: {
        status: 'COMPLETED',
        triggeredBy: dateIdx === 0 ? 'AUTOMATED_CRON' : 'SCHEDULED',
        checkInDate,
        checkOutDate,
        totalAudited: createdProperties.length,
      },
    });

    for (const { property, meta } of createdProperties) {
      const directPrice = property.basePrice;

      // Deterministic pricing formula per property and date
      const hash = (property.csvId * 37 + dateIdx * 19) % 100;

      let agodaPrice = directPrice;
      let mmtPrice = directPrice;
      let bookingPrice = directPrice;
      let airbnbPrice = Math.round(directPrice * 1.12 + 2500); // Airbnb guest fee + cleaning charge

      if (hash < 38) {
        // OTA Undercut on Agoda or MMT (discount coupon applied by OTA)
        if (hash % 2 === 0) {
          agodaPrice = Math.round(directPrice * 0.88); // 12% undercut
          mmtPrice = Math.round(directPrice * 0.92);
        } else {
          mmtPrice = Math.round(directPrice * 0.86); // 14% undercut
          agodaPrice = directPrice;
        }
        bookingPrice = Math.round(directPrice * 0.94);
      } else if (hash > 82) {
        // Direct Advantage (StayVista member rate is lower than OTAs)
        agodaPrice = Math.round(directPrice * 1.08);
        mmtPrice = Math.round(directPrice * 1.10);
        bookingPrice = Math.round(directPrice * 1.06);
      }

      const otaPrices = [
        { channel: 'AGODA', price: agodaPrice },
        { channel: 'MMT', price: mmtPrice },
        { channel: 'BOOKING', price: bookingPrice },
        { channel: 'AIRBNB', price: airbnbPrice },
      ];

      otaPrices.sort((a, b) => a.price - b.price);
      const lowestOta = otaPrices[0];

      let parityStatus = 'PARITY_MATCH';
      let marginLeakage = 0;
      let priceDifference = 0;

      if (lowestOta.price < directPrice - 100) {
        parityStatus = 'OTA_UNDERCUT';
        marginLeakage = directPrice - lowestOta.price;
        priceDifference = marginLeakage;
        undercutCount++;
        totalLeakage += marginLeakage;
      } else if (lowestOta.price > directPrice + 100) {
        parityStatus = 'DIRECT_ADVANTAGE';
        priceDifference = directPrice - lowestOta.price;
        directAdvantageCount++;
      } else {
        parityMatchCount++;
      }

      // Create Price Snapshots (Itemized Base + 18% GST + Fees)
      const snapshots = [
        { channel: 'SV', price: directPrice, categoryRaw: 'StayVista Direct' },
        { channel: 'AGODA', price: agodaPrice, categoryRaw: meta.rawAgoda },
        { channel: 'MMT', price: mmtPrice, categoryRaw: meta.rawMmt },
        { channel: 'BOOKING', price: bookingPrice, categoryRaw: meta.rawBooking },
        { channel: 'AIRBNB', price: airbnbPrice, categoryRaw: meta.rawAirbnb },
      ];

      for (const s of snapshots) {
        const base = Math.round(s.price / 1.18);
        const tax = s.price - base;

        await prisma.priceSnapshot.create({
          data: {
            auditRunId: auditRun.id,
            propertyId: property.id,
            channel: s.channel,
            basePrice: base,
            taxAmount: tax,
            cleaningFee: s.channel === 'AIRBNB' ? 2500 : 0,
            serviceFee: s.channel === 'AIRBNB' ? Math.round(s.price * 0.142) : 0,
            finalPrice: s.price,
            categoryRaw: s.categoryRaw,
          },
        });
      }

      // Create ParityAudit record
      await prisma.parityAudit.create({
        data: {
          auditRunId: auditRun.id,
          propertyId: property.id,
          date: checkInDate,
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
          statusChanged: dateIdx > 0 && hash % 4 === 0,
          previousStatus: dateIdx > 0 ? 'PARITY_MATCH' : null,
        },
      });
    }

    await prisma.auditRun.update({
      where: { id: auditRun.id },
      data: {
        completedAt: new Date(),
        undercutCount,
        parityMatchCount,
        directAdvantageCount,
        totalLeakage,
      },
    });

    console.log(
      `  - Date ${checkInDate}: Audit Run complete (${undercutCount} undercuts, ${parityMatchCount} parity matches, ₹${totalLeakage.toLocaleString('en-IN')} leakage)`
    );
  }

  console.log('✨ Seed completed successfully with realistic prices!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
