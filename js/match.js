// Tolerant matching for the typing quiz.
// Ignores case, punctuation, sb/sth (and somebody/something/someone), optional "(...)" parts,
// accepts any alternative of "a/b" and "X or Y", an optional leading "to " for verbs, and 1 typo in long words.
import { NEAR_WORDS } from './near-words.js';
const FILLERS = new Set(['sb', 'sth', 'somebody', 'something', 'someone', 'etc', 'sbs', 'sths', 'somebodys', 'someones']);

export function norm(s) {
  const toks = String(s).toLowerCase()
    .replace(/\b(?:[a-z]\.){2,}/g, m => m.replace(/\./g, ''))   // p.m. -> pm, a.m. -> am
    .replace(/[\u2019\u2018`´]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')   // drop punctuation (keep apostrophes and hyphens for now)
    .replace(/'/g, '')                // don't -> dont
    .replace(/-/g, ' ')               // check-in -> check in
    .split(/\s+/).filter(Boolean);
  const kept = toks.filter(t => !FILLERS.has(t));
  return (kept.length ? kept : toks).join(' ');   // the entry "etc." / "something" itself stays matchable
}

function expandSlashes(str) {
  // "a variety of sth/sb" -> tokens; any token containing "/" yields alternatives
  const toks = str.split(/\s+/).filter(Boolean);
  let outs = [''];
  for (const t of toks) {
    const alts = t.includes('/') ? t.split('/').filter(Boolean) : [t];
    const nx = [];
    for (const o of outs) for (const a of alts) nx.push(o ? o + ' ' + a : a);
    outs = nx.slice(0, 64);
  }
  return outs;
}

/** all accepted normalized forms of an official list entry */
export function variants(en) {
  const out = new Set();
  const raw = String(en).replace(/\u2026|\.\.\./g, ' ');
  let base = raw.replace(/\s*\/\s*/g, '/');
  // phrase-level alternatives: "X or Y", "X; Y", "X / Y" (spaced slash)
  const parts = [...base.split(/\s+or\s+|;\s*/i), ...raw.split(/\s+\/\s+|\s+or\s+/i).map(x => x.replace(/\s*\/\s*/g, '/'))];
  const add = s => { const n = norm(s); if (n) out.add(n); };
  // any slash as a phrase separator, but only for multi-word pieces ("all my love/lots of love")
  for (const piece of raw.split(/\s*\/\s*/)) if (norm(piece.replace(/[()]/g, ' ')).split(' ').length >= 2) parts.push(piece);
  // a one-word alternative that is part of a longer one: "have/have got", "scooter/electric scooter"
  const pieces = raw.split(/\s*\/\s*/).map(x => norm(x.replace(/[()]/g, ' ')));
  for (const pc of pieces) if (pc && !pc.includes(' ') && pieces.some(o => o !== pc && o.split(' ').includes(pc))) parts.push(pc);
  for (const p of [...parts, base]) {
    const withParen = p.replace(/[()]/g, ' ');            // keep optional words
    const noParen = p.replace(/\([^)]*\)/g, ' ');          // drop optional words
    for (const v of new Set([withParen, noParen])) {
      add(v.replace(/\//g, ' '));                          // everything, slashes as spaces
      for (const e of expandSlashes(v)) add(e);
    }
  }
  // "have (got) to do sth" / "be able to do sth": the bare verb slot "do"/"doing" is optional
  for (const v of [...out]) { const t = v.replace(/ (do|doing)$/, ''); if (t !== v && t) out.add(t); }
  return [...out];
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : 99);
  return d[a.length][b.length];
}

/** returns 'exact' | 'typo' | false
 *  opts.also  – other official entries that are equally correct (e.g. same Hebrew translation)
 *  opts.taken – Set of normalized variants of ALL list entries: typing another list word is never a "typo" */
export function check(input, en, opts = {}) {
  let u = norm(input);
  if (!u) return false;
  const vs = new Set([en, ...(opts.also || [])].flatMap(variants));
  const cands = [u];
  if (u.startsWith('to ')) cands.push(u.slice(3));
  for (const art of ['a ', 'an ', 'the ']) if (u.startsWith(art)) cands.push(u.slice(art.length));
  for (const c of cands) if (vs.has(c)) return 'exact';
  // a different real word (quiet vs quite, dessert vs desert) is wrong, not a typo
  if (cands.some(c => NEAR_WORDS.has(c) || opts.taken?.has(c))) return false;
  // UK/US spelling variants (colour/color, -ise/-ize) and a single typo for longer answers
  for (const c of cands) for (const v of vs) {
    if (v.length >= 5 && lev(c, v) <= 1) return 'typo';
    if (v.length >= 10 && lev(c, v) <= 2) return 'typo';
  }
  return false;
}
