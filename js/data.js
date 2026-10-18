// Loads data/words.json and exposes lookups
export const DB = { words: [], parts: [], byN: new Map() };

export async function loadData() {
  const res = await fetch('data/words.json');
  if (!res.ok) throw new Error('words.json ' + res.status);
  const j = await res.json();
  DB.words = j.words; DB.parts = j.parts;
  DB.byN = new Map(j.words.map(w => [w.n, w]));
  return DB;
}
export const word = n => DB.byN.get(n);
export const partWords = p => DB.words.filter(w => w.p === p);
export const rangeWords = (a, b) => DB.words.filter(w => w.n >= a && w.n <= b);
export const audioUrl = (w, lang) => `audio/${lang}/${String(w.n).padStart(4, '0')}.mp3`;
export const hasAudio = (w, lang) => !!(w.a & (lang === 'en' ? 1 : 2));
