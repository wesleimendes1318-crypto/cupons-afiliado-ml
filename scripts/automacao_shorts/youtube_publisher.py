"""Upload no YouTube (Data API v3) com OAuth 2.0 persistente e o primeiro
comentário com o link de afiliado.

Credenciais (fora do git, pasta credenciais/):
  client_secrets.json  cliente OAuth "App para computador" do Google Cloud
  youtube_token.json   criado na 1ª execução (python -m
                       scripts.automacao_shorts.youtube_publisher --autorizar),
                       com refresh_token; depois renova sozinho.
Escopos: youtube.upload e youtube.force-ssl (comentários).

Cota: 10.000 unidades/dia (zera à meia-noite do Pacífico). Upload = 1.600,
comentário = 50. Teto de 4 vídeos/dia (SHORTS_MAX_VIDEOS_DIA, no máximo 5);
o gasto do dia fica em credenciais/cota_youtube.json.

Limites da plataforma (conferidos em 10/10):
- A API NÃO fixa comentário: o comentário é publicado e o script avisa para
  fixar no YouTube Studio (1 toque).
- Desde 31/08/2023 o link na descrição e nos comentários do Shorts não é
  clicável (a pessoa copia). Por isso o CTA diz "comentário e descrição" e o
  site vai na descrição; o link clicável fica no perfil do canal.
- Conteúdo realista gerado por ferramenta precisa ser declarado: o upload
  vai com status.containsSyntheticMedia = true (campo oficial desde
  30/10/2024). Não declarar pode tirar o vídeo do ar.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .config import CREDENCIAIS, CUSTO_COMENTARIO, CUSTO_UPLOAD, COTA_DIARIA, Config, carregar

log = logging.getLogger("shorts.youtube")

ESCOPOS = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
CLIENTE = CREDENCIAIS / "client_secrets.json"
TOKEN = CREDENCIAIS / "youtube_token.json"
COTA = CREDENCIAIS / "cota_youtube.json"
PACIFICO = ZoneInfo("America/Los_Angeles")


# ------------------------------------------------------------------ cota

def _dia_pacifico() -> str:
    return datetime.now(PACIFICO).strftime("%Y-%m-%d")


def ler_cota() -> dict:
    try:
        dados = json.loads(COTA.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        dados = {}
    if dados.get("dia") != _dia_pacifico():
        dados = {"dia": _dia_pacifico(), "unidades": 0, "videos": 0}
    return dados


def _gravar_cota(dados: dict) -> None:
    COTA.parent.mkdir(parents=True, exist_ok=True)
    COTA.write_text(json.dumps(dados), encoding="utf-8")


def pode_enviar(cfg: Config) -> tuple[bool, str]:
    c = ler_cota()
    if c["videos"] >= cfg.max_videos_dia:
        return False, f"teto de {cfg.max_videos_dia} vídeos hoje"
    if c["unidades"] + CUSTO_UPLOAD + CUSTO_COMENTARIO > COTA_DIARIA:
        return False, f"cota do dia ({c['unidades']}/{COTA_DIARIA} unidades)"
    return True, ""


def _gastar(unidades: int, video: bool = False) -> None:
    c = ler_cota()
    c["unidades"] += unidades
    c["videos"] += 1 if video else 0
    _gravar_cota(c)


# ----------------------------------------------------------------- OAuth

def credenciais(interativo: bool = False):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    cred = None
    if TOKEN.exists():
        cred = Credentials.from_authorized_user_file(str(TOKEN), ESCOPOS)
    if cred and cred.valid:
        return cred
    if cred and cred.expired and cred.refresh_token:
        cred.refresh(Request())
        TOKEN.write_text(cred.to_json(), encoding="utf-8")
        return cred
    if not interativo:
        raise RuntimeError(
            "Sem token do YouTube. Rode uma vez: python -m scripts.automacao_shorts.youtube_publisher --autorizar"
        )
    if not CLIENTE.exists():
        raise RuntimeError(f"Falta {CLIENTE} (cliente OAuth 'App para computador' do Google Cloud).")
    from google_auth_oauthlib.flow import InstalledAppFlow

    fluxo = InstalledAppFlow.from_client_secrets_file(str(CLIENTE), ESCOPOS)
    # access_type=offline + prompt=consent garantem o refresh_token.
    cred = fluxo.run_local_server(port=0, access_type="offline", prompt="consent")
    TOKEN.parent.mkdir(parents=True, exist_ok=True)
    TOKEN.write_text(cred.to_json(), encoding="utf-8")
    return cred


def _servico():
    from googleapiclient.discovery import build

    return build("youtube", "v3", credentials=credenciais(), cache_discovery=False)


# ----------------------------------------------------------------- envio

def enviar(cfg: Config, video: Path, meta: dict, comentario: str) -> dict:
    """Envia o vídeo e publica o primeiro comentário. Devolve ids e avisos."""
    from googleapiclient.errors import HttpError
    from googleapiclient.http import MediaFileUpload

    ok, motivo = pode_enviar(cfg)
    if not ok:
        raise RuntimeError(f"upload adiado: {motivo}")
    yt = _servico()
    corpo = {
        "snippet": {
            "title": meta["titulo"][:100],
            "description": meta["descricao"][:5000],
            "tags": meta["tags"],
            "categoryId": cfg.categoria_youtube,
            "defaultLanguage": "pt-BR",
            "defaultAudioLanguage": "pt-BR",
        },
        "status": {
            "privacyStatus": cfg.privacidade,
            "selfDeclaredMadeForKids": False,
            "containsSyntheticMedia": True,
            "embeddable": True,
        },
    }
    midia = MediaFileUpload(str(video), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    pedido = yt.videos().insert(part="snippet,status", body=corpo, media_body=midia)
    resposta = None
    while resposta is None:
        _, resposta = pedido.next_chunk()
    _gastar(CUSTO_UPLOAD, video=True)
    video_id = resposta["id"]
    log.info("vídeo enviado: https://youtube.com/shorts/%s (%s)", video_id, cfg.privacidade)

    comentario_id = None
    try:
        thread = (
            yt.commentThreads()
            .insert(
                part="snippet",
                body={"snippet": {"videoId": video_id, "topLevelComment": {"snippet": {"textOriginal": comentario}}}},
            )
            .execute()
        )
        _gastar(CUSTO_COMENTARIO)
        comentario_id = thread["id"]
    except HttpError as e:
        # Vídeo privado não aceita comentário: publique o comentário depois de liberar.
        log.warning("comentário não publicado agora: %s", e)
    return {
        "video_id": video_id,
        "comentario_id": comentario_id,
        "aviso": "Fixe o comentário no YouTube Studio (a API não fixa comentário).",
    }


def comentar(video_id: str, comentario: str) -> str:
    """Publica o comentário depois (vídeo que subiu como privado)."""
    yt = _servico()
    thread = (
        yt.commentThreads()
        .insert(
            part="snippet",
            body={"snippet": {"videoId": video_id, "topLevelComment": {"snippet": {"textOriginal": comentario}}}},
        )
        .execute()
    )
    _gastar(CUSTO_COMENTARIO)
    return thread["id"]


def texto_do_comentario(link: str, preco_txt: str, conferido: str, frete_txt: str) -> str:
    return (
        f"🛒 Link seguro com o menor preço que eu achei: {link}\n"
        f"Saiu por {preco_txt} em {conferido}; preço pode mudar.\n"
        f"{frete_txt}\n"
        "Link de afiliado: você não paga nada a mais."
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="YouTube: autorizar a conta (1ª vez) ou ver a cota do dia")
    ap.add_argument("--autorizar", action="store_true", help="abre o navegador para autorizar o canal")
    ap.add_argument("--cota", action="store_true", help="mostra o gasto de hoje")
    a = ap.parse_args()
    cfg = carregar()
    if a.autorizar:
        credenciais(interativo=True)
        print(f"Token salvo em {TOKEN} (fica fora do git).")
    if a.cota or not a.autorizar:
        c = ler_cota()
        print(f"Hoje ({c['dia']}, Pacífico): {c['unidades']}/{COTA_DIARIA} unidades, {c['videos']} vídeo(s); teto {cfg.max_videos_dia}.")


if __name__ == "__main__":
    main()
