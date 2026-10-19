// Emoji-hint smoke test at 412×915.  Usage (repo root served on :8765, playwright-core installed):
//   node tools/smoke-emoji.mjs [http://localhost:8765/] [/usr/bin/google-chrome]
import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:8765/';
const EXE = process.argv[3] || process.env.CHROME || '/usr/bin/google-chrome';
const errs = []; let fails = 0;
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: EXE, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
const go = async (hash, t = 600) => { await page.evaluate(h => location.hash = h, hash); await page.waitForTimeout(t); };
const shot = n => page.screenshot({ path: `/tmp/emo-${n}.png` });
await page.goto(BASE + (BASE.includes('?') ? '&' : '?') + 'nocache=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
const d = await page.evaluate(async () => (await (await fetch('data/words.json', { cache: 'no-store' })).json()).words);
ok(d.length === 2016 && d.every(w => w.e), `words.json: ${d.filter(w => w.e).length}/2016 words have an emoji`);

// word list with hidden translation
await go('#/part/1');
const tog = page.locator('label.switch input[type=checkbox]').first();
if (!(await tog.isChecked())) await tog.check();
await page.waitForTimeout(300);
const row = page.locator('article.word').first();
ok(await row.evaluate(el => el.classList.contains('hidden-he')), 'word list: translation hidden');
ok(await row.locator('.w-he-row .emo').isVisible(), `word list: emoji visible while hidden (${await row.locator('.emo').textContent()})`);
ok(await row.locator('.emo').evaluate(el => getComputedStyle(el).filter === 'none'), 'word list: emoji not blurred');
await shot('list');
await tog.uncheck();

// flashcards EN→HE
await go('#/flash?src=part&p=3');
const front = page.locator('.fc-front .emo-lg');
ok(await front.isVisible(), `flashcard front shows emoji ${await front.textContent()}`);
const fs = await front.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
ok(fs >= 36 && fs <= 56, `flashcard emoji size ${fs}px (prominent, not huge)`);
await shot('flash-front');
await page.locator('button.btn.block.lg').click(); await page.waitForTimeout(700);
ok(await page.locator('.fc-back .he-emo .emo').count() === 1, 'flashcard back: emoji next to Hebrew');
await shot('flash-back');

// listen: emoji during recall countdown
await go('#/listen?src=part&p=2&autostart=1', 400);
await page.waitForSelector('.player');
let seen = false, hiddenHe = false;
for (let i = 0; i < 40 && !seen; i++) {
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => ({ ring: getComputedStyle(document.querySelector('.player .ring')).visibility, emo: !!document.querySelector('.emo-slot:not(.wait) .emo'), he: document.querySelector('.player .big-he').classList.contains('hide') }));
  if (st.ring === 'visible' && st.emo) { seen = true; hiddenHe = st.he; }
}
ok(seen, 'listen: emoji shown during recall countdown'); ok(hiddenHe, 'listen: Hebrew still hidden at that moment');
await shot('listen');
await go('#/', 300);

// quiz: hint only on demand
await go('#/quiz?src=part&p=1&type=en-he'); await page.locator('button:has-text("להתחיל")').click(); await page.waitForTimeout(600);
let found = false;
for (let i = 0; i < 25 && !found; i++) {
  const b = page.locator('.emo-hint button');
  if (await b.count()) {
    ok(await page.locator('.q-prompt .emo').count() === 0, 'quiz: emoji not shown before tapping hint');
    await b.click(); await page.waitForTimeout(150);
    ok(await page.locator('.q-prompt .emo').isVisible(), 'quiz: hint button reveals emoji'); found = true; await shot('quiz');
  } else { const c = page.locator('.choice').first(); if (await c.count()) { await c.click(); await page.waitForTimeout(300); await page.locator('button:has-text("הבא")').click().catch(() => {}); } else break; await page.waitForTimeout(300); }
}
ok(found, 'quiz: optional hint button present');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
ok(!overflow, 'no horizontal overflow at 412px');
ok(!errs.length, 'no JS errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
