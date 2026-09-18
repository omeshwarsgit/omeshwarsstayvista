import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || '2026-09-16';

  try {
    const auditRun = await prisma.auditRun.findFirst({
      where: { checkInDate: date },
      orderBy: { startedAt: 'desc' },
    }) || await prisma.auditRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    if (!auditRun) {
      return new NextResponse('No data found to export', { status: 404 });
    }

    const audits = await prisma.parityAudit.findMany({
      where: { auditRunId: auditRun.id },
      include: {
        property: {
          include: { channelLinks: true },
        },
      },
      orderBy: { marginLeakage: 'desc' },
    });

    const headers = [
      'CSV_ID',
      'Property_Name',
      'Location',
      'Category',
      'CheckIn_Date',
      'StayVista_Direct_Price',
      'Agoda_Price',
      'MMT_Price',
      'Booking_Price',
      'Airbnb_Price',
      'Lowest_OTA_Channel',
      'Lowest_OTA_Price',
      'Parity_Status',
      'Margin_Leakage_INR',
      'StayVista_URL',
      'Agoda_URL',
      'MMT_URL',
      'Booking_URL',
      'Airbnb_URL',
    ];

    const csvRows = [headers.join(',')];

    for (const a of audits) {
      const linksMap: Record<string, string> = {};
      a.property.channelLinks.forEach((l) => {
        linksMap[l.channel] = l.url;
      });

      const row = [
        a.property.csvId,
        `"${a.property.name.replace(/"/g, '""')}"`,
        `"${a.property.location.replace(/"/g, '""')}"`,
        `"${a.property.categoryNormalized}"`,
        a.date,
        a.directPrice,
        a.agodaPrice,
        a.mmtPrice,
        a.bookingPrice,
        a.airbnbPrice,
        a.lowestOtaChannel,
        a.lowestOtaPrice,
        a.parityStatus,
        a.marginLeakage,
        `"${linksMap['SV'] || ''}"`,
        `"${linksMap['AGODA'] || ''}"`,
        `"${linksMap['MMT'] || ''}"`,
        `"${linksMap['BOOKING'] || ''}"`,
        `"${linksMap['AIRBNB'] || ''}"`,
      ];

      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="StayVista_Rate_Parity_${date}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
