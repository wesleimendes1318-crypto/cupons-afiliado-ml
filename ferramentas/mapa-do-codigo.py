"""Write docs/mapa-do-codigo.md (code map for Lovable and agents) from the Graphify graph.

Run from the repo root:  graphify update . && python3 ferramentas/mapa-do-codigo.py
"""
import collections
import json
import pathlib
import re
import subprocess
from datetime import date

RAIZ = pathlib.Path(__file__).resolve().parent.parent
GRAFO = RAIZ / "graphify-out" / "graph.json"
SAIDA = RAIZ / "docs" / "mapa-do-codigo.md"

# area id -> (name, paths, what it is); order = order in the doc
AREAS = {
    "paginas": ("Site pages", "src/routes/*.tsx, src/router.tsx", "Routes visitors open: home (index.tsx), categories, campaigns, guides, Meus preços, admin."),
    "componentes": ("Screens and blocks", "src/components/ (except ui/)", "Blocks that build the pages: link search, guided search, showcases, marketplace comparison."),
    "ui": ("Base UI kit", "src/components/ui/", "shadcn primitives: buttons, menus, forms, carousels."),
    "logica": ("Comparator engine", "src/lib/, src/hooks/, src/content/, src/integrations/", "Same-product check, search, recommendations, shipping, delivery date, visitor profile, affiliate links. Center of the system."),
    "lojas": ("Amazon and Shopee", "src/lib/integracoes/", "On-demand search in the other stores."),
    "servidor": ("Server and jobs", "src/routes/api/, src/server.ts, src/lib/mcp/", "Public APIs and scheduled jobs: sourcing cron, Telegram webhook, operation, search."),
    "banco": ("Database (Supabase)", "supabase/, drizzle/", "Tables and functions in project itgdvxvqbwjcvmglfval."),
    "extensao": ("Browser extension", "extensao/", "Generates Weslei's affiliate links and compares prices (background.js, comparador.js, sincronia.js)."),
    "testes": ("Tests", "tests/, extensao/testes/", "bun tests; a failure blocks push and merge."),
    "shorts": ("YouTube Shorts", "scripts/automacao_shorts/, ferramentas/video/", "Standalone Python pipeline: product radar, script, video edit, upload."),
    "regras": ("Rules and docs", "CLAUDE.md, AGENTS.md, docs/", "Project rules, topic files, intelligence reports."),
    "config": ("Packages and config", "package.json, tsconfig.json, public/, .lovable/, ferramentas/", "Dependencies, TypeScript, app manifest, extension check tools."),
}


def area(f):
    if not f:
        return None
    if f.startswith("src/components/ui/"): return "ui"
    if f.startswith("src/components/"): return "componentes"
    if f.startswith("src/lib/integracoes/"): return "lojas"
    if f.startswith(("src/routes/api/", "src/lib/mcp/")) or f in ("src/server.ts", "src/start.ts", "src/routes/mcp.ts"): return "servidor"
    if f.startswith("src/routes/") or f in ("src/router.tsx", "src/routeTree.gen.ts"): return "paginas"
    if f.startswith(("src/lib/", "src/hooks/", "src/content/", "src/integrations/")): return "logica"
    if f.startswith(("tests/", "extensao/testes/")): return "testes"
    if f.startswith("extensao/"): return "extensao"
    if f.startswith(("supabase/", "drizzle/")) or f == "drizzle.config.ts" or f.endswith(".sql"): return "banco"
    if f.startswith(("scripts/automacao_shorts/", "ferramentas/video/")): return "shorts"
    if f.startswith("docs/") or f.endswith(".md"): return "regras"
    if "/" not in f or f.startswith(("ferramentas/", ".lovable/", "public/", ".claude/")): return "config"
    return None


def rpc_chamadas(pasta, funcoes):
    """Distinct DB function names called by name (.rpc("x") or rpc/x) in a folder, tests excluded."""
    nomes = set()
    for p in (RAIZ / pasta).rglob("*"):
        if p.suffix in (".js", ".mjs", ".ts", ".tsx") and "testes" not in p.parts and "node_modules" not in p.parts:
            nomes |= set(re.findall(r"""(?:\.rpc\(\s*["'`]|rpc/)([a-z0-9_]+)""", p.read_text(errors="ignore")))
    return len(nomes & funcoes)


def main():
    g = json.loads(GRAFO.read_text())
    nos = {n["id"]: n for n in g["nodes"]}
    A = {i: area(n.get("source_file")) for i, n in nos.items()}
    grau, pares = collections.Counter(), collections.Counter()
    for e in g["links"]:
        s, t = e["source"], e["target"]
        grau[s] += 1
        grau[t] += 1
        a, b = A.get(s), A.get(t)
        if a and b and a != b:
            pares[tuple(sorted((a, b)))] += 1
    funcoes = set()
    for p in (RAIZ / "supabase").rglob("*.sql"):
        funcoes |= {m.lower() for m in re.findall(r"(?i)create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)", p.read_text(errors="ignore"))}
    rpc_ext, rpc_site = rpc_chamadas("extensao", funcoes), rpc_chamadas("src", funcoes)

    por_area = collections.defaultdict(list)
    for i, a in A.items():
        if a:
            por_area[a].append(i)
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=RAIZ, capture_output=True, text=True).stdout.strip()
    rotulo = lambda i: nos[i]["label"].split(" (moved")[0][:50]

    L = [
        "# Code map (melhorescolha.io)",
        "",
        f"Generated {date.today():%d/%m/%Y} from commit `{commit}` by Graphify (tree-sitter, no AI).",
        "Regenerate: `graphify update . && python3 ferramentas/mapa-do-codigo.py`.",
        "Counts are code links (imports, calls, references), not site traffic.",
        "Read this before changing code to see what lives where and what a change can break.",
        "",
        "```mermaid",
        "flowchart TB",
    ]
    for a, (nome, _, _) in AREAS.items():
        L.append(f'  {a}["{nome}<br/>{len(por_area[a])} pieces"]')
    for (a, b), c in pares.most_common():
        if c >= 20:
            L.append(f"  {a} ---|{c}| {b}")
    L += [f"  extensao -.-|{rpc_ext} DB functions| banco", f"  logica -.-|{rpc_site} DB functions| banco", "```", ""]
    L += ["Solid line: code links between areas (20+ shown). Dotted: Supabase functions called by name.", ""]

    L += ["## Areas", "", "| Area | Paths | Pieces | Files | What it is | Most connected |", "|---|---|---|---|---|---|"]
    for a, (nome, caminhos, oque) in AREAS.items():
        ids = por_area[a]
        arquivos = {nos[i].get("source_file") for i in ids}
        top = ", ".join(f"`{rotulo(i)}`" for i in sorted(ids, key=lambda i: -grau[i])[:3])
        L.append(f"| {nome} | `{caminhos}` | {len(ids)} | {len(arquivos)} | {oque} | {top} |")

    L += ["", "## Strongest links between areas", ""]
    for (a, b), c in pares.most_common(8):
        L.append(f"- {AREAS[a][0]} ↔ {AREAS[b][0]}: {c}")

    L += [
        "",
        "## Things the map makes clear",
        "",
        f"- The extension never imports site code. Extension and site talk only through Supabase functions ({rpc_ext} called by the extension, {rpc_site} by the site). Changing a function's signature breaks both sides: create a `_v2` instead (rule in CLAUDE.md).",
        "- YouTube Shorts is standalone Python and shares no code with the site.",
        "- Every buy path must still end in Weslei's affiliate link (rule no. 1); check the pieces below when touching links or buttons.",
        "",
        "## Most connected pieces (widest impact when changed)",
        "",
        "| # | Piece | File | Area | Links |",
        "|---|---|---|---|---|",
    ]
    centrais = sorted((i for i in nos if A[i]), key=lambda i: -grau[i])[:12]
    for n, i in enumerate(centrais, 1):
        L.append(f"| {n} | `{rotulo(i)}` | `{nos[i].get('source_file')}` | {AREAS[A[i]][0]} | {grau[i]} |")

    # self-check: every area is populated and nothing is counted twice
    assert all(por_area[a] for a in AREAS), [a for a in AREAS if not por_area[a]]
    assert sum(len(v) for v in por_area.values()) <= len(nos)
    SAIDA.write_text("\n".join(L) + "\n")
    print(f"{SAIDA.relative_to(RAIZ)}: {len(nos)} pieces, {len(L)} lines")


if __name__ == "__main__":
    main()
