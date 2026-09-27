# Trilha original do comercial (sintetizada aqui, sem direitos de terceiros).
# 120 BPM: 1 tempo = 0,5 s, 1 compasso = 2 s. Os cortes do video caem nos compassos.
import numpy as np, wave, sys
SR = 44100
DUR = 28.0
N = int(SR * DUR)
t_all = np.arange(N) / SR
mix_pad = np.zeros(N); mix_bass = np.zeros(N); mix_drum = np.zeros(N); mix_fx = np.zeros(N)
rng = np.random.default_rng(7)

def nota(n):  # nome -> Hz (A4 = 440)
    nomes = {'C':-9,'C#':-8,'D':-7,'D#':-6,'E':-5,'F':-4,'F#':-3,'G':-2,'G#':-1,'A':0,'A#':1,'B':2}
    return 440 * 2 ** ((nomes[n[:-1]] + 12 * (int(n[-1]) - 4)) / 12)

def env(n, a, d, sus=1.0, r=None):
    e = np.ones(n) * sus
    ia = max(1, int(a * SR)); e[:ia] = np.linspace(0, 1, ia) ** 2
    if r:
        ir = min(n, int(r * SR)); e[-ir:] *= np.linspace(1, 0, ir) ** 1.5
    return e

def add(buf, start, sig):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig)); buf[i:j] += sig[:j - i]

def pad_chord(start, dur, notas, amp=.08):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for nt in notas:
        f = nota(nt)
        for det in (-0.12, 0.0, 0.12):           # tres osciladores levemente desafinados
            ff = f * 2 ** (det / 12)
            for h in range(1, 7):                  # serra suave (harmonicos ate 6)
                s += np.sin(2 * np.pi * ff * h * tt + h) / (h ** 1.35)
    s *= env(n, .35, 0, 1, .6) * amp / len(notas)
    add(mix_pad, start, s)

def baixo(start, dur, nt, amp=.32):
    n = int(dur * SR); tt = np.arange(n) / SR; f = nota(nt)
    s = np.sin(2 * np.pi * f * tt) + .35 * np.sin(4 * np.pi * f * tt)
    s *= np.exp(-tt * 5) * env(n, .005, 0, 1, .04) * amp
    add(mix_bass, start, s)

def bumbo(start, amp=.9):
    n = int(.45 * SR); tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7.5) * amp
    s[:60] += rng.normal(0, .3, 60) * np.linspace(1, 0, 60)   # clique do ataque
    add(mix_drum, start, s)

def chimbal(start, amp=.10, dec=45):
    n = int(.12 * SR); tt = np.arange(n) / SR
    s = np.diff(rng.normal(0, 1, n + 1)) * np.exp(-tt * dec) * amp
    add(mix_drum, start, s)

def palma(start, amp=.28):
    n = int(.25 * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for k, o in enumerate((0, .011, .022)):
        io = int(o * SR); ruido = np.diff(rng.normal(0, 1, n + 1))
        s[io:] += ruido[:n - io] * np.exp(-tt[:n - io] * (60 if k < 2 else 16))
    add(mix_drum, start, s * amp * .5)

def sino(start, nt, amp=.22, dec=3.2):
    n = int(2.2 * SR); tt = np.arange(n) / SR; f = nota(nt)
    s = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 6)) * np.exp(-tt * dec) * amp
    s[:200] *= np.linspace(0, 1, 200)
    add(mix_fx, start, s)

def prato(start, amp=.10):
    n = int(1.6 * SR); tt = np.arange(n) / SR
    s = np.diff(rng.normal(0, 1, n + 1)) * np.exp(-tt * 2.6) * amp
    add(mix_fx, start, s)

def subida(start, dur, amp=.10):  # ruido que sobe antes de um corte
    n = int(dur * SR); tt = np.arange(n) / SR
    s = np.diff(rng.normal(0, 1, n + 1)) * (tt / dur) ** 2 * amp
    add(mix_fx, start, s)

C = ['C4', 'E4', 'G4', 'B4']; G = ['G3', 'B3', 'D4', 'A4']; Am = ['A3', 'C4', 'E4', 'G4']; F = ['F3', 'A3', 'C4', 'E4']
PROG = [(C, 'C2'), (G, 'G1'), (Am, 'A1'), (F, 'F1')]

# 0-2 s: abertura escura (acorde e sinos nas palavras)
pad_chord(0, 2.2, Am, .06)
for k, tt in enumerate((.15, .53, .91, 1.29)):
    sino(tt, ['E5', 'G5', 'A5', 'C6'][k], .16)
subida(1.2, .8, .08)

# 2-21 s: groove (bumbo 4/4, chimbal no contratempo, palma no 2 e 4 a partir de 6 s)
for bar in range(1, 11):            # compassos que comecam em 2, 4, ..., 20
    b0 = bar * 2.0
    acorde, raiz = PROG[(bar - 1) % 4]
    fim = min(2.0, 21.0 - b0)
    if fim <= 0: break
    pad_chord(b0, fim + .3, acorde, .075 if b0 >= 6 else .06)
    for beat in range(4):
        tb = b0 + beat * .5
        if tb >= 21: break
        bumbo(tb, .85 if b0 >= 6 else .7)
        chimbal(tb + .25, .09 if b0 >= 6 else .05)
        if b0 >= 10 and beat % 2 == 1: palma(tb)
        if b0 >= 6:
            for e in (0, .25):
                if tb + e < 21: baixo(tb + e, .24, raiz)
    if b0 >= 14:
        for e in range(8): chimbal(b0 + e * .25 + .125, .04, 70)   # mais energia no resultado
sino(2.0, 'C6', .12); prato(2.0, .07); prato(6.0, .09); prato(14.0, .09); prato(18.0, .08)
subida(5.2, .8); subida(9.2, .8, .07); subida(13.2, .8); subida(17.2, .8, .07); subida(20.2, .8, .12)
sino(15.8, 'G5', .12); sino(16.05, 'C6', .12)       # moeda da economia

# 21-24 s: tres batidas fortes (Gratis. Rapido. Seguro.)
for k, tt in enumerate((21.0, 22.0, 23.0)):
    bumbo(tt, 1.0); prato(tt, .11)
    pad_chord(tt, .9, [C, G, Am][k], .09)
    baixo(tt, .6, ['C2', 'G1', 'A1'][k], .38)
subida(23.3, .7, .12)

# 24-28 s: final (acorde aberto + sino do logo)
final = ['C3', 'G3', 'E4', 'D5', 'G5']
pad_chord(24.0, 4.0, final, .11)
baixo(24.0, 1.8, 'C2', .30)
bumbo(24.0, .9); prato(24.0, .12)
sino(24.05, 'C6', .24, 1.6); sino(24.45, 'G6', .14, 1.8)

# reverb simples (convolucao com cauda de ruido) no pad e nos sinos
def reverb(x, seg=1.4, mix=.22):
    n = int(seg * SR); ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 4.2); ir /= np.sqrt(np.sum(ir ** 2))
    L = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    return x * (1 - mix) + y * mix

# "respiracao" do pad e do baixo com o bumbo (sidechain)
duck = np.ones(N)
for bar in range(1, 11):
    for beat in range(4):
        tb = bar * 2 + beat * .5
        if tb >= 21: continue
        i = int(tb * SR); n = int(.3 * SR)
        duck[i:i + n] = np.minimum(duck[i:i + n], 1 - .55 * np.exp(-np.arange(n) / SR * 12))
pad = reverb(mix_pad * duck)
fx = reverb(mix_fx, 1.8, .3)
master = pad + mix_bass * duck + mix_drum + fx

# fade final e limitador suave
fade = np.ones(N); i = int(26.2 * SR); fade[i:] = np.linspace(1, 0, N - i) ** 1.6
master *= fade
master = np.tanh(master * 1.4) / np.tanh(1.4)
master /= np.max(np.abs(master)) / 0.89

est = np.stack([master, master], axis=1)
pcm = (np.clip(est, -1, 1) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', sys.argv[1], DUR, 's')
