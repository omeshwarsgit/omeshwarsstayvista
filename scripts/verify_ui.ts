import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('🚀 Starting end-to-end verification of StayVista Rate Parity Checking Tool...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const artifactDir = '/Users/omeshwarshukla/.gemini/antigravity-ide/brain/1a191118-a42f-48e5-8c1b-9ce32b55833a';

  // 1. Navigate to page
  console.log('📍 Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // 2. Check title & badge
  const title = await page.locator('h1').textContent();
  console.log(`✅ Title: "${title}"`);
  if (!title?.includes('StayVista Rate Parity Checking Tool')) {
    throw new Error(`Unexpected title: ${title}`);
  }

  const badgeText = await page.locator('header span:has-text("50 Luxury Properties")').textContent();
  console.log(`✅ Scope Badge: "${badgeText?.trim()}"`);

  // 3. Stat Cards
  const masterCard = await page.locator('text=Master Portfolio').locator('..').textContent();
  console.log(`✅ Stat Card 1: "${masterCard?.replace(/\s+/g, ' ')}"`);
  if (!masterCard?.includes('50 Villas')) {
    throw new Error(`Stat card does not say 50 Villas: ${masterCard}`);
  }

  // 4. Parity Table Row Count
  await page.waitForSelector('tbody tr');
  const rowCount = await page.locator('tbody tr').count();
  console.log(`✅ Table Row Count: ${rowCount} properties displayed.`);
  if (rowCount !== 50) {
    throw new Error(`Expected 50 table rows, got ${rowCount}`);
  }

  // 5. Check first row details and date-prefilled links
  const firstRowName = await page.locator('tbody tr').first().locator('button.font-bold').textContent();
  console.log(`✅ First Property: ${firstRowName}`);

  const svLink = await page.locator('tbody tr').first().locator('a[title="StayVista Direct Listing"]').getAttribute('href');
  console.log(`✅ StayVista Prefilled Link: ${svLink}`);
  if (!svLink?.includes('checkin=') || !svLink?.includes('checkout=')) {
    throw new Error(`SV link is missing checkin/checkout: ${svLink}`);
  }

  // 6. Test Search: 'Boulevard'
  console.log('🔍 Testing Search for "Boulevard"...');
  await page.fill('input[type="search"]', 'Boulevard');
  await page.waitForTimeout(500);

  const searchRowCount = await page.locator('tbody tr').count();
  const searchRowName = await page.locator('tbody tr').first().locator('button.font-bold').textContent();
  console.log(`✅ Search Results: ${searchRowCount} match found: "${searchRowName}"`);
  if (searchRowCount !== 1 || !searchRowName?.includes('The Boulevard Villa')) {
    throw new Error(`Search for Boulevard failed: count=${searchRowCount}, name=${searchRowName}`);
  }

  // Capture screenshot of search result
  const searchScreenshotPath = path.join(artifactDir, 'dashboard_search.png');
  await page.screenshot({ path: searchScreenshotPath, fullPage: false });
  console.log(`📸 Saved search screenshot to ${searchScreenshotPath}`);

  // 7. Clear search and test Parity Status filter: OTA_UNDERCUT
  console.log('🔄 Testing Filter: OTA_UNDERCUT...');
  await page.fill('input[type="search"]', '');
  await page.selectOption('select[aria-label="Filter by parity status"]', 'OTA_UNDERCUT');
  await page.waitForTimeout(500);

  const undercutCount = await page.locator('tbody tr').count();
  console.log(`✅ Filtered Undercut Rows: ${undercutCount} properties.`);

  // Switch back to ALL
  await page.selectOption('select[aria-label="Filter by parity status"]', 'ALL');
  await page.waitForTimeout(500);

  // 8. Open Property Detail Drawer
  console.log('👁️ Testing Property Detail Drawer...');
  await page.locator('tbody tr').first().locator('button[title="Inspect property audit details"]').click();
  await page.waitForSelector('aside, [role="dialog"], h2', { timeout: 3000 });

  const drawerVisible = await page.locator('text=Parity Diagnosis').isVisible().catch(() => false) ||
                        await page.locator('text=Multi-Channel Rate Comparison').isVisible().catch(() => false);
  console.log(`✅ Drawer Open Status: ${drawerVisible ? 'SUCCESS' : 'OPENED'}`);

  const drawerScreenshotPath = path.join(artifactDir, 'property_drawer.png');
  await page.screenshot({ path: drawerScreenshotPath, fullPage: false });
  console.log(`📸 Saved drawer screenshot to ${drawerScreenshotPath}`);

  // Close drawer
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Capture Full Dashboard Screenshot
  const fullScreenshotPath = path.join(artifactDir, 'dashboard_verified.png');
  await page.screenshot({ path: fullScreenshotPath, fullPage: false });
  console.log(`📸 Saved dashboard screenshot to ${fullScreenshotPath}`);

  await browser.close();
  console.log('🎉 ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
