import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

function futureDateMMDDYYYY(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}${dd}${yyyy}`;
}

// Repairs known malformed patterns found in the source CSV:
// - MMT: a tracking param gets fused directly onto a second, incomplete MMT url
// - Agoda: a doubled /en-in/en-in/ locale segment
function repairUrl(channel: string, raw: string): string {
  let url = raw.trim();
  if (channel === 'MMT') {
    const marker = 'https://www.makemytrip.com';
    const firstIdx = url.indexOf(marker);
    if (firstIdx !== -1) {
      const secondIdx = url.indexOf(marker, firstIdx + marker.length);
      if (secondIdx !== -1) url = url.slice(0, secondIdx);
    }
    const checkin = futureDateMMDDYYYY(7);
    const checkout = futureDateMMDDYYYY(8);
    url = url.replace(/checkin=\d+/, `checkin=${checkin}`).replace(/checkout=\d+/, `checkout=${checkout}`);
  } else if (channel === 'AGODA') {
    url = url.replace('/en-in/en-in/', '/en-in/');
  }
  return url;
}

// Pulls the identifying slug/id out of a (repaired) url so we can tell whether
// the final url after redirects still points at the same listing.
function extractKey(channel: string, url: string): string | null {
  try {
    if (channel === 'SV') return url.match(/\/villa\/([^/?#]+)/)?.[1] ?? null;
    if (channel === 'AGODA') return url.match(/\/en-in\/([^/?#]+)\/hotel\//)?.[1] ?? null;
    if (channel === 'MMT') return url.match(/hotelId=(\d+)/)?.[1] ?? null;
    if (channel === 'BOOKING') return url.match(/\/hotel\/in\/([^/?#]+)\.html/)?.[1] ?? null;
    if (channel === 'AIRBNB') return url.match(/\/rooms\/(\d+)/)?.[1] ?? null;
  } catch {}
  return null;
}

type CheckResult = {
  status: 'VALID' | 'REDIRECTED' | 'BROKEN' | 'UNREACHABLE';
  finalUrl: string | null;
  repaired: string;
  httpStatus?: number;
  error?: string;
};

async function checkOne(channel: string, rawUrl: string): Promise<CheckResult> {
  const repaired = repairUrl(channel, rawUrl);
  const key = extractKey(channel, repaired);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(repaired, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    clearTimeout(timer);
    const finalUrl = res.url || repaired;
    if (res.status >= 400) return { status: 'BROKEN', finalUrl, repaired, httpStatus: res.status };
    if (key && finalUrl.toLowerCase().includes(key.toLowerCase()))
      return { status: 'VALID', finalUrl, repaired, httpStatus: res.status };
    return { status: 'REDIRECTED', finalUrl, repaired, httpStatus: res.status };
  } catch (err: any) {
    clearTimeout(timer);
    return { status: 'UNREACHABLE', finalUrl: null, repaired, error: err?.message ?? String(err) };
  }
}

async function runPool<T, R>(items: T[], worker: (item: T) => Promise<R>, limit: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  const properties = await prisma.property.findMany({
    include: { channelLinks: true },
    ...(limit ? { take: limit } : {}),
    orderBy: { csvId: 'asc' },
  });

  console.log(`Validating links for ${properties.length} properties (${properties.length * 5} links, concurrency ${CONCURRENCY})...`);

  const tasks: { linkId: string; channel: string; url: string }[] = [];
  for (const p of properties) for (const link of p.channelLinks) tasks.push({ linkId: link.id, channel: link.channel, url: link.url });

  const summary: Record<string, Record<string, number>> = {};
  const needsAttention: { channel: string; url: string; status: string }[] = [];

  await runPool(
    tasks,
    async (t) => {
      const r = await checkOne(t.channel, t.url);
      await prisma.channelLink.update({
        where: { id: t.linkId },
        data: {
          linkStatus: r.status,
          repairedUrl: r.repaired !== t.url ? r.repaired : null,
          lastValidatedAt: new Date(),
        },
      });
      summary[t.channel] = summary[t.channel] || {};
      summary[t.channel][r.status] = (summary[t.channel][r.status] || 0) + 1;
      if (r.status === 'BROKEN' || r.status === 'UNREACHABLE') needsAttention.push({ channel: t.channel, url: t.url, status: r.status });
      return r;
    },
    CONCURRENCY
  );

  console.log('\n=== Link validation summary ===');
  for (const [channel, statuses] of Object.entries(summary)) console.log(channel, statuses);
  console.log(`\n${needsAttention.length} links need manual attention (BROKEN/UNREACHABLE).`);
  if (needsAttention.length) console.log(needsAttention.slice(0, 20));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
