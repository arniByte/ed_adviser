"""Саундтрек ролика: 120 BPM, 81 секунда, всё синтезируется здесь же.
Сцены меняются на долях: 6, 10, 17, 31, 39, 49, 56, 60, 67, 73 с."""
import numpy as np, wave, sys

SR = 44100
DUR = 81.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)

def t_(d): return np.arange(int(SR * d)) / SR
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N: return
    sig = sig[: N - i]
    L[i:i+len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i:i+len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))
def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * np.asarray(cutoff) / SR)
    y = np.empty_like(x); acc = 0.0
    a = np.broadcast_to(a, x.shape)
    for k in range(len(x)):
        acc = (1 - a[k]) * x[k] + a[k] * acc; y[k] = acc
    return y
def fft_lowpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))
def bandpass(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))
def env(n, a, d, s=0.0, r=0.0):
    e = np.ones(n) * s
    na = max(1, int(a * SR)); nd = max(1, int(d * SR))
    e[:na] = np.linspace(0, 1, na)
    e[na:na+nd] = np.linspace(1, s, min(nd, max(0, n - na)))[: len(e[na:na+nd])]
    if r: nr = int(r * SR); e[-nr:] *= np.linspace(1, 0, nr)
    return e
def hz(m): return 440 * 2 ** ((m - 69) / 12)

# Аккорды по два такта (4 с): Fmaj7, Am7, Dm9, Cmaj7/E
CHORDS = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 57, 60, 64, 65], [52, 55, 59, 64]]
ROOTS = [41, 45, 38, 40]
def chord_at(t): return int(t // 4) % 4

# Пэд: расстроенные пилы через мягкий фильтр, весь трек.
for bar in range(int(DUR // 4) + 1):
    at = bar * 4.0
    ch = CHORDS[bar % 4]
    tt = t_(4.4)
    sig = np.zeros(len(tt))
    for m in ch:
        for det in (-0.12, 0.0, 0.11):
            f = hz(m + 12) * 2 ** (det / 12)
            sig += 2 * ((tt * f + rng.random()) % 1) - 1
    sig = fft_lowpass(sig, 900 if 3 <= bar <= 17 else 520)
    sig *= env(len(tt), 0.9, 0.1, 1.0, 1.2)
    open_ = 0.55 if bar < 2 else 0.4
    if bar >= 18: open_ = 0.5
    add(sig / 14, at, open_, pan=-0.2 if bar % 2 else 0.2)

def in_drums(t): return 6.0 <= t < 75.0 and not (29.0 <= t < 31.0)

# Бочка и сайдчейн
duck = np.ones(N)
for k in range(int(DUR / BEAT)):
    at = k * BEAT
    if not in_drums(at): continue
    tt = t_(0.42)
    f = 46 + 110 * np.exp(-tt * 28)
    kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    kick += 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-tt * 40)
    add(kick, at, 0.9)
    i = int(at * SR); n = int(0.3 * SR)
    duck[i:i+n] = np.minimum(duck[i:i+n], 1 - 0.55 * np.exp(-np.arange(n) / SR * 11)[: len(duck[i:i+n])])

# Бас восьмыми, с откатом под бочку
for k in range(int(DUR / (BEAT / 2))):
    at = k * BEAT / 2
    if not in_drums(at) or at < 10: continue
    m = ROOTS[chord_at(at)] - 12 + (12 if k % 4 == 3 else 0)
    tt = t_(0.24)
    s = np.sin(2 * np.pi * hz(m) * tt) + 0.25 * np.sin(4 * np.pi * hz(m) * tt)
    add(s * env(len(tt), 0.005, 0.2, 0.3, 0.05), at, 0.32)

# Хэты на офф-биты, шейкер шестнадцатыми с середины
for k in range(int(DUR / (BEAT / 4))):
    at = k * BEAT / 4
    if not in_drums(at) or at < 10: continue
    off = (k % 4 == 2)
    n = rng.standard_normal(int(0.06 * SR))
    h = bandpass(n, 7000, 16000) * np.exp(-np.arange(len(n)) / SR * (60 if off else 120))
    add(h, at, 0.22 if off else (0.07 if at >= 16 else 0), pan=0.3 if off else -0.3)

# Хлопок на 2 и 4
for k in range(int(DUR / BEAT)):
    at = k * BEAT
    if not in_drums(at) or at < 16 or k % 2 == 0: continue
    n = rng.standard_normal(int(0.25 * SR))
    c = bandpass(n, 900, 5000)
    e = np.exp(-np.arange(len(n)) / SR * 22)
    for d in (0, 0.011, 0.023): add(c * e, at + d, 0.12)

# Арпеджио-плак шестнадцатыми в основной части
pattern = [0, 2, 1, 3, 2, 1, 3, 0]
for k in range(int(DUR / (BEAT / 2))):
    at = k * BEAT / 2
    if not (17 <= at < 73) or (29 <= at < 31): continue
    ch = CHORDS[chord_at(at)]
    m = ch[pattern[k % 8] % len(ch)] + 24
    tt = t_(0.35)
    f = hz(m)
    s = 2 * np.abs(2 * ((tt * f) % 1) - 1) - 1
    s = fft_lowpass(s, 2600) * np.exp(-tt * 11)
    add(s, at, 0.09, pan=0.45 if k % 2 else -0.45)
    add(s, at + 0.375, 0.04, pan=-0.45 if k % 2 else 0.45)  # эхо на точку

# Звуковой дизайн
def whoosh(at, d=0.9, gain=0.35, up=True):
    n = rng.standard_normal(int(d * SR))
    tt = np.arange(len(n)) / SR
    cut = 300 + 7000 * ((tt / d) if up else (1 - tt / d)) ** 2
    s = np.zeros(len(n)); acc = 0
    a = np.exp(-2 * np.pi * cut / SR)
    for i in range(len(n)): acc = (1 - a[i]) * n[i] + a[i] * acc; s[i] = acc
    s *= np.sin(np.pi * tt / d) ** 2
    add(s, at - d * (0.75 if up else 0.1), gain, pan=-0.4)
    add(s[::-1] if not up else s, at - d * (0.75 if up else 0.1), gain * 0.8, pan=0.4)

def impact(at, gain=0.8):
    tt = t_(2.4)
    boom = np.sin(2 * np.pi * (38 + 40 * np.exp(-tt * 6)) * tt) * np.exp(-tt * 2.2)
    n = rng.standard_normal(len(tt))
    tail = fft_lowpass(n, 1800) * np.exp(-tt * 3) * 0.25
    add(boom + tail, at, gain)

def riser(at, d):
    tt = t_(d)
    f = 200 * 2 ** (tt / d * 3)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3
    n = bandpass(rng.standard_normal(len(tt)), 2000, 9000) * 0.6
    s = (s + n) * (tt / d) ** 2.5
    add(s, at, 0.25)

def tick(at, gain=0.18, pitch=2400):
    tt = t_(0.05)
    s = np.sin(2 * np.pi * pitch * tt) * np.exp(-tt * 140)
    add(s, at, gain)

def chime(at, gain=0.2):
    tt = t_(1.6)
    s = sum(np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * (3 + i)) for i, m in enumerate([84, 88, 91]))
    add(s / 3, at, gain, pan=0.2)

riser(3.0, 3.0)
impact(6.0, 0.9)
for at in (10, 17, 31, 39, 49, 56, 60, 67, 73): whoosh(at, 0.8, 0.3)
impact(17.0, 0.35); impact(39.0, 0.3); impact(73.0, 0.5)
# Слова хука появляются со щелчками
for at in (0.5, 0.9, 1.8, 2.3, 3.4, 4.0): tick(at, 0.12, 1900)
# Пруф: три галочки
for at in (36.7, 37.0, 37.3): chime(at, 0.12)
# Цифры
for at in (41.0, 43.0, 45.6): tick(at, 0.22, 1700)
for at in (67.5, 69.0, 70.5): tick(at, 0.3, 1500); chime(at + 0.02, 0.08)

# Сайдчейн на пэд и бас целиком (простое приближение) и ревер
L *= duck; R *= duck
ir_t = t_(2.2)
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
ir = fft_lowpass(ir, 5000); ir /= np.abs(ir).sum() ** 0.5 * 18
def conv(x):
    n = len(x) + len(ir)
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
L = L + 0.35 * conv(L); R = R + 0.35 * conv(R)

# Финал: затухание
fade = np.ones(N); nf = int(4.0 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 1.5
L *= fade; R *= fade
mix = np.stack([L, R], 1)
mix /= np.abs(mix).max() / 0.95
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape)
