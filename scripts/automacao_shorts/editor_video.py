"""Montagem vertical 9:16 (1080x1920, 30 fps) com legendas dinâmicas.

- Cenas ajustadas ao tempo da narração (câmera lenta suave até 1,6x; mais
  que isso, as cenas se repetem).
- Loop perfeito: os últimos 0,5 s se fundem no 1º quadro da 1ª cena.
- Legendas grandes no terço de baixo (acima da interface do Shorts), em
  blocos de até 4 palavras; na comparação, o cartão de preço no alto com o
  preço do anúncio comparado riscado e o frete em linha própria.
- Aviso fixo discreto: "Preço conferido em dd/mm às hh:mm · pode mudar".
- Trilha opcional (SHORTS_TRILHA = caminho de um mp3 com licença) bem baixa.
ffmpeg: FFMPEG_BIN, o do sistema ou o do pacote imageio-ffmpeg.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
from pathlib import Path

from .config import Config
from .gerador_roteiro import Roteiro
from .voz_narracao import Narracao

log = logging.getLogger("shorts.editor")

LARGURA, ALTURA, FPS = 1080, 1920, 30


def ffmpeg_bin(cfg: Config) -> str:
    if cfg.ffmpeg:
        return cfg.ffmpeg
    achado = shutil.which("ffmpeg")
    if achado:
        return achado
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # noqa: BLE001
        raise RuntimeError("ffmpeg não encontrado: instale o ffmpeg ou 'pip install imageio-ffmpeg'") from e


def duracao(ffmpeg: str, arquivo: Path) -> float:
    proc = subprocess.run([ffmpeg, "-hide_banner", "-i", str(arquivo)], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not m:
        raise RuntimeError(f"não consegui ler a duração de {arquivo.name}")
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def tempos_estimados(r: Roteiro, total: float) -> list[tuple[float, float]]:
    """Sem tempos da voz: cada trecho ocupa a fatia do seu tamanho."""
    tamanhos = [max(1, len(t.fala)) for t in r.trechos]
    soma = sum(tamanhos)
    tempos, ini = [], 0.0
    for n in tamanhos:
        fim = ini + total * n / soma
        tempos.append((ini, fim))
        ini = fim
    return tempos


def _ts(seg: float) -> str:
    seg = max(0.0, seg)
    h = int(seg // 3600)
    m = int(seg % 3600 // 60)
    s = seg % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _esc(texto: str) -> str:
    return texto.replace("\\", "/").replace("{", "(").replace("}", ")").replace("\n", "\\N")


def _blocos(texto: str, max_palavras: int = 4, max_chars: int = 26) -> list[str]:
    blocos, atual = [], []
    for palavra in texto.split():
        if atual and (len(atual) >= max_palavras or len(" ".join(atual + [palavra])) > max_chars):
            blocos.append(" ".join(atual))
            atual = []
        atual.append(palavra)
    if atual:
        blocos.append(" ".join(atual))
    return blocos


def escrever_ass(r: Roteiro, tempos: list[tuple[float, float]], total: float, caminho: Path, fonte: str) -> None:
    linhas = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {LARGURA}",
        f"PlayResY: {ALTURA}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Legenda,{fonte},80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,7,0,2,90,150,560,1",
        f"Style: Destaque,{fonte},88,&H0000D7FF,&H0000D7FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,7,0,2,90,150,560,1",
        f"Style: Preco,{fonte},54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,3,16,0,8,70,70,330,1",
        f"Style: Aviso,{fonte},34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,0,8,90,90,200,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    if r.conferido_texto:
        linhas.append(
            f"Dialogue: 0,{_ts(0)},{_ts(total)},Aviso,,0,0,0,,{_esc(f'Preço conferido em {r.conferido_texto} · pode mudar')}"
        )
    for trecho, (ini, fim) in zip(r.trechos, tempos):
        if trecho.parte == "comparacao":
            partes = [p for p in trecho.legenda.split("\n") if p.strip()]
            # Cartão de preço no alto: o preço comparado riscado.
            cartao = []
            for i, p in enumerate(partes):
                if i == 0 and ":" in p:
                    rotulo, valor = p.split(":", 1)
                    cartao.append(f"{_esc(rotulo)}: {{\\s1}}{_esc(valor.strip())}{{\\s0}}")
                elif i == 1:
                    cartao.append(f"{{\\c&H005EC522&}}{_esc(p)}{{\\c&H00FFFFFF&}}")
                else:
                    cartao.append(_esc(p))
            texto_cartao = "\\N".join(cartao)
            linhas.append(f"Dialogue: 1,{_ts(ini)},{_ts(fim)},Preco,,0,0,0,,{texto_cartao}")
            blocos = partes
            estilo = "Destaque"
        else:
            blocos = _blocos(trecho.legenda if trecho.parte != "valor" else trecho.legenda.replace(" · ", " "))
            estilo = "Destaque" if trecho.parte == "gancho" else "Legenda"
        tamanhos = [max(1, len(b)) for b in blocos]
        soma = sum(tamanhos)
        t = ini
        for b, n in zip(blocos, tamanhos):
            fim_b = t + (fim - ini) * n / soma
            linhas.append(f"Dialogue: 0,{_ts(t)},{_ts(fim_b)},{estilo},,0,0,0,,{_esc(b)}")
            t = fim_b
    caminho.write_text("\n".join(linhas) + "\n", encoding="utf-8")


def montar(cfg: Config, r: Roteiro, narracao: Narracao, cenas: list[Path], pasta: Path) -> Path:
    ffmpeg = ffmpeg_bin(cfg)
    pasta.mkdir(parents=True, exist_ok=True)
    voz = duracao(ffmpeg, narracao.arquivo)
    total = round(voz + 0.4, 2)
    tempos = narracao.tempos_trechos or tempos_estimados(r, voz)
    escrever_ass(r, tempos, total, pasta / "legendas.ass", cfg.fonte_legenda)

    duracoes = [duracao(ffmpeg, c) for c in cenas]
    soma = sum(duracoes)
    fator = total / soma if soma else 1.0
    lista = list(cenas)
    while fator > 1.6:  # cenas curtas demais: repete, na mesma ordem
        lista += cenas
        soma += sum(duracoes)
        fator = total / soma
    fator = max(fator, 0.6)

    entradas: list[str] = []
    filtros: list[str] = []
    norm = f"scale={LARGURA}:{ALTURA}:force_original_aspect_ratio=increase,crop={LARGURA}:{ALTURA},setsar=1"
    for i, c in enumerate(lista):
        entradas += ["-i", str(c.resolve())]
        filtros.append(f"[{i}:v]{norm},setpts={fator:.4f}*(PTS-STARTPTS),fps={FPS},format=yuv420p,settb=AVTB[v{i}]")
    n = len(lista)
    filtros.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[base]")
    # Loop: cauda com o 1º quadro da 1ª cena.
    entradas += ["-i", str(cenas[0].resolve())]
    filtros.append(f"[{n}:v]{norm},trim=0:0.6,setpts=PTS-STARTPTS,fps={FPS},format=yuv420p,settb=AVTB[cauda]")
    filtros.append(f"[base][cauda]xfade=transition=fade:duration=0.5:offset={max(0.1, total - 0.5):.2f}[vx]")
    fontes = os.environ.get("SHORTS_FONTES_DIR")
    sub = "subtitles=legendas.ass" + (f":fontsdir={fontes}" if fontes else "")
    filtros.append(f"[vx]trim=0:{total:.2f},setpts=PTS-STARTPTS,{sub}[vout]")

    entradas += ["-i", str(narracao.arquivo.resolve())]
    ia = n + 1
    trilha = os.environ.get("SHORTS_TRILHA")
    if trilha and Path(trilha).exists():
        entradas += ["-stream_loop", "-1", "-i", str(Path(trilha).resolve())]
        filtros.append(f"[{ia}:a]aresample=48000,apad[voz]")
        filtros.append(f"[{ia + 1}:a]aresample=48000,volume=0.12[musica]")
        filtros.append("[voz][musica]amix=inputs=2:duration=first:dropout_transition=0[aout]")
    else:
        filtros.append(f"[{ia}:a]aresample=48000,apad[aout]")

    saida = pasta / "short.mp4"
    cmd = [
        ffmpeg, "-hide_banner", "-y", *entradas,
        "-filter_complex", ";".join(filtros),
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        "-t", f"{total:.2f}", str(saida.name),
    ]
    log.info("montando %s (%.1f s, %d cenas, fator %.2f)", saida, total, n, fator)
    proc = subprocess.run(cmd, cwd=pasta, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg falhou: {proc.stderr[-1500:]}")
    return saida
