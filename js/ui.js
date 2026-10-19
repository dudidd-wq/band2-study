// Shared UI pieces
import { h, posHe, posEn, posCat, toast, put, nWords } from './util.js';
import { DB } from './data.js';
import * as st from './store.js';
import { playWord } from './audio.js';
import { describe } from './select.js';

export function playBtn(w, lang, label) {
  const b = h('button.play' + (lang === 'he' ? '.he' : ''), { type: 'button', 'aria-label': lang === 'he' ? 'השמעה בעברית' : 'השמעה באנגלית', title: lang === 'he' ? 'עברית' : 'English' }, label || (lang === 'he' ? 'עב' : 'EN'));
  b.addEventListener('click', e => { e.stopPropagation(); st.seen(w.n); playWord(w, lang, { btn: b }); });
  return b;
}
export function statusChip(n) {
  const s = st.status(n);
  return h('span.chip', { style: { '--c': s === 'mastered' ? 'var(--ok)' : s === 'learning' ? 'var(--warn-ink)' : 'var(--muted)' } },
    h('span.status-dot.st-' + s), { new: 'חדשה', learning: 'בלמידה', mastered: 'שלטת' }[s]);
}
export function markButtons(w, onChange) {
  const known = h('button.mark', { type: 'button', title: 'אני יודעת את המילה', 'aria-label': 'סמני כידועה', 'aria-pressed': String(st.isKnown(w.n)) }, '✅');
  const hard = h('button.mark', { type: 'button', title: 'מילה קשה', 'aria-label': 'סמני כקשה', 'aria-pressed': String(st.isHard(w.n)) }, '⭐');
  const sync = () => { known.classList.toggle('on', st.isKnown(w.n)); hard.classList.toggle('on', st.isHard(w.n)); known.setAttribute('aria-pressed', st.isKnown(w.n)); hard.setAttribute('aria-pressed', st.isHard(w.n)); };
  known.onclick = e => { e.stopPropagation(); const on = !st.isKnown(w.n); st.setKnown(w.n, on); sync(); toast(on ? 'סומנה כ"יודעת" ✅' : 'הסימון הוסר'); onChange?.(); };
  hard.onclick = e => { e.stopPropagation(); const on = !st.isHard(w.n); st.setHard(w.n, on); sync(); toast(on ? 'נוספה למילים הקשות ⭐' : 'הוסרה מהמילים הקשות'); onChange?.(); };
  sync(); return [known, hard];
}
export function wordRow(w, { hideHe = false, onChange } = {}) {
  const cat = posCat(w.pos);
  const [known, hard] = markButtons(w, () => { put(chipBox, statusChip(w.n)); onChange?.(); });
  const chipBox = h('span', statusChip(w.n));
  const he = h('div.w-he', w.he);
  const el = h('article.word.c-' + cat + (hideHe ? '.hidden-he' : ''), { 'data-n': w.n },
    h('div.w-main',
      h('div.w-top', h('div.w-en.en', w.en), h('span.w-n', `#${w.n}`)),
      w.m ? h('div.w-hint.en', w.m) : null,
      he,
      h('div.w-meta', h('span.chip.c-' + cat, posHe(w.pos)), h('span.en.muted', posEn(w.pos)), chipBox, known, hard,
        w.fam ? h('span.small.muted.en', { title: 'מילה מאותה משפחה' }, `→ ${w.fam}${w.famPos ? ' (' + w.famPos + ')' : ''}`) : null)),
    h('div.w-btns', playBtn(w, 'en'), playBtn(w, 'he')));
  he.addEventListener('click', () => el.classList.remove('hidden-he'));
  return el;
}

/** A source picker (part / range / due / weak / mixed / all). Returns {el, get()} */
export function sourcePicker(initial = { type: 'part', p: 1 }, { allow = ['part', 'range', 'due', 'weak', 'mixed', 'all'], counts } = {}) {
  const labels = { part: ['חלק', 'אחד מ-20 החלקים'], range: ['טווח', 'מספרי מילים'], due: ['חזרות להיום', ''], weak: ['מילים קשות', 'מסומנות / טעויות'], mixed: ['מעורב', 'חזרות + קשות + חדשות'], all: ['הכול', '2016 מילים'], new: ['חדשות', 'שעוד לא נבחנו'] };
  const name = 'src' + Math.random().toString(36).slice(2, 7);
  const partSel = h('select', { 'aria-label': 'בחירת חלק' }, DB.parts.map(P => h('option', { value: P.id, selected: P.id === (initial.p || 1) }, `חלק ${P.id} · מילים ${P.from}–${P.to}`)));
  const a = h('input', { type: 'number', min: 1, max: DB.words.length, value: initial.a || 1, inputmode: 'numeric', 'aria-label': 'ממילה' });
  const b = h('input', { type: 'number', min: 1, max: DB.words.length, value: initial.b || 200, inputmode: 'numeric', 'aria-label': 'עד מילה' });
  const partBox = h('div.field', h('label', 'איזה חלק?'), partSel);
  const rangeBox = h('div.field', h('span.lbl', 'טווח מילים (1–2016)'), h('div.row', h('span', 'מ־'), h('div.grow', a), h('span', 'עד'), h('div.grow', b)));
  const opts = h('div.opts', allow.map(t => {
    const c = counts?.[t];
    return h('label.opt', h('input', { type: 'radio', name, value: t, checked: t === initial.type }),
      h('span', labels[t][0], h('small', c != null ? nWords(c) : labels[t][1])));
  }));
  const sync = () => { const t = get().type; partBox.hidden = t !== 'part'; rangeBox.hidden = t !== 'range'; };
  opts.addEventListener('change', sync);
  function get() {
    const t = (opts.querySelector('input:checked') || {}).value || 'part';
    return { type: t, p: +partSel.value, a: Math.max(1, Math.min(DB.words.length, +a.value || 1)), b: Math.max(1, Math.min(DB.words.length, +b.value || 1)) };
  }
  const el = h('div', h('div.field', h('span.lbl', 'מה לתרגל?'), opts), partBox, rangeBox);
  sync();
  return { el, get, describe: () => describe(get()) };
}
export function emptyState(icon, title, sub, action) {
  return h('div.empty', h('div.ei', icon), h('h3', title), sub ? h('p', sub) : null, action || null);
}
