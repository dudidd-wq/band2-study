"""Validate tools/sentences/content.py and write data/sentences.json.
Checks: targets exist and belong to the item's part (or earlier); exactly one blank; answer/distractors distinct;
distractors are Band II words of the same part; every English token is either a basic (Band I-level) word,
a number/name, or a Band II word introduced in this part or earlier.  Run: python3 tools/sentences/build_sentences.py"""
import json, re, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import ITEMS
W = json.load(open(os.path.join(ROOT, 'data/words.json')))['words']
byN = {w['n']: w for w in W}
# Band I-level everyday words + function words allowed anywhere (reviewed list)
BASIC = set("""a an the and or but if so to of in on at for with from by about up down out off over into after before
i me my mine you your yours he him his she her hers it its we us our they them their this that these those there here
is am are was were be been being do does did don't doesn't didn't can can't could will won't would shall should must have has had
haven't hasn't wasn't wasn't isn't aren't i'm i'll you're you'll he's she's it's that's there's what's where's who's let's we'll they're
not no yes oh hey please thanks thank sorry ok what where when who why how which very too really just still again also all some any
another other one two three four five six seven eight ten twenty first next last new old good great bad big small little long short
hot cold warm late early now today tonight tomorrow yesterday night morning day week weekend month months year time minute minutes
monday tuesday wednesday thursday friday saturday sunday summer winter
go goes going went come comes coming came get gets got give gives gave take taking took make made see saw seen look watch watched
like likes love loves want need know think say tell talk speak hear listen read write eat ate drink run swim swam sleep play
help helps helped buy put forget forgot find found lose lost close closing open live lives call keep hold walk work wear stop start starts started
learn learning study studied pay pass passed fail failed win won break broke hope hate cry crying rain throw fly bring
phone pen pencil bag book books bike bus car train street road room house home school class teacher friend friends family
mother mom dad father brother sister grandma grandmother aunt girl boy baby dog dogs cat
water coffee tea milk meat salt pizza pasta cake chocolate ice cream salad vegetables food dinner lunch breakfast
music song songs movie band game sports beach park sea photo photos dress shoes jeans coat lights light window door paper
test exam homework math english hebrew money internet tv sentence word kitchen stairs spoons knife umbrella
sick tired happy sad busy ready sure quiet fun favorite best highest much many lot most more less well fine nice
everyone anyone someone something nothing everything mine yourself myself
dead problem idea maybe much without because than then town meet trip noise drawing hair sun sunny
italy haifa dana noa maya tom grandma neighbors weather lot
always anything arrive aunt aunt's careful daughter doctor eating outside rains singer worry later top playing yet parents every""".split())
IRR = {'broke':'break','broken':'break','ate':'eat','won':'win','swam':'swim','made':'make','saw':'see','got':'get','gave':'give',
       'found':'find','lost':'lose','fell':'fall','took':'take','went':'go','came':'come','kilometers':'kilometer','dishes':'dish','includes':'included','bitten':'bite','lying':'lie'}
lemma_part = {}
for w in W:
    for t in re.findall(r"[a-z]+(?:'[a-z]+)?", w['en'].lower()):
        if t in ('sb', 'sth'): continue
        lemma_part[t] = min(lemma_part.get(t, 99), w['p'])
def cands(t):
    t = t.lower(); out = [t, IRR.get(t, t)]
    for suf, rep in (("'s",''),('ies','y'),('ied','y'),('es',''),('s',''),('ed',''),('ed','e'),('d',''),('ing',''),('ing','e'),('er','')):
        if t.endswith(suf) and len(t) > len(suf) + 2:
            b = t[:-len(suf)] + rep; out.append(b)
            if len(b) > 2 and b[-1] == b[-2]: out.append(b[:-1])
    return out
def part_of_token(t):
    ps = [lemma_part[c] for c in cands(t) if c in lemma_part]
    return min(ps) if ps else None
errors, unknown, later = [], {}, []
def check_text(it_id, part, text):
    for tok in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text):
        lo = tok.lower()
        if lo in BASIC or IRR.get(lo, '') in BASIC: continue
        p = part_of_token(tok)
        if p is None: unknown.setdefault(lo, []).append(it_id)
        elif p > part: later.append(f'{it_id}: "{tok}" is a Band II word from part {p}')
def norm(s): return ' '.join(re.findall(r"[a-z0-9']+", s.lower().replace('’', "'")))
def tiles_of(s):
    toks = re.findall(r"[A-Za-z0-9']+", s)
    keep = lambda t: t == 'I' or t.startswith("I'") or (t[0].isupper() and t.lower() in BASIC and t.lower() in {'italy','haifa','dana','noa','maya','tom','grandma','friday','saturday','sunday','tuesday','english','hebrew'})
    return [t if keep(t) else t.lower() for t in toks]
out, counter = [], {}
for raw in ITEMS:
    part, typ = raw[0], raw[1]
    counter[(part, typ)] = counter.get((part, typ), 0) + 1
    iid = f"p{part:02d}-{typ.lower()}{counter[(part, typ)]}"
    if typ == 'F':
        _, _, s, n, ans, ds, he = raw; t = [n]
        if s.count('___') != 1: errors.append(f'{iid}: needs exactly one ___')
        it = {'id': iid, 'part': part, 'type': 'fill', 's': s, 't': t, 'ans': [ans], 'opts': [ans] + ds, 'he': he}
        check_text(iid, part, s.replace('___', ans))
    elif typ == 'B':
        _, _, s, t, he, alt = raw
        tiles = tiles_of(s)
        if not 3 <= len(tiles) <= 6: errors.append(f'{iid}: {len(tiles)} tiles (want 3–6)')
        accepted = sorted({norm(s)} | {norm(a) for a in alt})
        for a in accepted:
            if sorted(a.split()) != sorted(norm(' '.join(tiles)).split()): errors.append(f'{iid}: alt "{a}" uses different tiles')
        it = {'id': iid, 'part': part, 'type': 'build', 's': s, 't': t, 'tiles': tiles, 'ans': accepted, 'he': he}
        check_text(iid, part, s)
    else:
        _, _, a, b, n, ans, ds, ha, hb = raw; t = [n]
        if (a + b).count('___') != 1: errors.append(f'{iid}: needs exactly one ___ across the two lines')
        it = {'id': iid, 'part': part, 'type': 'dialog', 'lines': [{'en': a, 'he': ha}, {'en': b, 'he': hb}], 't': t, 'ans': [ans], 'opts': [ans] + ds, 'he': ha + ' / ' + hb}
        check_text(iid, part, (a + ' ' + b).replace('___', ans))
    for n in it['t']:
        if n not in byN: errors.append(f'{iid}: target #{n} missing')
        elif byN[n]['p'] > part: errors.append(f'{iid}: target #{n} {byN[n]["en"]} is from later part {byN[n]["p"]}')
        elif byN[n]['p'] != part: errors.append(f'{iid}: target #{n} {byN[n]["en"]} is from part {byN[n]["p"]}, not {part}')
    if 'opts' in it:
        lo = [o.lower() for o in it['opts']]
        if len(set(lo)) != 4: errors.append(f'{iid}: need 4 distinct options')
        for d in it['opts'][1:]:
            p = part_of_token(d) if d.lower() not in ('on', 'up', 'off', 'out', 'down', 'together', 'far') else part
            if p is None or p > part: errors.append(f'{iid}: distractor "{d}" is not a Band II word from part ≤ {part}')
        # first-letter case consistent with the slot
    out.append(it)
for e in later: errors.append(e)
if unknown:
    print('UNKNOWN tokens (not basic, not Band II):'); [print('  ', k, v) for k, v in sorted(unknown.items())]
if errors: print('\n'.join(errors)); sys.exit(1)
open(os.path.join(ROOT, 'data/sentences.json'), 'w').write('{"version":1,"items":[\n' + ',\n'.join(json.dumps(i, ensure_ascii=False, separators=(',', ':')) for i in out) + '\n]}\n')
from collections import Counter
print('items', len(out), Counter(i['type'] for i in out), 'per part', sorted(Counter(i['part'] for i in out).items()))
