"""Static check: every word in data/words.json has the audio files it claims; report sizes."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(root, 'data/words.json')))
W = d['words']; miss = []; en = he = 0
for w in W:
    for bit, lang in ((1, 'en'), (2, 'he')):
        p = os.path.join(root, f"audio/{lang}/{w['n']:04d}.mp3")
        if w['a'] & bit:
            if not os.path.isfile(p) or os.path.getsize(p) < 500: miss.append(p)
            elif lang == 'en': en += 1
            else: he += 1
parts = d['parts']
assert len(W) == 2016 and len(parts) == 20 and sum(p['count'] for p in parts) == 2016
assert all(100 <= p['count'] <= 102 for p in parts)
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(root, 'audio')) for f in fs)
print(f"words={len(W)} parts={len(parts)} en_audio={en} he_audio={he} fallback_en={len(W)-en} fallback_he={len(W)-he} missing={len(miss)} audio_MB={size/1e6:.1f}")
sys.exit(1 if miss else 0)
