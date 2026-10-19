"""Build data/words.json and per-word audio from the Band2 project.
Run from anywhere:  python3 tools/build_data.py /workspace/band2
Reads the TTS cache mapping logic from tts.py (no API calls, no key needed)."""
import os, sys, json, re, hashlib, subprocess
from concurrent.futures import ThreadPoolExecutor
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/band2'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SRC)
os.environ.setdefault('ELEVENLABS_API_KEY', 'unused')  # tts.py reads it at import; never used here
src = open('tts.py').read().split("if __name__")[0]
g = {}; exec(src, g)
e = json.load(open('entries_he.json'))
# parts: same split as build.parts() (np.array_split of each core into 10)
def split(lst, k):
    n = len(lst); q, r = divmod(n, k); out = []; i = 0
    for j in range(k):
        s = q + (1 if j < r else 0); out.append(lst[i:i+s]); i += s
    return out
part_of = {}; parts = []
for ci, core in enumerate(['Core I', 'Core II']):
    for j, ch in enumerate(split([o for o in e if o['core'] == core], 10)):
        p = ci*10 + j + 1
        parts.append({'id': p, 'core': core, 'from': ch[0]['n'], 'to': ch[-1]['n'], 'count': len(ch)})
        for o in ch: part_of[o['n']] = p
jobs = {}; words = []; real_en = real_he = 0
for o in e:
    n = o['n']
    pe = g['path'](g['en_tts_text'](o['english'], n), g['EN_VOICE'], 'en')
    ph = g['path'](g['he_tts_text'](n, o['hebrew']), g['HE_VOICE'], 'he')
    w = {'n': n, 'p': part_of[n], 'core': 1 if o['core'] == 'Core I' else 2, 'en': o['english'], 'pos': o['pos'],
         'he': o['hebrew'], 'm': o['meaning'], 'rp': o['recprod']}
    if o.get('family'): w['fam'] = o['family']; w['famPos'] = o.get('family_pos', '')
    a = 0
    if os.path.exists(pe) and os.path.getsize(pe) > 1000: a |= 1; jobs[f'audio/en/{n:04d}.mp3'] = pe; real_en += 1
    if os.path.exists(ph) and os.path.getsize(ph) > 1000: a |= 2; jobs[f'audio/he/{n:04d}.mp3'] = ph; real_he += 1
    w['a'] = a
    words.append(w)
json.dump({'version': 1, 'title': 'Lexical Band II', 'parts': parts, 'words': words},
          open(os.path.join(OUT, 'data/words.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
# re-attach the curated emoji hints (field "e"), see tools/build_emoji.mjs
subprocess.run(['node', os.path.join(OUT, 'tools/build_emoji.mjs')], check=True)
def enc(item):
    dst, srcp = item; dst = os.path.join(OUT, dst)
    if os.path.exists(dst): return
    # trim leading/trailing silence, loudness-normalise, mono 22.05kHz 32kbps
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', srcp, '-af',
        'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-18:TP=-1.5:LRA=11',
        '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '32k', '-map_metadata', '-1', dst], check=True)
with ThreadPoolExecutor(os.cpu_count() or 4) as ex: list(ex.map(enc, jobs.items()))
print({'words': len(words), 'real_en': real_en, 'real_he': real_he, 'parts': [(p['id'], p['from'], p['to'], p['count']) for p in parts]})
