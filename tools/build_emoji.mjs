// Build emoji hints for every word.  Usage: node tools/build_emoji.mjs
// Source of truth: tools/emoji/curated_*.txt ("n emoji" per line, hand-picked from en + he + meaning).
// Any word missing from the curated files gets an automatic keyword guess (AUTO below), else 💡.
// Writes data/emoji_hints.json ({n: emoji}) and injects field "e" into data/words.json (nothing else changes).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WJ = path.join(ROOT, 'data/words.json');
const data = JSON.parse(fs.readFileSync(WJ, 'utf8'));
const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });

const curated = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'tools/emoji')).filter(f => /^curated_.*\.txt$/.test(f)).sort()) {
  for (const line of fs.readFileSync(path.join(ROOT, 'tools/emoji', f), 'utf8').split('\n')) {
    const m = /^(\d+)\s+(\S+)\s*$/.exec(line.trim()); if (m) curated.set(+m[1], m[2]);
  }
}
// keyword fallback (English headword / meaning / Hebrew) for words not in the curated list
const AUTO = [
  [/\b(eat|food|meal)\b|אוכל/, '🍽️'], [/\b(money|pay|cost|price)\b|כסף/, '💰'], [/\b(time|hour|clock)\b|זמן/, '⏰'],
  [/\b(say|speak|talk|tell)\b|לדבר|לומר/, '🗣️'], [/\b(think|mind|idea)\b|לחשוב/, '🤔'], [/\b(go|move|walk)\b|ללכת/, '🚶'],
  [/\b(see|look|watch)\b|לראות/, '👀'], [/\b(good|well)\b|טוב/, '👍'], [/\b(bad|wrong)\b|רע/, '👎'],
  [/\b(up|rise|increase)\b|לעלות/, '⬆️'], [/\b(down|fall|reduce)\b|לרדת/, '⬇️'], [/\b(back|return)\b|בחזרה/, '↩️'],
];
// guard: no letters / enclosed-alphanumerics / regional-indicator flags (could reveal the English spelling)
const BAD = /[A-Za-z\u{1F170}-\u{1F1FF}\u{24B6}-\u{24E9}\u{1F520}\u{1F521}\u{1F524}]/u;
const isEmoji = s => /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u20E3/u.test(s);

const out = {}; const stats = { curated: 0, auto: 0, fallback: 0, question: 0 }; const problems = [];
for (const w of data.words) {
  let e = curated.get(w.n), src = 'curated';
  if (!e) { const hay = `${w.en} ${w.m || ''} ${w.he}`.toLowerCase(); e = (AUTO.find(([re]) => re.test(hay)) || [])[1]; src = 'auto'; }
  if (!e) { e = '💡'; src = 'fallback'; }
  const g = [...seg.segment(e)];
  if (g.length !== 1) problems.push(`#${w.n} ${w.en}: not a single grapheme (${e})`);
  if (!isEmoji(e)) problems.push(`#${w.n} ${w.en}: not an emoji (${e})`);
  if (BAD.test(e)) problems.push(`#${w.n} ${w.en}: letters/flag not allowed (${e})`);
  if (e === '💡' && src !== 'curated') stats.fallback++; else stats[src]++;
  if (e === '❓') stats.question++;
  out[w.n] = e; w.e = e;
}
for (const n of curated.keys()) if (!data.words.some(w => w.n === n)) problems.push(`curated #${n} has no word`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'data/emoji_hints.json'), JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n');
fs.writeFileSync(WJ, JSON.stringify(data));
const uniq = new Set(Object.values(out)).size;
const lightbulb = Object.values(out).filter(e => e === '💡').length;
console.log({ words: data.words.length, ...stats, distinctEmoji: uniq, lightbulbTotal: lightbulb });
