"""Radar de produtos para os Shorts.

Fonte principal: as campanhas do site (campanhas_ativas), que já passaram
pela curadoria de sempre: link de afiliado meli.la, sem usado/defeito, sem
peça, desconto real ou menor preço, frete grátis confirmado, conferido em
até 7 dias e vendedor confiável (loja oficial ou MercadoLíder). Aqui o filtro
é mais duro, porque vídeo fica no ar: só "mesmo produto" ou "menor preço",
conferido nas últimas 24 h (configurável) e nunca repetido em 14 dias.

Amazon e Shopee: só por arquivo de entrada (--entrada itens.json) com o link
de afiliado de cada programa (as listas oficiais dessas lojas não estão no
banco público do site). Comissão nunca entra aqui (só o servidor a vê).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

from . import regras
from .config import SAIDA, Config

log = logging.getLogger("shorts.radar")

HISTORICO = SAIDA / "historico.json"
DIAS_SEM_REPETIR = 14

_RE_FOTO_ML = re.compile(
    r"^https?://[a-z0-9.-]*mlstatic\.com/D_(?:[A-Z0-9]+_)*?(\d{3,}-M[A-Z]{2,3}\d+_\d+)-[A-Z]{1,2}\b[^/]*\.(?:webp|jpe?g|png)$",
    re.I,
)


def foto_original_jpeg(url: str | None) -> str | None:
    """A foto original (até 1200 px) em JPEG, como em src/lib/foto.ts."""
    if not url:
        return None
    m = _RE_FOTO_ML.match(url.strip())
    return f"https://http2.mlstatic.com/D_NQ_NP_{m.group(1)}-F.jpg" if m else url


@dataclass
class Produto:
    chave: str
    titulo: str
    imagem: str | None
    preco: float
    antes: float
    economia: float
    link: str
    marketplace: str = "mercadolivre"
    tipo: str = "mesmo"  # mesmo | menor
    loja: str | None = None
    loja_oficial: bool = False
    mercado_lider: str | None = None
    frete_gratis: bool | None = None
    conferido_em: str | None = None
    categoria: str | None = None
    campanha: str | None = None
    url_produto: str | None = None
    caracteristicas: list[str] = field(default_factory=list)
    destaques: list[str] = field(default_factory=list)
    avaliacoes: dict[str, Any] | None = None

    @property
    def percentual(self) -> int:
        return int(self.economia / self.antes * 100) if self.antes > 0 else 0

    def para_json(self) -> dict[str, Any]:
        return asdict(self)


def _num(v: Any) -> float | None:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _data(v: Any) -> datetime | None:
    if not isinstance(v, str):
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None


def _rpc(cfg: Config, nome: str, corpo: dict[str, Any]) -> Any:
    if not cfg.supabase_url or not cfg.supabase_chave_publica:
        raise RuntimeError(
            "Endereço/chave pública do site não encontrados (.env do repositório ou "
            "MELHORESCOLHA_SUPABASE_URL / MELHORESCOLHA_SUPABASE_CHAVE_PUBLICA)."
        )
    r = requests.post(
        f"{cfg.supabase_url}/rest/v1/rpc/{nome}",
        headers={
            "apikey": cfg.supabase_chave_publica,
            "Authorization": f"Bearer {cfg.supabase_chave_publica}",
            "Content-Type": "application/json",
        },
        json=corpo,
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def ler_historico() -> list[dict[str, Any]]:
    try:
        return json.loads(HISTORICO.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def registrar_no_historico(produto: Produto, video_id: str | None) -> None:
    HISTORICO.parent.mkdir(parents=True, exist_ok=True)
    lista = ler_historico()
    lista.append(
        {
            "chave": produto.chave,
            "titulo": produto.titulo,
            "video_id": video_id,
            "em": datetime.now(timezone.utc).isoformat(),
        }
    )
    HISTORICO.write_text(json.dumps(lista[-500:], ensure_ascii=False, indent=2), encoding="utf-8")


def _recentes() -> set[str]:
    limite = datetime.now(timezone.utc) - timedelta(days=DIAS_SEM_REPETIR)
    return {
        h["chave"]
        for h in ler_historico()
        if isinstance(h, dict) and (_data(h.get("em")) or limite) > limite
    }


def motivo_de_recusa(p: Produto, max_horas: float) -> str | None:
    """Por que o produto NÃO vira vídeo (None = pode)."""
    if p.tipo not in {"mesmo", "menor"}:
        return "parecido (precisa do 'o que muda'; fica fora dos vídeos)"
    if not regras.link_de_afiliado_valido(p.link, p.marketplace):
        return "link sem afiliado"
    if regras.parece_falso(p.titulo):
        return "parece falso"
    if regras.condicao_ruim(p.titulo):
        return "usado/defeito"
    if regras.peca_no_lugar_do_aparelho(p.titulo):
        return "peça no lugar do aparelho"
    if not regras.desconto_real(p.economia, p.antes):
        return "sem desconto real"
    if p.preco >= p.antes:
        return "não é mais barato"
    quando = _data(p.conferido_em)
    if quando is None or datetime.now(timezone.utc) - quando > timedelta(hours=max_horas):
        return f"preço conferido há mais de {max_horas:g} h"
    if not p.imagem:
        return "sem foto"
    return None


def _do_campanha(slug: str, item: dict[str, Any]) -> Produto | None:
    preco, antes = _num(item.get("preco")), _num(item.get("antes"))
    economia = _num(item.get("economia"))
    if preco is None or antes is None:
        return None
    return Produto(
        chave=str(item.get("chave") or ""),
        titulo=str(item.get("titulo") or "").strip(),
        imagem=item.get("imagem"),
        preco=preco,
        antes=antes,
        economia=economia if economia is not None else round(antes - preco, 2),
        link=str(item.get("link") or ""),
        tipo=str(item.get("tipo") or ""),
        loja=item.get("loja"),
        loja_oficial=item.get("loja_oficial") is True,
        mercado_lider=item.get("mercado_lider"),
        # A curadoria das campanhas só aceita frete grátis confirmado.
        frete_gratis=True,
        conferido_em=item.get("conferido_em"),
        campanha=slug,
        url_produto=item.get("url_produto"),
    )


def _da_entrada(item: dict[str, Any]) -> Produto | None:
    """Item manual (Amazon/Shopee/Mercado Livre) com os dados conferidos."""
    preco, antes = _num(item.get("preco")), _num(item.get("antes"))
    if preco is None or antes is None:
        return None
    fg = item.get("frete_gratis")
    return Produto(
        chave=str(item.get("chave") or item.get("link") or ""),
        titulo=str(item.get("titulo") or "").strip(),
        imagem=item.get("imagem"),
        preco=preco,
        antes=antes,
        economia=round(antes - preco, 2),
        link=str(item.get("link") or ""),
        marketplace=str(item.get("marketplace") or "mercadolivre"),
        tipo=str(item.get("tipo") or "mesmo"),
        loja=item.get("loja"),
        loja_oficial=item.get("loja_oficial") is True,
        frete_gratis=fg if isinstance(fg, bool) else None,
        conferido_em=item.get("conferido_em"),
        categoria=item.get("categoria"),
        caracteristicas=[str(c) for c in item.get("caracteristicas") or []][:12],
    )


def _detalhes(cfg: Config, p: Produto) -> None:
    """Características e destaques lidos na comparação (detalhes_da_vitrine)."""
    try:
        linhas = _rpc(cfg, "detalhes_da_vitrine", {"p_chave": p.chave})
    except requests.RequestException as e:
        log.info("sem detalhes para %s: %s", p.chave, e)
        return
    d = (linhas[0] if isinstance(linhas, list) and linhas else {}).get("detalhes") or {}
    for c in d.get("caracteristicas") or []:
        if isinstance(c, dict) and c.get("nome") and c.get("valor"):
            p.caracteristicas.append(f"{c['nome']}: {c['valor']}")
    p.destaques = [str(x) for x in (d.get("destaques") or []) if x][:4]


def buscar(cfg: Config, *, max_horas: float = 24, entrada: Path | None = None, limite: int = 5) -> list[Produto]:
    candidatos: list[Produto] = []
    if entrada:
        dados = json.loads(Path(entrada).read_text(encoding="utf-8"))
        for item in dados if isinstance(dados, list) else []:
            p = _da_entrada(item) if isinstance(item, dict) else None
            if p:
                candidatos.append(p)
    else:
        for camp in _rpc(cfg, "campanhas_ativas", {}) or []:
            for item in camp.get("produtos") or []:
                p = _do_campanha(str(camp.get("slug") or ""), item)
                if p:
                    candidatos.append(p)

    ja = _recentes()
    vistos: set[str] = set()
    aprovados: list[Produto] = []
    for p in candidatos:
        if not p.chave or p.chave in vistos:
            continue
        vistos.add(p.chave)
        if p.chave in ja:
            log.info("pulado (vídeo nos últimos %d dias): %s", DIAS_SEM_REPETIR, p.titulo[:60])
            continue
        motivo = motivo_de_recusa(p, max_horas)
        if motivo:
            log.info("recusado (%s): %s", motivo, p.titulo[:60])
            continue
        aprovados.append(p)

    # Maior economia primeiro; em empate, loja oficial e MercadoLíder Platinum.
    aprovados.sort(
        key=lambda p: (-p.economia, -int(p.loja_oficial), -int(p.mercado_lider == "platinum"))
    )
    escolhidos = aprovados[:limite]
    for p in escolhidos:
        if p.marketplace == "mercadolivre":
            p.imagem = foto_original_jpeg(p.imagem)
            if not p.caracteristicas:
                _detalhes(cfg, p)
    return escolhidos
