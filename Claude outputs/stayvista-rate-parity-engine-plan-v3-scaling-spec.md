# StayVista Rate Parity Engine — v3: Scaling to All Properties (API + Scraper + Parity Logic Spec)

Grounded in the actual codebase at `StayVistaScrapper` (Next.js 15 + Prisma + SQLite). Current state: schema and dashboard UI are built, but `/api/audit/run` is 100% simulated (`Math.random()`), no scraping library is installed, and roughly 83% of MMT links and 13% of Agoda links in the source CSV are malformed. This spec covers what's needed to make it real and run it across the full multi-branch portfolio (all locations already tracked: Lonavala, Karjat, Alibaug, Goa, Nashik, Manali, Shimla, Ooty, Coorg, Nainital, Kasauli, Panchgani, Mumbai Outskirts, Rajasthan, and others).

---

## 1. Schema additions needed

Add to `prisma/schema.prisma`:

- `ChannelLink.linkStatus` (String: `UNCHECKED | VALID | REDIRECTED | BROKEN | UNREACHABLE`) and `ChannelLink.lastValidatedAt` (DateTime?) — a link must be validated before its price is trusted.
- `ChannelLink.repairedUrl` (String?) — holds an auto-corrected URL when the raw CSV link was malformed, without destroying the original for audit trail.
- `AuditRun.mode` (String: `FULL | INCREMENTAL`), `AuditRun.processedCount` (Int, default 0) — needed once runs are long and asynchronous (see §3).
- `PriceSnapshot.scrapeStatus` (String: `OK | BLOCKED | REDIRECTED | PARSE_ERROR | TIMEOUT`) — so a missing/bad scrape is recorded explicitly instead of silently defaulting to 0 or a stale value.

---

## 2. New/updated API routes

- **`POST /api/links/validate`** (new) — for a batch of properties (or all 1,187+), checks each channel URL: does it resolve, does the final URL after redirects still match the expected property (hotel ID / slug), or did it land on a generic search/homepage. Writes `linkStatus` + `repairedUrl` back to `ChannelLink`. Run this once up front and periodically after — an audit against a broken link is worse than useless, it's actively misleading.
- **`POST /api/audit/run`** (rewrite existing) — no longer computes prices inline. It creates the `AuditRun` row, kicks off the scraper job asynchronously (see §3), and returns immediately with `{ runId }` instead of blocking the HTTP request for however long ~5,900+ page loads take.
- **`GET /api/audit/status/[runId]`** (new) — polling endpoint: returns `processedCount`, per-channel OK/blocked/error counts, and whether the run is still `RUNNING`. Powers a live progress panel on the dashboard (doesn't exist yet — worth adding as `ScraperStatusPanel.tsx`).
- **`POST /api/audit/cancel/[runId]`** (new, optional) — stop a run early if something's clearly wrong (e.g., one channel is 100% blocked).
- **`POST /api/properties/sync`** (new) — re-imports/upserts from an updated master CSV as StayVista adds or delists properties across branches, without wiping historical snapshots (unlike the current one-shot `seed.ts`).
- **`POST /api/scraper/test`** (new, dev-only) — runs all 5 channel scrapers for a single property synchronously, for quick debugging when a selector breaks on one site.

---

## 3. Scraping logic

**Why not inline in the API route:** Playwright driving ~1,187 properties × 5 channels per full run is a multi-hour local batch job, not something an HTTP request/response cycle should hold open. Run it as a background job triggered by the API route (a detached async function is enough at local, single-user scale — no need for Redis/BullMQ), with the route returning a `runId` immediately and the job updating `AuditRun`/`PriceSnapshot` rows as it goes, so the UI polls progress rather than waiting on one giant request.

**Per-channel approach:**

- **StayVista (direct):** Try the fast path first — fetch the page HTML directly (no browser needed) and parse the `__NEXT_DATA__` script tag, the same way your earlier Cleartrip-parity work already reverse-engineered `stayvista.com/villa/<slug>` (`props.pageProps.propertyDetailsObj.data`). If price isn't in that initial payload, check whether it's fetched client-side via a follow-up API call (like the gallery data was, via `v3api.stayvista.com/api/property/<id>/...`) and call that directly — much faster and more reliable than rendering a browser for your own site.
- **Agoda / Booking.com / MMT / Airbnb:** These need Playwright (headless Chromium) since price is rendered client-side and each site's DOM differs — one scraper module per channel. For each: navigate to the (validated/repaired) URL with a freshly-generated date range appended as query params (e.g. "next Saturday, 1 night, 2 guests" — never a hardcoded past date like the current CSV has), wait for the price element, extract price + currency + the category label the site displays for that listing.
- **Redirect/failure detection:** after navigation, compare the final `page.url()` (and/or page title) against the expected hotel ID or slug. If it doesn't match, the site redirected to a generic search or homepage — record `scrapeStatus: REDIRECTED`, don't parse a price off the wrong page. Similarly catch CAPTCHA/block pages (`BLOCKED`) and timeouts (`TIMEOUT`) explicitly.
- **Pacing:** cap concurrency per domain (2–3 parallel browser contexts), randomize delays (2–5s) between requests to the same channel, and retry once on transient failure before giving up. At ~6,000 page loads, this is a multi-hour job even paced conservatively — expect a full run to take a while, and prefer running it overnight or incrementally (a subset of properties per day) over trying to force it through in one sitting.

**Link repair logic** (used by `/api/links/validate`):
- MMT: your CSV rows have a real `hotelId` fused with a second incomplete URL (`...defaultMtkey1000225027https://www.makemytrip.com/hotels/hotel-details/?hotelId=`). Extract the numeric ID with a regex on the *first* `hotelId=(\d+)` match, discard everything after, and rebuild a clean URL with fresh dates.
- Agoda: collapse a doubled locale path (`/en-in/en-in/`) down to `/en-in/`.
- Any channel: if the repaired URL still 404s or redirects away, mark `BROKEN` and surface it on the dashboard as "needs manual link" rather than guessing further — some properties may genuinely be delisted from a channel.

---

## 4. Parity engine logic

For each property, per audit run, per channel: take the all-in price a guest would actually pay (base + tax + fees — not just the base rate), since that's what "parity" means to a real customer comparing across channels.

- Only include channels with `scrapeStatus: OK` in the comparison. A `BLOCKED`/`REDIRECTED`/`TIMEOUT` channel must never fall back to 0 or be silently treated as a valid price — that would falsely flag every property as a massive undercut. If fewer than 4 of the 5 channels succeeded, mark the audit `PARTIAL` for that property so it's visually distinct from a fully-confirmed result.
- Find the lowest successfully-scraped OTA price (`lowestOtaChannel`/`lowestOtaPrice` — schema already has these fields).
- Compare direct price vs. lowest OTA price using a **percentage band, not a flat rupee amount** (the current code's flat ±₹100 doesn't scale — ₹100 is meaningless on a ₹100,000 mansion and too tight on a ₹7,500 studio). Recommend: within ±2% → `PARITY_MATCH`; OTA lower by more than 2% → `OTA_UNDERCUT` (margin leakage = direct − lowest OTA); OTA higher by more than 2% → `DIRECT_ADVANTAGE`. Make the 2% a configurable constant, not hardcoded, so you can tune it once you see real data.
- `statusChanged`/`previousStatus`: look up the property's most recent prior `ParityAudit` (before this run) and compare status — this is what lets the dashboard show "changed since last audit" instead of re-reviewing everything each time.
- Roll portfolio-wide stats (total leakage, undercut count, parity-match rate) up by category (already scaffolded) and, worth adding, by **region/cluster** (Western Maharashtra: Lonavala/Karjat; Goa; North: Manali/Shimla/Kasauli/Nainital; South: Ooty/Coorg; Rajasthan) so you can see which branch clusters have the worst leakage, not just which individual properties.

---

## 5. Rollout order for going from pilot to all properties

- Run `/api/links/validate` across the full portfolio first — this alone tells you how many properties are even auditable today per channel, before any scraping happens.
- Pilot the real scraper on 10–20 properties with known-good links, manually spot-check against the live sites.
- Expand to one full region/cluster (e.g. all Lonavala + Karjat properties) to catch scale issues (rate-limiting, selector edge cases) before going pan-India.
- Only then run the full portfolio, and prefer a scheduled incremental mode (e.g. 200–300 properties/night) over one giant nightly run, both to stay under the radar of anti-bot systems and to keep a single run's runtime manageable.
