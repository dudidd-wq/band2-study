// Smoke test for "משפטי שיחה" at 412×915: mode loads; a fill-in, a build (tap + drag) and a dialogue item can be completed.
//   node tools/smoke-sentences.mjs [http://localhost:8765/] [/usr/bin/google-chrome]
import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:8765/';
const EXE = process.argv[3] || process.env.CHROME || '/usr/bin/google-chrome';
const errs = []; let fails = 0;
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: EXE, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
page.on('response', r => r.status() >= 400 && !/\/audio\//.test(r.url()) && errs.push(`HTTP ${r.status()} ${r.url()}`));
const shot = n => page.screenshot({ path: `/tmp/sent-${n}.png` });
await page.goto(BASE + '?nocache=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
const items = await page.evaluate(async () => (await (await fetch('data/sentences.json', { cache: 'no-store' })).json()).items);
ok(items.length >= 120, `sentences.json: ${items.length} items`);

// entry from quiz menu
await page.evaluate(() => location.hash = '#/quiz'); await page.waitForTimeout(500);
ok(await page.locator('a.s-entry').isVisible(), 'quiz menu shows "משפטי שיחה" entry');
await page.locator('a.s-entry').click(); await page.waitForTimeout(600);
ok(await page.locator('h1', { hasText: 'משפטי שיחה' }).isVisible(), 'mode loads (#/sentences)');
await shot('setup');
const startKind = async (kind, p = 1) => {
  await page.evaluate(([k, p]) => location.hash = `#/sentences?src=part&p=${p}&kind=${k}&t=${Date.now()}`, [kind, p]); await page.waitForTimeout(500);
  await page.locator('button:has-text("להתחיל")').click(); await page.waitForTimeout(400);
};
const rec = n => page.evaluate(n => JSON.parse(localStorage.getItem('band2.progress.v1') || '{}').words?.[n], n);

// fill-in
await startKind('fill');
const sentText = (await page.locator('.s-sent').innerText()).replace(/\s+/g, ' ').trim();
const fi = items.find(it => it.type === 'fill' && it.part === 1 && sentText.startsWith(it.s.split('___')[0].trim()));
ok(!!fi, `fill-in item shown: "${sentText}"`);
await shot('fill');
await page.locator('.choice', { hasText: new RegExp(`^${fi.ans[0]}$`) }).click(); await page.waitForTimeout(400);
ok(await page.locator('.feedback.ok').isVisible(), 'fill-in: correct answer accepted');
ok(await page.locator('.s-after .s-he').innerText() === fi.he, 'fill-in: Hebrew gloss shown after check');
ok(await page.locator('.s-after .play').count() >= 2, 'fill-in: EN/HE audio buttons for the target word');
ok(!!(await rec(fi.t[0])), `Leitner record updated for #${fi.t[0]}`);
await shot('fill-done');

// build (tap)
await startKind('build');
const heQ = await page.locator('.s-he-q').innerText();
const bi = items.find(it => it.type === 'build' && it.part === 1 && it.he === heQ);
ok(!!bi, `build item shown: "${heQ}"`);
await shot('build');
const used = new Set();
for (const t of bi.tiles) {
  const tiles = page.locator('.s-bank .s-tile');
  const n = await tiles.count();
  for (let k = 0; k < n; k++) { const el = tiles.nth(k); if ((await el.innerText()) === t) { await el.click(); break; } }
}
await page.locator('button:has-text("בדיקה")').click(); await page.waitForTimeout(400);
ok(await page.locator('.feedback.ok').isVisible(), 'build (tap): correct order accepted');
await shot('build-done');

// build (drag): drag first-needed tile into the line, then tap the rest
await page.locator('button:has-text("הבא")').click(); await page.waitForTimeout(400);
const heQ2 = await page.locator('.s-he-q').innerText();
const bi2 = items.find(it => it.type === 'build' && it.part === 1 && it.he === heQ2);
const first = page.locator('.s-bank .s-tile', { hasText: new RegExp(`^${bi2.tiles[0]}$`) }).first();
const fb = await first.boundingBox(); const lb = await page.locator('.s-line').boundingBox();
await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.mouse.down();
await page.mouse.move(fb.x + 30, fb.y - 30, { steps: 4 }); await page.mouse.move(lb.x + 30, lb.y + lb.height / 2, { steps: 6 }); await page.mouse.up();
await page.waitForTimeout(200);
ok(await page.locator('.s-line .s-tile').count() === 1, 'build (drag): tile dropped into the sentence line');
for (const t of bi2.tiles.slice(1)) {
  const tiles = page.locator('.s-bank .s-tile'); const n = await tiles.count();
  for (let k = 0; k < n; k++) { const el = tiles.nth(k); if ((await el.innerText()) === t) { await el.click(); break; } }
}
await page.locator('button:has-text("בדיקה")').click(); await page.waitForTimeout(300);
ok(await page.locator('.feedback.ok').isVisible(), 'build (drag + tap): correct order accepted');

// dialogue: answer wrong on purpose → summary lists mistake → retry
await startKind('dialog');
ok(await page.locator('.s-chat .s-bub').count() === 2, 'dialogue: two chat lines');
await shot('dialog');
const txt = (await page.locator('.s-chat').innerText()).replace(/\s+/g, ' ');
const di = items.find(it => it.type === 'dialog' && it.part === 1 && txt.includes(it.lines[0].en.split('___')[0].trim().slice(0, 12)));
const wrongOpt = di.opts.find(o => o !== di.ans[0]);
await page.locator('.choice', { hasText: new RegExp(`^${wrongOpt}$`) }).click(); await page.waitForTimeout(300);
ok(await page.locator('.feedback.bad').isVisible(), 'dialogue: wrong answer marked');
await page.locator('button:has-text("סיום")').click(); await page.waitForTimeout(400);
ok(await page.locator('h1', { hasText: 'סיכום' }).isVisible(), 'summary shown');
ok(await page.locator('button:has-text("תרגול הטעויות")').isVisible(), 'retry-mistakes button');
await shot('summary');
await page.locator('button:has-text("תרגול הטעויות")').click(); await page.waitForTimeout(300);
ok(await page.locator('.s-chat').isVisible(), 'retry starts with the missed dialogue');
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'no horizontal overflow at 412px');
ok(!errs.length, 'no JS/HTTP errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
