import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { repairChannelUrl } from '@/lib/linkRepair';

export const dynamic = 'force-dynamic';

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

  let categoryNormalized = 'Villa';
  if (text.includes('bungalow')) categoryNormalized = 'Bungalow';
  else if (text.includes('cottage')) categoryNormalized = 'Cottage';
  else if (text.includes('chalet')) categoryNormalized = 'Chalet';
  else if (text.includes('mansion') || text.includes('manor')) categoryNormalized = 'Mansion';
  else if (text.includes('homestay') || text.includes('farm')) categoryNormalized = 'Homestay';
  else if (text.includes('estate') || text.includes('house')) categoryNormalized = 'Independent House';

  let baseRate = 21000;
  if (bhk === 1) baseRate = 7500;
  else if (bhk === 2) baseRate = 14000;
  else if (bhk === 3) baseRate = 21000;
  else if (bhk === 4) baseRate = 28000;
  else if (bhk === 5) baseRate = 36000;
  else if (bhk === 6) baseRate = 45000;
  else baseRate = 45000 + (bhk - 6) * 9000;

  let locMultiplier = 1.0;
  if (loc === 'Goa' || loc === 'Alibaug') locMultiplier = 1.25;
  else if (loc === 'Lonavala' || loc === 'Manali' || loc === 'Kasauli') locMultiplier = 1.15;
  else if (loc === 'Shimla' || loc === 'Ooty' || loc === 'Coorg' || loc === 'Nainital') locMultiplier = 1.1;

  let directPrice = Math.round(baseRate * locMultiplier);
  if (text.includes('pool')) directPrice += 3500;
  if (categoryNormalized === 'Mansion') directPrice += 6000;
  directPrice = Math.round(directPrice / 100) * 100;

  return { bhk, location: loc, categoryNormalized, directPrice };
}

export async function POST() {
  try {
    const csvPath = path.join(process.cwd(), 'DOC-20260916-WA0006.csv');
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'Source CSV not found' }, { status: 404 });
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });

    let syncedCount = 0;
    const seenIds = new Set<number>();

    for (const row of records) {
      const idRaw = row['ID '] || row['ID'];
      const name = (row['Property_Name'] || '').trim();
      if (!idRaw || !name) continue;

      const csvId = parseInt(idRaw.trim(), 10);
      if (isNaN(csvId) || seenIds.has(csvId)) continue;
      seenIds.add(csvId);

      const primaryIdRaw = row['Primary_Property_ID '] || row['Primary_Property_ID'];
      const primaryPropertyId = primaryIdRaw ? parseInt(primaryIdRaw.trim(), 10) : csvId;

      const svUrl = (row['SV '] || row['SV'] || '').trim();
      const agodaUrl = (row['Agoda'] || '').trim();
      const mmtUrl = (row['MMT '] || row['MMT'] || '').trim();
      const bookingUrl = (row['Booking '] || row['Booking'] || '').trim();
      const airbnbUrl = (row['Airbnb'] || '').trim();

      const meta = parsePropertyMetadata(name, svUrl, agodaUrl);

      // Upsert Property without wiping existing data
      const prop = await prisma.property.upsert({
        where: { csvId },
        create: {
          csvId,
          primaryPropertyId,
          name,
          location: meta.location,
          categoryNormalized: meta.categoryNormalized,
          basePrice: meta.directPrice,
        },
        update: {
          primaryPropertyId,
          name,
          location: meta.location,
          categoryNormalized: meta.categoryNormalized,
        },
      });

      // Upsert Links
      const channels = [
        { channel: 'SV', url: svUrl },
        { channel: 'AGODA', url: agodaUrl },
        { channel: 'MMT', url: mmtUrl },
        { channel: 'BOOKING', url: bookingUrl },
        { channel: 'AIRBNB', url: airbnbUrl },
      ];

      for (const ch of channels) {
        if (!ch.url) continue;
        const repair = repairChannelUrl(ch.channel, ch.url);

        const existingLink = await prisma.channelLink.findFirst({
          where: { propertyId: prop.id, channel: ch.channel },
        });

        if (existingLink) {
          await prisma.channelLink.update({
            where: { id: existingLink.id },
            data: {
              url: ch.url,
              repairedUrl: repair.repairedUrl,
            },
          });
        } else {
          await prisma.channelLink.create({
            data: {
              propertyId: prop.id,
              channel: ch.channel,
              url: ch.url,
              repairedUrl: repair.repairedUrl,
              linkStatus: 'UNCHECKED',
            },
          });
        }
      }

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${syncedCount} properties from master CSV.`,
      syncedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
