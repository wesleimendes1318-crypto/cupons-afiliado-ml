"""Orquestrador ponta a ponta dos Shorts.

  python -m scripts.automacao_shorts.pipeline_principal --simular
      radar + roteiro + SEO, sem gastar crédito (confira os textos em saida/)
  python -m scripts.automacao_shorts.pipeline_principal --max 1 --sem-upload
      gera o vídeo completo e não envia
  python -m scripts.automacao_shorts.pipeline_principal --max 1
      gera e envia (privado por padrão: SHORTS_PRIVACIDADE=public publica direto)
  python -m scripts.automacao_shorts.pipeline_principal --comentar <pasta do vídeo>
      publica o comentário depois de liberar um vídeo que subiu privado

Cada vídeo fica em saida/<data>_<produto>/ (produto, roteiro, metadados,
narração, cenas, vídeo e o resultado do envio). Erro num produto não para os
outros. Antes de gastar crédito do Higgsfield, confere se ainda cabe upload
hoje (cota e teto de vídeos).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from . import editor_video, gerador_roteiro, higgsfield_video, radar_produtos, regras, voz_narracao, youtube_publisher
from .config import SAIDA, carregar

log = logging.getLogger("shorts")


def _configurar_log() -> Path:
    pasta = SAIDA / "logs"
    pasta.mkdir(parents=True, exist_ok=True)
    arquivo = pasta / f"{datetime.now():%Y-%m-%d}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.FileHandler(arquivo, encoding="utf-8"), logging.StreamHandler(sys.stdout)],
    )
    return arquivo


def _salvar(pasta: Path, nome: str, dados: object) -> None:
    (pasta / nome).write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")


def _comentario(p: radar_produtos.Produto, r: gerador_roteiro.Roteiro) -> str:
    frete = "Frete grátis confirmado na comparação." if p.frete_gratis is True else "Frete a consultar no anúncio."
    return youtube_publisher.texto_do_comentario(p.link, regras.brl(p.preco), r.conferido_texto, frete)


def processar(cfg, p: radar_produtos.Produto, *, simular: bool, sem_upload: bool) -> dict:
    pasta = SAIDA / f"{datetime.now():%Y%m%d}_{p.chave}"
    pasta.mkdir(parents=True, exist_ok=True)
    _salvar(pasta, "produto.json", p.para_json())

    roteiro = gerador_roteiro.gerar(cfg, p)
    meta = gerador_roteiro.metadados_seo(p, roteiro)
    comentario = _comentario(p, roteiro)
    _salvar(pasta, "roteiro.json", roteiro.para_json())
    _salvar(pasta, "metadados.json", {**meta, "comentario": comentario})
    log.info("roteiro ok (%d palavras, ~%.0f s): %s", roteiro.palavras, roteiro.segundos_estimados, meta["titulo"])
    if simular:
        return {"pasta": str(pasta), "simulado": True}

    if not sem_upload:
        ok, motivo = youtube_publisher.pode_enviar(cfg)
        if not ok:
            raise RuntimeError(f"sem upload hoje ({motivo}): nada foi gerado para não gastar crédito")

    narracao = voz_narracao.narrar(cfg, roteiro, pasta)
    log.info("narração pronta (%s)", narracao.motor)
    cenas = higgsfield_video.gerar_cenas(cfg, p, roteiro.categoria, pasta / "cenas")
    video = editor_video.montar(cfg, roteiro, narracao, cenas, pasta)
    log.info("vídeo pronto: %s", video)
    if sem_upload:
        return {"pasta": str(pasta), "video": str(video)}

    envio = youtube_publisher.enviar(cfg, video, meta, comentario)
    _salvar(pasta, "envio.json", envio)
    radar_produtos.registrar_no_historico(p, envio.get("video_id"))
    log.info(envio["aviso"])
    return {"pasta": str(pasta), "video": str(video), **envio}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Shorts do Melhor Escolha")
    ap.add_argument("--max", type=int, default=1, help="quantos vídeos nesta execução (padrão 1)")
    ap.add_argument("--simular", action="store_true", help="só radar, roteiro e SEO (sem custo)")
    ap.add_argument("--sem-upload", action="store_true", help="gera o vídeo e não envia")
    ap.add_argument("--entrada", type=Path, help="JSON com itens conferidos (Amazon/Shopee/Mercado Livre)")
    ap.add_argument("--max-horas", type=float, default=24, help="idade máxima do preço conferido")
    ap.add_argument("--comentar", type=Path, help="pasta de um vídeo já enviado: publica o comentário")
    a = ap.parse_args(argv)

    arquivo_log = _configurar_log()
    cfg = carregar()

    if a.comentar:
        envio = json.loads((a.comentar / "envio.json").read_text(encoding="utf-8"))
        meta = json.loads((a.comentar / "metadados.json").read_text(encoding="utf-8"))
        cid = youtube_publisher.comentar(envio["video_id"], meta["comentario"])
        envio["comentario_id"] = cid
        _salvar(a.comentar, "envio.json", envio)
        print(f"Comentário publicado ({cid}). Fixe no YouTube Studio.")
        return 0

    produtos = radar_produtos.buscar(cfg, max_horas=a.max_horas, entrada=a.entrada, limite=max(1, a.max))
    if not produtos:
        log.info("nenhum produto passou nas regras agora (veja os motivos acima)")
        return 0
    resultados = []
    for p in produtos[: a.max]:
        try:
            resultados.append(processar(cfg, p, simular=a.simular, sem_upload=a.sem_upload))
        except Exception as e:  # noqa: BLE001 - um produto não derruba os outros
            log.exception("falhou %s: %s", p.chave, e)
            resultados.append({"produto": p.chave, "erro": str(e)})
    print(json.dumps(resultados, ensure_ascii=False, indent=2))
    print(f"Log: {arquivo_log}")
    return 0 if all("erro" not in r for r in resultados) else 1


if __name__ == "__main__":
    raise SystemExit(main())
