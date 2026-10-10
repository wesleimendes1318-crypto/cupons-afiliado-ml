"""Narração com voz humana (pausas e entonação de criador de conteúdo).

1º ElevenLabs (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID: escolha na
   biblioteca uma voz brasileira expressiva, estilo unboxing/criador), pelo
   endpoint /v1/text-to-speech/{voz}/with-timestamps, que devolve o áudio e o
   tempo de cada letra (as legendas saem sincronizadas).
2º Reserva: OpenAI gpt-4o-mini-tts com instruções de tom (sem tempos: a
   legenda é distribuída pelo tamanho de cada trecho).
As pausas vêm da pontuação do roteiro (vírgula, ponto, reticências).
"""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field
from pathlib import Path

import requests

from .config import Config
from .gerador_roteiro import Roteiro

log = logging.getLogger("shorts.voz")


@dataclass
class Narracao:
    arquivo: Path
    texto: str
    # (início, fim) de cada trecho do roteiro, em segundos; vazio = estimar.
    tempos_trechos: list[tuple[float, float]] = field(default_factory=list)
    motor: str = ""


def _tempos_pelos_caracteres(r: Roteiro, inicios: list[float], fins: list[float]) -> list[tuple[float, float]]:
    """Início/fim de cada trecho a partir do tempo de cada caractere."""
    tempos = []
    pos = 0
    for t in r.trechos:
        ini = pos
        fim = pos + len(t.fala) - 1
        pos = fim + 2  # o espaço que junta os trechos
        if fim >= len(inicios):
            return []
        tempos.append((inicios[ini], fins[fim]))
    return tempos


def _elevenlabs(cfg: Config, r: Roteiro, destino: Path) -> Narracao:
    texto = r.texto_falado
    resp = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.elevenlabs_voz}/with-timestamps",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": cfg.elevenlabs_chave or "", "Content-Type": "application/json"},
        json={
            "text": texto,
            "model_id": cfg.elevenlabs_modelo,
            "voice_settings": {
                "stability": 0.35,
                "similarity_boost": 0.8,
                "style": 0.45,
                "use_speaker_boost": True,
            },
        },
        timeout=120,
    )
    resp.raise_for_status()
    dados = resp.json()
    destino.write_bytes(base64.b64decode(dados["audio_base64"]))
    al = dados.get("alignment") or dados.get("normalized_alignment") or {}
    inicios = al.get("character_start_times_seconds") or []
    fins = al.get("character_end_times_seconds") or []
    tempos = _tempos_pelos_caracteres(r, inicios, fins) if len(inicios) == len(texto) else []
    return Narracao(destino, texto, tempos, "elevenlabs")


def _openai(cfg: Config, r: Roteiro, destino: Path) -> Narracao:
    resp = requests.post(
        "https://api.openai.com/v1/audio/speech",
        headers={"Authorization": f"Bearer {cfg.openai_chave}"},
        json={
            "model": "gpt-4o-mini-tts",
            "voice": cfg.openai_voz,
            "input": r.texto_falado,
            "instructions": (
                "Português do Brasil. Fale como um criador de conteúdo brasileiro mostrando um "
                "achadinho para um amigo: animado sem exagero, ritmo rápido, pausas curtas de "
                "respiração nas vírgulas e nos pontos, nada de tom de locutor ou de robô."
            ),
            "response_format": "mp3",
        },
        timeout=120,
    )
    resp.raise_for_status()
    destino.write_bytes(resp.content)
    return Narracao(destino, r.texto_falado, [], "openai")


def narrar(cfg: Config, r: Roteiro, pasta: Path) -> Narracao:
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / "narracao.mp3"
    erros = []
    if cfg.elevenlabs_chave and cfg.elevenlabs_voz:
        try:
            return _elevenlabs(cfg, r, destino)
        except (requests.RequestException, KeyError, ValueError) as e:
            erros.append(f"ElevenLabs: {e}")
            log.warning("ElevenLabs falhou: %s", e)
    if cfg.openai_chave:
        try:
            return _openai(cfg, r, destino)
        except requests.RequestException as e:
            erros.append(f"OpenAI: {e}")
    raise RuntimeError(
        "Sem narração: configure ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID (ou OPENAI_API_KEY). "
        + "; ".join(erros)
    )
