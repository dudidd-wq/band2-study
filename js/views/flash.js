import { h, posHe, posEn, posCat, shuffle, confetti, put } from '../util.js';
import * as st from '../store.js';
import { playWord, stop, sfx } from '../audio.js';
import { parseSrc, pick, describe, srcQuery } from '../select.js';
import { onLeave, refreshTop } from '../nav.js';
import { playBtn, markButtons, emptyState } from '../ui.js';

export function flashView(_m, q) {
  const src = parseSrc(q);
  const set = st.getSettings();
  let dir = q.get('dir') === 'he-en' ? 'he-en' : 'en-he';
  let doShuffle = q.get('shuffle') === '1' || src.type === 'due' || src.type === 'mixed';
  const base = pick(src, src.type === 'mixed' ? 30 : 0);
  const root = h('div');
  if (!base.length) {
    return h('div', h('h1', 'כרטיסיות'), emptyState(src.type === 'due' ? '🎉' : '🗂️',
      src.type === 'due' ? 'אין חזרות שמחכות היום!' : 'אין מילים ברשימה הזו',
      src.type === 'due' ? 'כל הכבוד. אפשר ללמוד חלק חדש או לעשות בחינה.' : '',
      h('a.btn', { href: '#/parts' }, 'לבחירת חלק')));
  }
  let queue, i, stats, retried;
  const reset = () => { queue = doShuffle ? shuffle(base) : base.slice(); i = 0; stats = { ok: 0, bad: 0, wrong: new Map() }; retried = new Set(); };
  reset();

  const onKey = e => {
    if (e.target.closest('input,select,textarea')) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); flipBtn && !flipped ? flip() : null; }
    else if (flipped && (e.key === '1' || e.key === 'ArrowRight')) grade(false);
    else if (flipped && (e.key === '2' || e.key === 'ArrowLeft')) grade(true);
  };
  document.addEventListener('keydown', onKey);
  onLeave(() => { document.removeEventListener('keydown', onKey); stop(); });

  let card, flipped = false, flipBtn, actions;
  function show() {
    if (i >= queue.length) return finish();
    const w = queue[i]; flipped = false; const cat = posCat(w.pos);
    const enFace = [h('div.big-en.en', w.en), h('div.row', { style: { justifyContent: 'center' } }, h('span.chip.c-' + cat, posHe(w.pos)), h('span.small.muted.en', posEn(w.pos))), w.m ? h('div.hint.en', w.m) : null];
    const heFace = [h('div.big-he', w.he)];
    const front = dir === 'en-he' ? enFace : heFace; const back = dir === 'en-he' ? [...heFace, h('div.en.muted', w.en)] : [...enFace, h('div.muted', w.he)];
    const top = () => h('div.fc-top', h('span', `${i + 1} / ${queue.length}`), h('span', `#${w.n} · חלק ${w.p}`));
    card = h('div.fc.c-' + cat, { 'aria-live': 'polite' },
      h('div.fc-face.fc-front', top(), ...front, h('div.tap', 'לחצי כדי להפוך 👆')),
      h('div.fc-face.fc-back', top(), ...back, h('div.row', { style: { justifyContent: 'center' } }, playBtn(w, 'en'), playBtn(w, 'he'), ...markButtons(w, refreshTop))));
    card.addEventListener('click', e => { if (!e.target.closest('button')) flipped ? playWord(w, dir === 'en-he' ? 'he' : 'en') : flip(); });
    flipBtn = h('button.btn.block.lg', { type: 'button', onclick: flip }, 'הציגי את התשובה');
    actions = h('div.fc-actions', { hidden: true },
      h('button.btn.bad.lg', { type: 'button', onclick: () => grade(false) }, '😕 לא ידעתי'),
      h('button.btn.ok.lg', { type: 'button', onclick: () => grade(true) }, '😊 ידעתי'));
    put(root, header(), h('div.progress-line', h('i', { style: { width: (i / queue.length * 100) + '%' } })),
      h('div.fc-wrap', card), flipBtn, actions);
    st.seen(w.n);
    if (set.autoplayCards) playWord(w, dir === 'en-he' ? 'en' : 'he');
  }
  function flip() {
    if (flipped) return; flipped = true; const w = queue[i];
    card.classList.add('flip'); flipBtn.hidden = true; actions.hidden = false;
    if (set.autoplayCards) playWord(w, dir === 'en-he' ? 'he' : 'en');
  }
  function grade(ok) {
    const w = queue[i]; st.answer(w.n, ok); refreshTop();
    if (ok) stats.ok++; else { stats.bad++; stats.wrong.set(w.n, w); if (!retried.has(w.n)) { retried.add(w.n); queue.push(w); } }
    sfx(ok ? 'ok' : 'bad'); i++; show();
  }
  function header() {
    const dirBtn = h('button.btn.sm.sec', { type: 'button', onclick: () => { dir = dir === 'en-he' ? 'he-en' : 'en-he'; show(); } }, dir === 'en-he' ? 'אנגלית ← עברית' : 'עברית ← אנגלית');
    const shBtn = h('button.btn.sm.sec', { type: 'button', onclick: () => { doShuffle = !doShuffle; reset(); show(); } }, doShuffle ? '🔀 מעורבב' : '➡️ לפי הסדר');
    return h('div.row', h('div.grow', h('h1', { style: { margin: 0 } }, 'כרטיסיות'), h('div.small.muted', { style: { whiteSpace: 'nowrap' } }, describe(src))), dirBtn, shBtn);
  }
  function finish() {
    stop(); const tot = stats.ok + stats.bad; const pct = tot ? Math.round(stats.ok / tot * 100) : 0;
    if (pct >= 80) { sfx('win'); confetti(); }
    const wrong = [...stats.wrong.values()];
    put(root, 
      h('h1', 'סיימת! 🎉'),
      h('div.card.center', h('div', { style: { fontSize: '3rem' } }, pct >= 90 ? '🏆' : pct >= 70 ? '🌟' : '💪'),
        h('h2', { style: { marginTop: 0 } }, `${stats.ok} ידעת · ${stats.bad} עוד לא`),
        h('p.muted', 'המילים שלא ידעת יחזרו אלייך בחזרות הקרובות.')),
      wrong.length ? h('div.card', h('h3', 'מילים לחיזוק'), h('ul.list-plain', wrong.map(w => h('li', playBtn(w, 'en'), h('div.grow', h('b.en', w.en), h('div.small', w.he)))))) : null,
      h('div.row', { style: { marginTop: '14px' } },
        h('button.btn', { type: 'button', onclick: () => { reset(); show(); } }, '🔁 שוב'),
        h('a.btn.sec', { href: `#/quiz?${srcQuery(src)}` }, '✍️ בחינה על המילים'),
        h('a.btn.ghost', { href: '#/' }, 'לדף הבית')));
  }
  show();
  return root;
}
