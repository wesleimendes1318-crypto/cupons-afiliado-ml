"""Configuração por variável de ambiente (nada de chave no código)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PASTA = Path(__file__).resolve().parent
RAIZ_REPO = PASTA.parents[1]
CREDENCIAIS = Path(os.environ.get("SHORTS_CREDENCIAIS", str(RAIZ_REPO / "credenciais")))
SAIDA = Path(os.environ.get("SHORTS_SAIDA", str(PASTA / "saida")))

# Cota gratuita da YouTube Data API: 10.000 unidades por dia (zera à
# meia-noite do horário do Pacífico). Upload = 1.600; comentário = 50.
COTA_DIARIA = 10_000
CUSTO_UPLOAD = 1_600
CUSTO_COMENTARIO = 50
MAX_VIDEOS_DIA_TETO = 5


def _ler_arquivo_env(caminho: Path) -> dict[str, str]:
    """Lê KEY=VALOR de um .env (só para o endereço e a chave PÚBLICA do site)."""
    saida: dict[str, str] = {}
    try:
        for linha in caminho.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, v = linha.split("=", 1)
            saida[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return saida


def _int(nome: str, padrao: int) -> int:
    try:
        return int(os.environ.get(nome, padrao))
    except ValueError:
        return padrao


@dataclass(frozen=True)
class Config:
    # Banco do site: só leitura pública (a mesma chave publicável do site).
    supabase_url: str
    supabase_chave_publica: str
    # Higgsfield (Console > API keys): Authorization: Key <id>:<segredo>.
    hf_id: str | None
    hf_segredo: str | None
    modelo_video: str
    duracao_cena: int
    cenas: int
    # Narração.
    elevenlabs_chave: str | None
    elevenlabs_voz: str | None
    elevenlabs_modelo: str
    openai_chave: str | None
    openai_modelo: str
    openai_voz: str
    # YouTube.
    max_videos_dia: int
    privacidade: str
    categoria_youtube: str
    fonte_legenda: str
    ffmpeg: str | None


def carregar() -> Config:
    env_site = _ler_arquivo_env(RAIZ_REPO / ".env")
    url = os.environ.get("MELHORESCOLHA_SUPABASE_URL") or env_site.get("VITE_SUPABASE_URL", "")
    chave = os.environ.get("MELHORESCOLHA_SUPABASE_CHAVE_PUBLICA") or env_site.get(
        "VITE_SUPABASE_PUBLISHABLE_KEY", ""
    )
    privacidade = os.environ.get("SHORTS_PRIVACIDADE", "private").strip().lower()
    if privacidade not in {"private", "unlisted", "public"}:
        privacidade = "private"
    duracao = _int("SHORTS_DURACAO_CENA", 10)
    return Config(
        supabase_url=url.rstrip("/"),
        supabase_chave_publica=chave,
        hf_id=os.environ.get("HF_API_KEY_ID"),
        hf_segredo=os.environ.get("HF_API_KEY_SECRET"),
        modelo_video=os.environ.get("SHORTS_MODELO_VIDEO", "kling-video/v2.6/pro/image-to-video"),
        duracao_cena=10 if duracao >= 10 else 5,
        cenas=max(2, min(6, _int("SHORTS_CENAS", 4))),
        elevenlabs_chave=os.environ.get("ELEVENLABS_API_KEY"),
        elevenlabs_voz=os.environ.get("ELEVENLABS_VOICE_ID"),
        elevenlabs_modelo=os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
        openai_chave=os.environ.get("OPENAI_API_KEY") or os.environ.get("CHAT_GPT_API_KEY"),
        openai_modelo=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        openai_voz=os.environ.get("OPENAI_TTS_VOICE", "onyx"),
        max_videos_dia=max(1, min(MAX_VIDEOS_DIA_TETO, _int("SHORTS_MAX_VIDEOS_DIA", 4))),
        privacidade=privacidade,
        categoria_youtube=os.environ.get("SHORTS_CATEGORIA_YOUTUBE", "26"),  # Guia e estilo
        fonte_legenda=os.environ.get("SHORTS_FONTE", "Arial"),
        ffmpeg=os.environ.get("FFMPEG_BIN"),
    )
