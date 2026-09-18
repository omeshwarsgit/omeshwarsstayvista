import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeStayVistaDirect } from '@/lib/scrapers/stayvistaScraper';
import { scrapeAgoda, scrapeMakeMyTrip, scrapeBooking, scrapeAirbnb } from '@/lib/scrapers/otaScrapers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const propertyId = body.propertyId;
    const csvId = body.csvId ? parseInt(body.csvId, 10) : undefined;
    const checkInDate = body.checkInDate || '2026-10-10';
    const checkOutDate = body.checkOutDate || '2026-10-11';
    const channelsToTest: string[] = body.channels || ['SV', 'AGODA', 'MMT', 'BOOKING', 'AIRBNB'];

    let property = null;
    if (propertyId) {
      property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: { channelLinks: true },
      });
    } else if (csvId) {
      property = await prisma.property.findUnique({
        where: { csvId },
        include: { channelLinks: true },
      });
    } else {
      // Pick first property
      property = await prisma.property.findFirst({
        include: { channelLinks: true },
      });
    }

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const linksMap: Record<string, string> = {};
    for (const l of property.channelLinks) {
      linksMap[l.channel] = l.repairedUrl || l.url;
    }

    const results: Record<string, any> = {};

    // 1. StayVista Direct Fast Path
    if (channelsToTest.includes('SV')) {
      results['SV'] = await scrapeStayVistaDirect(
        property.primaryPropertyId,
        checkInDate,
        checkOutDate,
        linksMap['SV']
      );
    }

    // 2. Agoda
    if (channelsToTest.includes('AGODA') && linksMap['AGODA']) {
      results['AGODA'] = await scrapeAgoda(linksMap['AGODA'], checkInDate, checkOutDate);
    }

    // 3. MakeMyTrip
    if (channelsToTest.includes('MMT') && linksMap['MMT']) {
      results['MMT'] = await scrapeMakeMyTrip(linksMap['MMT'], checkInDate, checkOutDate);
    }

    // 4. Booking.com
    if (channelsToTest.includes('BOOKING') && linksMap['BOOKING']) {
      results['BOOKING'] = await scrapeBooking(linksMap['BOOKING'], checkInDate, checkOutDate);
    }

    // 5. Airbnb
    if (channelsToTest.includes('AIRBNB') && linksMap['AIRBNB']) {
      results['AIRBNB'] = await scrapeAirbnb(linksMap['AIRBNB'], checkInDate, checkOutDate);
    }

    return NextResponse.json({
      property: {
        id: property.id,
        csvId: property.csvId,
        name: property.name,
        location: property.location,
        checkInDate,
        checkOutDate,
      },
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Scraper test failed' }, { status: 500 });
  }
}
