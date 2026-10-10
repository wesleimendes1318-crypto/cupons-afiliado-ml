"""Cenas realistas pelo Higgsfield (imagem para vídeo, a partir da FOTO REAL
do produto, para o produto do vídeo ser o mesmo do anúncio).

API oficial (docs.higgsfield.ai, conferido em 10/10):
  POST https://api.higgsfield.ai/<modelo>   (ex.: kling-video/v2.6/pro/image-to-video)
  Authorization: Key <HF_API_KEY_ID>:<HF_API_KEY_SECRET>
  Idempotency-Key: <id>  (repetir o envio não cobra duas vezes)
  corpo: prompt, image_url, duration (5|10), aspect_ratio ("9:16"), sound ("off")
  resposta: request_id, status_url; status queued -> in_progress ->
  completed (video.url) | failed | nsfw | canceled. Saída guardada >= 7 dias.

Estilo (Weslei, 10/10): nada de render 3D, objeto flutuando ou escala
errada. A foto do anúncio costuma ser de fundo branco; como o 1º quadro do
vídeo é a própria foto, o padrão é o ESTÚDIO CLEAN (fundo infinito, luz
suave, movimentos lentos). SHORTS_ESTILO=ambiente pede o cenário da
categoria (mesa clara, bancada de cozinha, penteadeira); é experimental,
porque o modelo precisa "abrir" o cenário a partir da foto.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from pathlib import Path

import requests

from .config import Config
from .radar_produtos import Produto

log = logging.getLogger("shorts.higgsfield")
BASE = "https://api.higgsfield.ai"

FIEL = (
    "Keep the product exactly as in the reference image: same shape, colors, logos, buttons, "
    "proportions and number of parts. Photorealistic footage shot on a real cinema camera, "
    "natural light falloff, real material textures (matte plastic, brushed metal, real fabric "
    "with stitching, glass with imperfect reflections), true-to-life scale. "
    "Avoid: CGI or 3D render look, floating or levitating objects, morphing, melting, extra "
    "parts, added text, added logos, watermarks, people, faces, sudden cuts, teleporting objects."
)

ESTUDIO = [
    "Slow, smooth dolly-in toward the product on a seamless light backdrop, soft key light from "
    "the left, gentle natural shadow under the product, shallow depth of field.",
    "Slow macro drift across the product details, organic rack focus from the front edge to the "
    "main detail, soft highlights moving across the surface, natural bokeh.",
    "Slow 20-degree orbit around the product at table height, steady gimbal movement, a soft "
    "light sweep crossing the surface, realistic reflections.",
    "Slow, smooth dolly-out that ends on the same centered framing as the reference image, so "
    "the clip can loop seamlessly.",
]

AMBIENTE = {
    "tecnologia": "on a light wood desk in a real minimalist home office, soft indirect lamp light, "
    "a keyboard and a plant softly out of focus in the background",
    "casa": "on a real granite kitchen countertop in a bright clean Brazilian kitchen, soft "
    "morning sunlight coming through a window",
    "beleza": "on a bathroom counter in front of a mirror, soft diffused vanity light, a folded "
    "towel slightly out of focus",
    "brinquedos": "on a light wooden floor in a bright kid's room, soft daylight from a window, "
    "colorful toys softly out of focus far in the background",
    "outros": "on a light wooden table in a bright Brazilian home, soft daylight from a window",
}

MOVIMENTOS_AMBIENTE = [
    "The camera slowly pulls back revealing the product resting {lugar}.",
    "Slow macro drift across the product details {lugar}, organic rack focus, natural bokeh.",
    "Slow steady orbit around the product {lugar}, keeping its real size relative to the "
    "objects around it.",
    "Slow dolly-in that ends on the same centered framing as the first frame, product {lugar}.",
]


def prompts_das_cenas(categoria: str, n: int, estilo: str | None = None) -> list[str]:
    estilo = (estilo or os.environ.get("SHORTS_ESTILO", "estudio")).lower()
    if estilo == "ambiente":
        lugar = AMBIENTE.get(categoria, AMBIENTE["outros"])
        base = [m.format(lugar=lugar) for m in MOVIMENTOS_AMBIENTE]
    else:
        base = ESTUDIO
    escolhidos = [base[i % len(base)] for i in range(n - 1)] + [base[-1]]  # a última fecha o loop
    return [f"{p} Vertical 9:16 framing. {FIEL}" for p in escolhidos]


def _cabecalhos(cfg: Config, idem: str | None = None) -> dict[str, str]:
    if not cfg.hf_id or not cfg.hf_segredo:
        raise RuntimeError("Falta HF_API_KEY_ID / HF_API_KEY_SECRET (Higgsfield Console).")
    h = {"Authorization": f"Key {cfg.hf_id}:{cfg.hf_segredo}", "Content-Type": "application/json"}
    if idem:
        h["Idempotency-Key"] = idem
    return h


def _enviar(cfg: Config, prompt: str, imagem: str, idem: str) -> dict:
    corpo = {
        "prompt": prompt,
        "image_url": imagem,
        "duration": cfg.duracao_cena,
        "aspect_ratio": "9:16",
        "sound": "off",
    }
    for tentativa in range(3):
        try:
            r = requests.post(f"{BASE}/{cfg.modelo_video}", headers=_cabecalhos(cfg, idem), json=corpo, timeout=60)
            if r.status_code in (429, 500, 502, 503) and tentativa < 2:
                time.sleep(10 * (tentativa + 1))
                continue
            r.raise_for_status()
            return r.json()
        except requests.ConnectionError:
            if tentativa == 2:
                raise
            time.sleep(10)
    raise RuntimeError("Higgsfield não aceitou o pedido")


def _baixar(url: str, destino: Path) -> None:
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(destino, "wb") as f:
            for parte in r.iter_content(1 << 16):
                f.write(parte)


def gerar_cenas(cfg: Config, produto: Produto, categoria: str, pasta: Path, prazo_s: int = 900) -> list[Path]:
    """Envia todas as cenas de uma vez e espera as respostas (até 15 min)."""
    if not produto.imagem:
        raise ValueError("produto sem foto")
    pasta.mkdir(parents=True, exist_ok=True)
    prompts = prompts_das_cenas(categoria, cfg.cenas)
    pedidos = []
    for i, prompt in enumerate(prompts):
        destino = pasta / f"cena_{i + 1}.mp4"
        if destino.exists() and destino.stat().st_size > 10_000:
            pedidos.append({"destino": destino, "pronto": True})
            continue
        idem = hashlib.sha1(f"{produto.chave}|{cfg.modelo_video}|{i}|{prompt}".encode()).hexdigest()
        resp = _enviar(cfg, prompt, produto.imagem, idem)
        log.info("cena %d enviada: %s", i + 1, resp.get("request_id"))
        pedidos.append({"destino": destino, "status_url": resp.get("status_url"), "pronto": False})

    limite = time.monotonic() + prazo_s
    while not all(p["pronto"] for p in pedidos):
        if time.monotonic() > limite:
            raise TimeoutError("o Higgsfield não terminou as cenas em 15 min")
        time.sleep(8)
        for p in pedidos:
            if p["pronto"]:
                continue
            r = requests.get(p["status_url"], headers=_cabecalhos(cfg), timeout=30)
            if r.status_code >= 500:
                continue
            r.raise_for_status()
            st = r.json()
            estado = st.get("status")
            if estado == "completed":
                url = (st.get("video") or {}).get("url")
                if not url:
                    raise RuntimeError("cena pronta sem video.url")
                _baixar(url, p["destino"])
                p["pronto"] = True
                log.info("cena pronta: %s", p["destino"].name)
            elif estado in {"failed", "nsfw", "canceled"}:
                raise RuntimeError(f"cena {p['destino'].name}: {estado} {st.get('error') or ''}".strip())
    return [p["destino"] for p in pedidos]
