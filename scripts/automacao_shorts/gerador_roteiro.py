"""Roteiro de 30 a 45 s que soa como gente, com os números conferidos.

Estrutura (Weslei, 10/10):
  1. gancho (0-3 s)        quebra de padrão / curiosidade
  2. valor (4-20 s)        o produto, o que a ficha diz, por que confiar
  3. comparação (21-32 s)  anúncio comparado x preço achado (só dado real)
  4. CTA (33-38 s)         link no primeiro comentário e na descrição
  5. loop (39-42 s)        a última frase emenda na primeira

Regras: português coloquial; nada de "neste vídeo", "revolucionário",
"elegante e sofisticado"...; nunca "testei"/"uso há" (não testamos o
produto: comparamos o preço); nenhum número fora dos dados; frete em frase
própria ("frete a consultar no anúncio" quando não confirmado).
O polimento por modelo de linguagem é opcional (SHORTS_POLIR=1) e só vale se
passar na mesma validação; senão fica o roteiro base.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests

from . import regras
from .config import Config
from .radar_produtos import Produto

log = logging.getLogger("shorts.roteiro")
BRASILIA = ZoneInfo("America/Sao_Paulo")

PALAVRAS_POR_SEGUNDO = 2.7
MIN_PALAVRAS, MAX_PALAVRAS = 70, 125  # ~26 s a ~46 s

# (gancho, ponte do loop): a ponte termina emendando no gancho.
GANCHOS = [
    (
        "Todo mundo tá pagando caro nisso aqui à toa.",
        "Quem não compara antes acaba caindo nessa, e é por isso que",
    ),
    (
        "Achei o mesmo produto bem mais barato, e quase ninguém viu.",
        "Corre lá antes que o preço mude, porque eu",
    ),
    (
        "Antes de gastar seu dinheiro nisso, olha o que eu achei.",
        "Salva esse vídeo e, da próxima vez,",
    ),
    (
        "Esse aqui saiu por menos do que eu imaginava.",
        "Quando eu vi o preço, eu pensei:",
    ),
]

TITULOS = [
    "Não compre {nome} antes de ver isso! 🔥",
    "{nome} por menos? Achei 🔥",
    "Pare de pagar caro em {nome} 🔥",
    "Achadinho: {nome} mais barato 🔥",
]

# Ruído de anúncio que não entra no nome falado.
_RUIDO = re.compile(
    r"\b(original|novo|nova|lan[çc]amento|envio imediato|pronta entrega|promo[çc][ãa]o|oferta|"
    r"frete gr[áa]tis|garantia|nf|nota fiscal|kit completo|top|premium|oficial)\b",
    re.I,
)
_PRIORIDADE_FICHA = [
    "bateria",
    "autonomia",
    "potência",
    "capacidade",
    "armazenamento",
    "memória",
    "tela",
    "resolução",
    "conexão",
    "bluetooth",
    "voltagem",
    "material",
    "volume",
    "tamanho",
    "peso",
]

CATEGORIAS = {
    "tecnologia": r"fone|headset|caixa de som|smart|celular|tablet|notebook|mouse|teclado|monitor|"
    r"echo|alexa|carregador|power ?bank|ssd|roteador|camera|câmera|tv|console|controle",
    "casa": r"air ?fryer|fritadeira|panela|cafeteira|liquidificador|aspirador|ventilador|"
    r"geladeira|micro-?ondas|forno|batedeira|chaleira|ferro|toalha|len[çc]ol|organizador",
    "beleza": r"perfume|col[ôo]nia|creme|s[ée]rum|shampoo|condicionador|maquiagem|batom|"
    r"secador|chapinha|escova|barbeador|hidratante|protetor solar",
    "brinquedos": r"brinquedo|boneca|boneco|lego|carrinho|pel[úu]cia|quebra-cabe[çc]a|slime|nerf|jogo",
}
ROTULO_CATEGORIA = {
    "tecnologia": "Tecnologia",
    "casa": "Casa",
    "beleza": "Beleza",
    "brinquedos": "Brinquedos",
    "outros": "Achados",
}


MARCAS = (
    "Samsung Apple Xiaomi Motorola LG Sony JBL Philco Philips Britânia Mondial Electrolux Brastemp "
    "Consul Arno Oster Wap Black+Decker Dell Lenovo Acer Asus Positivo Multilaser Intelbras Huawei "
    "Amazon Logitech Redragon HyperX Razer Havaianas Boticário Natura Eudora Nivea Dove Tramontina "
    "Hasbro Mattel Estrela Lego Nike Adidas Fila Olympikus Puma Mizuno Kingston SanDisk TP-Link "
    "Xbox PlayStation Nintendo Amazfit Garmin Anker Baseus Edifier Stanley Electrolux Midea Gree "
    "Cadence Lenoxx Colgate Oral-B Gillette Wella L'Oréal Vult Ruby Rose Truss Lattafa Calvin Klein"
).split()


def marca_do_titulo(titulo: str) -> str | None:
    t = f" {titulo.lower()} "
    for m in MARCAS:
        if re.search(rf"(?<![\w]){re.escape(m.lower())}(?![\w])", t):
            return m
    return None


def categoria_do_produto(p: Produto) -> str:
    base = f"{p.categoria or ''} {p.campanha or ''} {p.titulo}".lower()
    if "tech" in base:
        return "tecnologia"
    if "criancas" in base:
        return "brinquedos"
    for cat, padrao in CATEGORIAS.items():
        if re.search(padrao, base, re.I):
            return cat
    return "outros"


def nome_curto(titulo: str, palavras: int = 6) -> str:
    limpo = _RUIDO.sub(" ", titulo)
    limpo = re.sub(r"[|/\\()\[\]{}]+", " ", limpo)
    limpo = re.sub(r"\s+", " ", limpo).strip(" -,.")
    return " ".join(limpo.split()[:palavras])


def _escolha(chave: str, n: int) -> int:
    return int(hashlib.sha1(chave.encode("utf-8")).hexdigest(), 16) % n


def fatos_da_ficha(p: Produto, maximo: int = 2) -> list[tuple[str, str]]:
    """Até 2 características com valor de verdade (nada de 'Sim'/'Não')."""
    fatos: list[tuple[str, str]] = []
    pares = []
    for linha in p.caracteristicas:
        if ":" not in linha:
            continue
        nome, valor = (x.strip() for x in linha.split(":", 1))
        if not nome or not valor or valor.lower() in {"sim", "não", "nao", "-"} or len(valor) > 40:
            continue
        pares.append((nome, valor))
    for chave in _PRIORIDADE_FICHA:
        for nome, valor in pares:
            if chave in nome.lower() and (nome, valor) not in fatos:
                fatos.append((nome, valor))
                break
        if len(fatos) >= maximo:
            break
    return fatos


@dataclass
class Trecho:
    parte: str  # gancho | valor | comparacao | cta | loop
    fala: str  # o que a voz diz
    legenda: str  # o que aparece na tela


@dataclass
class Roteiro:
    produto_chave: str
    nome: str
    categoria: str
    trechos: list[Trecho] = field(default_factory=list)
    conferido_texto: str = ""

    @property
    def texto_falado(self) -> str:
        return " ".join(t.fala for t in self.trechos)

    @property
    def palavras(self) -> int:
        return len(self.texto_falado.split())

    @property
    def segundos_estimados(self) -> float:
        return round(self.palavras / PALAVRAS_POR_SEGUNDO, 1)

    def para_json(self) -> dict:
        return {
            "produto": self.produto_chave,
            "nome": self.nome,
            "categoria": self.categoria,
            "trechos": [t.__dict__ for t in self.trechos],
            "palavras": self.palavras,
            "segundos_estimados": self.segundos_estimados,
        }


def conferido_em_texto(p: Produto) -> str:
    try:
        d = datetime.fromisoformat(str(p.conferido_em).replace("Z", "+00:00")).astimezone(BRASILIA)
        return d.strftime("%d/%m às %H:%M")
    except ValueError:
        return datetime.now(timezone.utc).astimezone(BRASILIA).strftime("%d/%m")


def roteiro_base(p: Produto) -> Roteiro:
    gancho, ponte = GANCHOS[_escolha(p.chave, len(GANCHOS))]
    nome = nome_curto(p.titulo)
    r = Roteiro(p.chave, nome, categoria_do_produto(p), conferido_texto=conferido_em_texto(p))
    r.trechos.append(Trecho("gancho", gancho, gancho))

    valor_fala = [f"É o {nome}."]
    valor_tela = [nome]
    for nome_ficha, valor in fatos_da_ficha(p):
        valor_fala.append(f"{nome_ficha}: {regras.unidades_faladas(valor)}.")
        valor_tela.append(f"{nome_ficha}: {valor}")
    av = p.avaliacoes or {}
    if isinstance(av.get("nota"), (int, float)) and isinstance(av.get("total"), int) and av["total"] >= 20:
        nota = f"{av['nota']:.1f}".replace(".", ",")
        valor_fala.append(f"E tem nota {nota} de 5, com {av['total']} avaliações.")
        valor_tela.append(f"★ {nota} ({av['total']} avaliações)")
    if p.tipo == "mesmo":
        valor_fala.append("E é o mesmo produto: conferi pela foto e pela ficha.")
        valor_tela.append("Mesmo produto, conferido")
    else:
        valor_fala.append("Comparei com outras lojas que vendem exatamente o mesmo produto.")
        valor_tela.append("Comparado com outras lojas")
    if p.loja_oficial:
        valor_fala.append("E quem vende é a loja oficial.")
        valor_tela.append("Loja oficial")
    r.trechos.append(Trecho("valor", " ".join(valor_fala), " · ".join(valor_tela)))

    antes, agora, menos = p.antes, p.preco, p.economia
    if p.tipo == "mesmo":
        comp_fala = (
            f"No anúncio que eu comparei, tava {regras.preco_falado(antes)}. "
            f"Fui atrás do menor preço e achei o mesmo produto por {regras.preco_falado(agora)}. "
            f"São {regras.preco_falado(menos)} a menos."
        )
        comp_tela = f"Anúncio comparado: {regras.brl(antes)}\nAchei por: {regras.brl(agora)}\n{regras.brl(menos)} a menos"
    else:
        comp_fala = (
            f"Na segunda loja mais barata, tá {regras.preco_falado(antes)}. "
            f"Aqui sai por {regras.preco_falado(agora)}, {regras.preco_falado(menos)} a menos."
        )
        comp_tela = f"2ª loja: {regras.brl(antes)}\nAqui: {regras.brl(agora)}\n{regras.brl(menos)} a menos"
    # Frete em frase própria (nunca junto do valor em reais).
    if p.frete_gratis is True:
        comp_fala += " E o frete sai grátis."
        frete_tela = "Frete grátis"
    else:
        comp_fala += " O frete você confere no anúncio."
        frete_tela = regras.FRETE_A_CONSULTAR.capitalize()
    r.trechos.append(Trecho("comparacao", comp_fala, f"{comp_tela}\n{frete_tela}"))

    cta = "Deixei o link seguro no primeiro comentário e na descrição. Preço muda rápido, então confere lá."
    r.trechos.append(Trecho("cta", cta, "Link no 1º comentário"))
    r.trechos.append(Trecho("loop", ponte, ponte))
    return r


def fontes_permitidas(p: Produto) -> list[str]:
    """De onde um número (fora os valores em reais) pode vir: título, ficha e
    avaliações. Os valores em reais são conferidos à parte (só os 3 do
    produto: preço achado, comparado e a diferença)."""
    fontes = [p.titulo, *p.caracteristicas, *p.destaques]
    av = p.avaliacoes or {}
    if av:
        fontes += [f"{av.get('nota', '')}".replace(".", ","), str(av.get("total", ""))]
    fontes += ["5", "1", "2"]  # "nota X de 5", "1º comentário", "2ª loja"
    return fontes


def validar(r: Roteiro, p: Produto) -> list[str]:
    problemas: list[str] = []
    partes = [t.parte for t in r.trechos]
    if partes != ["gancho", "valor", "comparacao", "cta", "loop"]:
        problemas.append(f"estrutura fora da ordem: {partes}")
    texto = " ".join(t.fala + " " + t.legenda for t in r.trechos)
    if achadas := regras.frases_proibidas(texto):
        problemas.append(f"frases de robô/promessa falsa: {achadas}")
    valores, resto = regras.valores_em_reais(texto)
    conferidos = {round(v, 2) for v in (p.preco, p.antes, p.economia)}
    if errados := sorted({v for v in valores if round(v, 2) not in conferidos}):
        problemas.append(f"valores em reais que não são os conferidos: {errados}")
    if fora := regras.numeros_fora(resto, fontes_permitidas(p)):
        problemas.append(f"números que não vêm dos dados: {fora}")
    if not (MIN_PALAVRAS <= r.palavras <= MAX_PALAVRAS):
        problemas.append(f"{r.palavras} palavras (fora de {MIN_PALAVRAS}-{MAX_PALAVRAS})")
    comp = next((t for t in r.trechos if t.parte == "comparacao"), None)
    if comp and p.frete_gratis is not True and "grátis" in comp.fala.lower():
        problemas.append("frete grátis sem confirmação")
    return problemas


def _polir(cfg: Config, r: Roteiro) -> Roteiro | None:
    """Reescrita opcional, mantendo cada número e o sentido de cada trecho."""
    if not cfg.openai_chave:
        return None
    pedido = {
        "instrucoes": (
            "Reescreva cada fala em português do Brasil bem coloquial, como um criador de "
            "conteúdo brasileiro falando de um achadinho. Frases curtas, ritmo rápido, gírias "
            "naturais de compra (achadinho, pechincha, saiu por menos de, quebra um galho). "
            "Mantenha EXATAMENTE os mesmos números e o mesmo sentido. Não acrescente "
            "característica, opinião de uso, promessa nem número. Proibido: 'neste vídeo', "
            "'revolucionário', 'elegante e sofisticado', 'em suma', 'descubra', 'testei', "
            "'uso há'. A fala 'loop' tem que terminar emendando na fala 'gancho'. Responda só "
            "JSON: {\"falas\": {\"gancho\": ..., \"valor\": ..., \"comparacao\": ..., \"cta\": ..., \"loop\": ...}}"
        ),
        "falas": {t.parte: t.fala for t in r.trechos},
    }
    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {cfg.openai_chave}"},
            json={
                "model": cfg.openai_modelo,
                "response_format": {"type": "json_object"},
                "temperature": 0.7,
                "messages": [{"role": "user", "content": json.dumps(pedido, ensure_ascii=False)}],
            },
            timeout=40,
        )
        resp.raise_for_status()
        falas = json.loads(resp.json()["choices"][0]["message"]["content"]).get("falas") or {}
    except (requests.RequestException, KeyError, ValueError) as e:
        log.info("polimento indisponível: %s", e)
        return None
    novo = Roteiro(r.produto_chave, r.nome, r.categoria, conferido_texto=r.conferido_texto)
    for t in r.trechos:
        fala = falas.get(t.parte)
        novo.trechos.append(Trecho(t.parte, fala.strip() if isinstance(fala, str) and fala.strip() else t.fala, t.legenda))
    return novo


def gerar(cfg: Config, p: Produto) -> Roteiro:
    base = roteiro_base(p)
    problemas = validar(base, p)
    if problemas:
        raise ValueError(f"roteiro base reprovado para {p.chave}: {problemas}")
    if os.environ.get("SHORTS_POLIR") == "1":
        polido = _polir(cfg, base)
        if polido and not (erros := validar(polido, p)):
            return polido
        if polido:
            log.info("polimento descartado: %s", erros)
    return base


def metadados_seo(p: Produto, r: Roteiro) -> dict:
    """Título (até 70 caracteres, com #Shorts), descrição com o link e o
    aviso de afiliado, 3 a 4 hashtags e 8 a 12 tags. Sem "review" nem
    "unboxing" nas tags: o vídeo compara preço, não testa o produto (tag que
    promete outro conteúdo é metadado enganoso para o YouTube)."""
    cat = ROTULO_CATEGORIA[r.categoria]
    titulo = ""
    for nome in (r.nome, nome_curto(p.titulo, 4), nome_curto(p.titulo, 3)):
        for modelo in [TITULOS[_escolha(p.chave + "t", len(TITULOS))], *TITULOS]:
            candidato = f"{modelo.format(nome=nome)} #Shorts"
            if len(candidato) <= 70:
                titulo = candidato
                break
        if titulo:
            break
    if not titulo:
        titulo = f"{nome_curto(p.titulo, 3)[:50]} 🔥 #Shorts"

    marca = marca_do_titulo(p.titulo) or ""
    hashtags = ["#Achadinhos", "#CustoBeneficio", f"#{cat}"]
    tag_marca = re.sub(r"[^\wÀ-ú]", "", marca)
    if tag_marca and f"#{tag_marca}".lower() not in {h.lower() for h in hashtags}:
        hashtags.append(f"#{tag_marca}")

    if p.tipo == "mesmo":
        frase_preco = (
            f"Saiu por {regras.brl(p.preco)} ({regras.brl(p.economia)} a menos que o anúncio "
            f"comparado, que estava {regras.brl(p.antes)})."
        )
    else:
        frase_preco = (
            f"Saiu por {regras.brl(p.preco)}, {regras.brl(p.economia)} a menos que a 2ª loja "
            f"mais barata ({regras.brl(p.antes)})."
        )
    frete = "Frete grátis confirmado na comparação." if p.frete_gratis is True else "Frete a consultar no anúncio."
    descricao = "\n".join(
        [
            f"Procurando o melhor custo-benefício em {cat.lower()}? Comparei o preço do {r.nome} "
            "em várias lojas para achar o mesmo produto mais barato.",
            f"{frase_preco} Preço conferido em {r.conferido_texto}; preço e estoque podem mudar.",
            frete,
            "",
            f"👉 Onde comprar com menor preço e segurança: {p.link}",
            "",
            "Compare qualquer produto: https://melhorescolha.io",
            "",
            "Participamos de programas de afiliados. Comprando pelos links você apoia o canal "
            "sem pagar nada a mais.",
            "",
            " ".join(hashtags[:4]),
        ]
    )

    tags: list[str] = []
    for t in [
        "vale a pena comprar",
        "melhor preço",
        "onde comprar barato",
        "achadinhos",
        "custo benefício",
        marca,
        r.nome,
        nome_curto(p.titulo, 3),
        cat.lower(),
        "compare preços",
        "menor preço",
    ]:
        t = t.strip()
        if t and len(t) <= 30 and t.lower() not in {x.lower() for x in tags}:
            tags.append(t)
    tags = tags[:12]
    while sum(len(t) + 2 for t in tags) > 480:
        tags.pop()
    return {"titulo": titulo, "descricao": descricao, "tags": tags, "hashtags": hashtags[:4]}
