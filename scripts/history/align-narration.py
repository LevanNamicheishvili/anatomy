"""
Word timings for the Didgori narration (karaoke text), without a speech recogniser.

The voice (ElevenLabs) has clean silences. Pauses in the audio are matched to the punctuation of the known
text by dynamic programming — sentence and paragraph ends to long pauses, commas to short ones (or none) —
choosing the matching whose speaking rate between anchors stays most even. Between two anchors the words
share the speech time in proportion to their spoken length (numbers are counted as the words that are said).

Run:
  afconvert -f WAVE -d LEI16@16000 -c 1 public/history/didgori-narration.mp3 /tmp/n.wav
  python3 scripts/history/align-narration.py /tmp/n.wav scripts/history/didgori-narration.txt src/components/history/didgori-narration-timing.ts
"""
import array, json, math, re, sys, wave

wav_path, text_path, out_path = sys.argv[1:4]

# ---- Audio: loudness every 10 ms, pauses ---------------------------------------------------------------------
w = wave.open(wav_path)
sr = w.getframerate()
samples = array.array("h", w.readframes(w.getnframes()))
F = sr // 100
rms = []
for i in range(0, len(samples) - F, F):
    s = 0
    for v in samples[i:i + F]:
        s += v * v
    rms.append(math.sqrt(s / F))
duration = len(samples) / sr
thr = sorted(rms)[int(len(rms) * 0.95)] * 0.04
loud = [r >= thr for r in rms]
first = loud.index(True) / 100
last = (len(loud) - loud[::-1].index(True)) / 100
pauses = []
start = None
for i, l in enumerate(loud):
    if not l:
        if start is None:
            start = i
    else:
        if start is not None and i - start >= 12 and start / 100 > first:
            pauses.append((start / 100, i / 100))
        start = None
print(f"audio {duration:.1f}s, speech {first:.2f}-{last:.2f}s, pauses {len(pauses)}")

# ---- Text: words, spoken length, breaks ---------------------------------------------------------------------------
SPOKEN = {
    "1121": "ათას ას ოცდაერთი", "12": "თორმეტ", "40": "ორმოც", "100": "ას", "000-ზე": "ათასზე",
    "56": "ორმოცდათექვსმეტი", "000": "ათასი", "15": "თხუთმეტი", "500": "ხუთასი", "200": "ორასი",
    "200-მდე": "ორასამდე", "3": "სამ", "1122": "ათას ას ოცდაორ",
}
paragraphs = [p.strip() for p in open(text_path, encoding="utf-8").read().split("\n\n") if p.strip()]
words = []  # [text, paragraph, weight, break strength after]
for pi, para in enumerate(paragraphs):
    for tok in para.split():
        core = tok.strip("„“\"«».,!?:;…")
        if tok in ("—", "–"):
            # A dash is shown with the words around it; the voice usually pauses there.
            if words:
                words[-1][3] = max(words[-1][3], 1)
            words.append([tok, pi, 0.0, 0])
            continue
        spoken = SPOKEN.get(core, core)
        letters = len(re.findall(r"[ა-ჰ]", spoken)) or len(spoken)
        weight = letters + 1.6
        strength = 2 if re.search(r"[.!?…:]\W*$", tok) else 1 if re.search(r"[,;]\W*$", tok) else 0
        words.append([tok, pi, weight, strength])
    words[-1][3] = 3  # end of paragraph
words[-1][3] = 0  # the end of the text is the end of speech (an anchor of its own)

cum = [0.0]
for wd in words:
    cum.append(cum[-1] + wd[2])
breaks = [(i + 1, wd[3]) for i, wd in enumerate(words) if wd[3] > 0]  # (words before the break, strength)

# ---- Matching breaks to pauses (dynamic programming) -------------------------------------------------------------
# Anchor k: text position cum[a] matched to audio time (end of speech before, start of speech after).
A = [(0, 3)] + breaks + [(len(words), 3)]
P = [(first, first)] + pauses + [(last, last)]
speech_total = (last - first) - sum(e - s for s, e in pauses)
rate0 = speech_total / cum[-1]
SKIP_BREAK = {1: 0.25, 2: 2.0, 3: 5.0}

def skip_pause_cost(j):
    length = P[j][1] - P[j][0]
    return 4.0 if length >= 0.5 else 1.4 if length >= 0.3 else 0.3

INF = float("inf")
nA, nP = len(A), len(P)
best = {(0, 0): (0.0, None)}
WIN_A, WIN_P = 6, 8
for i in range(1, nA):
    for j in range(1, nP):
        # The last anchor (end of text) must meet the last "pause" (end of speech) and nothing else.
        if (i == nA - 1) != (j == nP - 1):
            continue
        cand = None
        for i2 in range(max(0, i - WIN_A), i):
            for j2 in range(max(0, j - WIN_P), j):
                prev = best.get((i2, j2))
                if prev is None:
                    continue
                text = cum[A[i][0]] - cum[A[i2][0]]
                inner = sum(P[k][1] - P[k][0] for k in range(j2 + 1, j))
                audio = P[j][0] - P[j2][1] - inner
                if text <= 0 or audio <= 0.05:
                    continue
                cost = prev[0] + 5.0 * abs(math.log((audio / text) / rate0))
                cost += sum(SKIP_BREAK[A[k][1]] for k in range(i2 + 1, i))
                cost += sum(skip_pause_cost(k) for k in range(j2 + 1, j))
                # A long pause at a weak break, or a short one at a sentence end, is a slightly worse match.
                length = P[j][1] - P[j][0]
                if A[i][1] >= 2 and length < 0.3:
                    cost += 0.8
                if cand is None or cost < cand[0]:
                    cand = (cost, (i2, j2))
        if cand:
            best[(i, j)] = cand
end = (nA - 1, nP - 1)
assert end in best, "no alignment found"
path = []
node = end
while node is not None:
    path.append(node)
    node = best[node][1]
path.reverse()
matched_strong = sum(1 for i, j in path[1:-1] if A[i][1] >= 2)
print(f"anchors {len(path)}; sentence/paragraph ends matched {matched_strong}/{sum(1 for a in A[1:-1] if a[1] >= 2)}; cost {best[end][0]:.1f}")

# ---- Word times between anchors ----------------------------------------------------------------------------------
times = [None] * len(words)
for (i2, j2), (i, j) in zip(path, path[1:]):
    w0, w1 = A[i2][0], A[i][0]
    t0, t1 = P[j2][1], P[j][0]
    inner = [P[k] for k in range(j2 + 1, j)]
    # Speech time inside the segment, skipping the inner pauses.
    speech = (t1 - t0) - sum(e - s for s, e in inner)
    total = cum[w1] - cum[w0]

    def real(st):
        """Speech time from t0 → real time (inner pauses inserted)."""
        t = t0 + st
        for s, e in inner:
            if t > s:
                t += e - s
        return t

    bounds = [(cum[k] - cum[w0]) / total * speech for k in range(w0, w1 + 1)]
    # Snap the word boundary nearest to each inner pause onto that pause.
    real_b = [real(b) for b in bounds]
    starts = real_b[:-1]
    ends = real_b[1:]
    for s, e in inner:
        k = min(range(1, len(real_b) - 1), key=lambda m: abs(real_b[m] - (s + e) / 2), default=None)
        if k is not None:
            ends[k - 1] = s
            starts[k] = e
    for m, k in enumerate(range(w0, w1)):
        times[k] = (round(starts[m], 2), round(max(starts[m], ends[m]), 2))

# ---- Write -------------------------------------------------------------------------------------------------------------
out = []
for pi in range(len(paragraphs)):
    out.append([[wd[0], times[k][0], times[k][1]] for k, wd in enumerate(words) if wd[1] == pi])
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generated by scripts/history/align-narration.py — word timings of public/history/didgori-narration.mp3.\n")
    f.write("// [word, start s, end s] per paragraph.\n")
    f.write(f"export const NARRATION_DURATION = {duration:.2f};\n")
    f.write("export const NARRATION_WORDS: [string, number, number][][] = ")
    f.write(json.dumps(out, ensure_ascii=False))
    f.write(";\n")
print("words", len(words), "->", out_path)
