"""Regras invioláveis do Melhor Escolha aplicadas aos Shorts.

- Link de compra só o de afiliado do Weslei, por marketplace.
- Nada de produto falso, usado/defeito ou peça no lugar do aparelho.
- Desconto real (a mesma régua do site: R$ 30 ou mais, ou R$ 10 e 20%).
- Nenhum número no roteiro que não venha dos dados conferidos.
- Frete grátis só quando confirmado; senão "frete a consultar no anúncio".
"""

from __future__ import annotations

import re
import unicodedata
from urllib.parse import parse_qs, urlparse

TAG_AMAZON = "melhoresc0fff-20"
FRETE_A_CONSULTAR = "frete a consultar no anúncio"


# ----------------------------------------------------------------- links

def link_de_afiliado_valido(link: str | None, marketplace: str = "mercadolivre") -> bool:
    """Só o link de afiliado de cada programa (mesma trava de src/lib/afiliado.ts)."""
    if not link or not isinstance(link, str):
        return False
    try:
        u = urlparse(link.strip())
    except ValueError:
        return False
    if u.scheme != "https" or not u.netloc:
        return False
    host = u.netloc.lower()
    if marketplace == "mercadolivre":
        return host == "meli.la" and re.fullmatch(r"/[A-Za-z0-9]+", u.path or "") is not None
    if marketplace == "amazon":
        if host == "amzn.to":
            return len(u.path) > 1
        if host not in {"www.amazon.com.br", "amazon.com.br"}:
            return False
        tags = parse_qs(u.query).get("tag", [])
        return tags == [TAG_AMAZON]
    if marketplace == "shopee":
        return host in {"s.shopee.com.br", "shope.ee"} and len(u.path) > 1
    return False


# --------------------------------------------------------- título do produto

def sem_acento(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn"
    ).lower()


_ASSUMIDO = re.compile(
    r"\breplicas?\b|\b1:1\b|\bprimeira linha\b|\b1a linha\b|\blinha (premium )?a{3}\b|"
    r"\ba{3}\+? premium\b|\binspirad[oa]s?\b|\bcontratipos?\b|\bsimilar (ao|a|com) (o )?original\b|"
    r"\btipo original\b|\bclones?\b|\bfirst line\b"
)
_MARCAS_FONE = re.compile(
    r"\b(apple|samsung|galaxy|jbl|xiaomi|redmi|anker|soundcore|sony|lg|motorola|huawei|edifier|"
    r"philips|qcy|haylou|baseus|lenovo|realme|oneplus|nothing|beats|bose|sennheiser|jabra|"
    r"skullcandy|i2go|multilaser|pulse|elg|hrebos|kz)\b"
)
_MARCAS_RELOGIO = re.compile(
    r"\b(apple|samsung|galaxy|xiaomi|redmi|amazfit|huawei|garmin|haylou|mibro|motorola|positivo|"
    r"multilaser|casio|mondaine|technos|orient|polar|honor)\b"
)


def parece_falso(titulo: str | None) -> bool:
    """Porta de src/lib/falsificado.ts (pareceFalso)."""
    t = sem_acento(titulo or "")
    if not t:
        return False
    if _ASSUMIDO.search(t):
        return True
    if re.search(r"\bair ?pods?\b", t) and not re.search(r"\bapple\b", t):
        return True
    if re.search(r"\bi\d{1,2}s? ?tws\b", t):
        return True
    if (
        re.search(r"\b(fone|earbuds?|tws|auricular)\b", t)
        and re.search(r"\bpro ?[3-9]\b", t)
        and not _MARCAS_FONE.search(t)
    ):
        return True
    if (
        re.search(r"\b(smartwatch|relogio inteligente|smart watch)\b", t)
        and re.search(r"\b(series ?\d{1,2}|serie ?\d{1,2}|s\d{1,2}|ultra ?\d|w\d{2})\b", t)
        and not _MARCAS_RELOGIO.search(t)
    ):
        return True
    return False


_CONDICAO_RUIM = re.compile(
    r"\b(usad[oa]s?|recondicionad[oa]s?|seminov[oa]s?|renovad[oa]s?|vitrine|open ?box|"
    r"mostruario|defeito|quebrad[oa]s?|arranhad[oa]s?|sem caixa|tester|para retirada de pecas)\b"
)
_PECA = re.compile(
    r"^\s*(?:\d+\s*(?:un\w*\s*)?|kit\s+)?(carcacas?|gabinetes?|molduras?|tampas?|painel frontal|"
    r"frontal (?:de|do|da|para)|telas? touch|touch ?screen|display (?:de|do|da|para|lcd|oled|compativel)|"
    r"refil|refis|pecas? de reposicao|(?:somente|apenas|so) (?:a )?peca|suporte (?:de|para))\b"
)


def condicao_ruim(titulo: str | None) -> bool:
    return bool(_CONDICAO_RUIM.search(sem_acento(titulo or "")))


def peca_no_lugar_do_aparelho(titulo: str | None) -> bool:
    return bool(_PECA.search(sem_acento(titulo or "")))


# ------------------------------------------------------------- economia

def desconto_real(economia: float | None, antes: float | None) -> bool:
    """Régua única do site (src/lib/regra-economia.ts)."""
    if economia is None or economia <= 0:
        return False
    if economia >= 30:
        return True
    return antes is not None and antes > 0 and economia >= 10 and economia / antes >= 0.2


# ------------------------------------------------------------ dinheiro

def brl(v: float) -> str:
    """R$ 1.299,90 (como a tela do site)."""
    inteiro, centavos = f"{v:,.2f}".split(".")
    return f"R$ {inteiro.replace(',', '.')},{centavos}"


def preco_falado(v: float) -> str:
    """Para a narração: '1299 reais e 90 centavos' (a voz lê os números)."""
    reais = int(round(v * 100)) // 100
    centavos = int(round(v * 100)) % 100
    base = f"{reais} {'real' if reais == 1 else 'reais'}"
    if not centavos:
        return base
    return f"{base} e {centavos} {'centavo' if centavos == 1 else 'centavos'}"


_UNIDADES = [
    (re.compile(r'(\d)\s*(?:"|”|pol\b|polegadas?\b)', re.I), r"\1 polegadas"),
    (re.compile(r"(\d)\s*mAh\b"), r"\1 miliamperes-hora"),
    (re.compile(r"(\d)\s*Ah\b"), r"\1 amperes-hora"),
    (re.compile(r"(\d)\s*GB\b", re.I), r"\1 gigas"),
    (re.compile(r"(\d)\s*TB\b", re.I), r"\1 teras"),
    (re.compile(r"(\d)\s*W\b"), r"\1 watts"),
    (re.compile(r"(\d)\s*V\b"), r"\1 volts"),
    (re.compile(r"(\d)\s*ml\b", re.I), r"\1 mililitros"),
    (re.compile(r"(\d)\s*L\b"), r"\1 litros"),
    (re.compile(r"(\d)\s*kg\b", re.I), r"\1 quilos"),
    (re.compile(r"(\d)\s*h\b"), r"\1 horas"),
]


def unidades_faladas(texto: str) -> str:
    """'32"' -> '32 polegadas', '256 GB' -> '256 gigas' (só na fala)."""
    for padrao, troca in _UNIDADES:
        texto = padrao.sub(troca, texto)
    return texto


# ----------------------------------------------------- texto sem robô

FRASES_PROIBIDAS = [
    "neste vídeo",
    "nesse vídeo",
    "vamos explorar",
    "revolucionári",
    "elegante e sofisticado",
    "design elegante",
    "em suma",
    "descubra o poder",
    "no mundo de hoje",
    "não é mesmo",
    "imperdível",
    "experiência incrível",
    "eleve sua",
    "transforme sua",
    "perfeito para quem",
    "sem sombra de dúvidas",
    "testei",
    "testamos",
    "uso há",
    "estou usando",
    "comprei o meu",
]


def frases_proibidas(texto: str) -> list[str]:
    t = sem_acento(texto)
    return [f for f in FRASES_PROIBIDAS if sem_acento(f) in t]


_NUM = re.compile(r"\d+(?:[.,]\d+)*")


def _normal_num(s: str) -> str:
    return s.replace(".", "").replace(",", "")


def numeros_fora(texto: str, permitidos_em: list[str]) -> list[str]:
    """Números do roteiro que não aparecem nos dados conferidos (título,
    ficha, preços). Nenhum número pode ser inventado."""
    base = {_normal_num(n) for fonte in permitidos_em for n in _NUM.findall(fonte or "")}
    return [n for n in _NUM.findall(texto) if _normal_num(n) not in base]


_REAIS_FALADO = re.compile(r"(\d+)\s+reais?(?:\s+e\s+(\d{1,2})\s+centavos?)?", re.I)
_REAIS_ESCRITO = re.compile(r"R\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})")


def valores_em_reais(texto: str) -> tuple[list[float], str]:
    """Valores em reais do texto (falados e escritos) e o texto sem eles."""
    valores: list[float] = []

    def falado(m: re.Match) -> str:
        valores.append(int(m.group(1)) + int(m.group(2) or 0) / 100)
        return " "

    def escrito(m: re.Match) -> str:
        valores.append(int(m.group(1).replace(".", "")) + int(m.group(2)) / 100)
        return " "

    resto = _REAIS_ESCRITO.sub(escrito, _REAIS_FALADO.sub(falado, texto))
    return valores, resto

