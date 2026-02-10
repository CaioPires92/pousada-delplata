const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const ARTIFACT_DIR = path.join(__dirname, '..', '.artifacts', 'responsive');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function checkWithinViewport(page, selector, viewport) {
  const el = await page.$(selector);
  if (!el) return { ok: false, reason: `Elemento ${selector} não encontrado` };
  const box = await el.boundingBox();
  if (!box) return { ok: false, reason: `BoundingBox nulo para ${selector}` };
  const ok =
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height;
  return ok
    ? { ok: true }
    : {
        ok: false,
        reason: `${selector} fora da tela (${JSON.stringify(box)})`,
      };
}

async function safeWaitForSelector(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function run() {
  ensureDir(ARTIFACT_DIR);
  const browser = await puppeteer.launch({ headless: 'new' });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(15000);
    await page.setViewport({ width: vp.width, height: vp.height });

    // Reservar page - datepicker
    const reservarUrl = `${BASE_URL}/reservar`;
    await page.goto(reservarUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-reservar.png`), fullPage: true });

    // Open check-in popover
    await page.waitForSelector('[data-testid="checkin-trigger"]', { timeout: 10000 });
    await page.$eval('[data-testid="checkin-trigger"]', (el) => el.click());
    const checkinVisible = await safeWaitForSelector(page, '[data-testid="checkin-popover"]', 10000);
    if (checkinVisible) {
      const checkinResult = await checkWithinViewport(page, '[data-testid="checkin-popover"]', vp);
      console.log(`[${vp.name}] checkin popover: ${checkinResult.ok ? 'OK' : 'FAIL'} ${checkinResult.reason || ''}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-checkin-popover.png`), fullPage: true });
    } else {
      console.log(`[${vp.name}] checkin popover: SKIP (não abriu a tempo)`); 
    }

    // Open check-out popover
    await page.waitForSelector('[data-testid="checkout-trigger"]', { timeout: 10000 });
    await page.$eval('[data-testid="checkout-trigger"]', (el) => el.click());
    const checkoutVisible = await safeWaitForSelector(page, '[data-testid="checkout-popover"]', 10000);
    if (checkoutVisible) {
      const checkoutResult = await checkWithinViewport(page, '[data-testid="checkout-popover"]', vp);
      console.log(`[${vp.name}] checkout popover: ${checkoutResult.ok ? 'OK' : 'FAIL'} ${checkoutResult.reason || ''}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-checkout-popover.png`), fullPage: true });
    } else {
      console.log(`[${vp.name}] checkout popover: SKIP (não abriu a tempo)`);
    }

    // Admin mapa modal (best effort)
    const mapaUrl = `${BASE_URL}/admin/mapa`;
    await page.goto(mapaUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-admin-mapa.png`), fullPage: true });
    const bulkButton = await page.$('text=Edição em Lote');
    if (bulkButton) {
      await bulkButton.click();
      await page.waitForSelector('[data-testid="bulk-modal"]', { timeout: 5000 });
      const modalResult = await checkWithinViewport(page, '[data-testid="bulk-modal"]', vp);
      console.log(`[${vp.name}] bulk modal: ${modalResult.ok ? 'OK' : 'FAIL'} ${modalResult.reason || ''}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-bulk-modal.png`), fullPage: true });
    } else {
      console.log(`[${vp.name}] bulk modal: SKIP (sem acesso ao admin ou botão não encontrado)`);
    }
    await page.close();
  }

  await browser.close();
}

run().catch((err) => {
  console.error('Responsive smoke failed:', err);
  process.exit(1);
});
