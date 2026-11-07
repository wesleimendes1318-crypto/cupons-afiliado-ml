/* HOME TOOLS GRID (Weslei, 07/11/2026: "Arrume a homepage para que todas as
   funcionalidades possam ser visualizadas e acessadas"). Every feature of the
   site one tap away from the home, right below the guided search. Seasonal
   pages only show while their season is highlighted. */
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  Gift,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  Send,
  ToyBrick,
  TreePine,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

import { temporadasEmDestaque } from "@/lib/sazonal";

type Ferramenta = { to: string; Icone: LucideIcon; cor: string; titulo: string; texto: string };

const FIXAS: Ferramenta[] = [
  {
    to: "/meus-precos",
    Icone: TrendingDown,
    cor: "#34c759",
    titulo: "Meus preços",
    texto: "Aviso quando o preço cair",
  },
  {
    to: "/favoritos",
    Icone: Heart,
    cor: "#ff2d55",
    titulo: "Lista de desejos",
    texto: "Guarde e mande no WhatsApp",
  },
  {
    to: "/amigo-secreto",
    Icone: Gift,
    cor: "#0071e3",
    titulo: "Amigo Secreto",
    texto: "Sorteio e presentes prontos",
  },
  {
    to: "/planejadores",
    Icone: ClipboardList,
    cor: "#af52de",
    titulo: "Planejadores",
    texto: "Casa nova, enxoval e mais",
  },
  {
    to: "/categorias",
    Icone: LayoutGrid,
    cor: "#5856d6",
    titulo: "Categorias",
    texto: "Ofertas já comparadas",
  },
  {
    to: "/brinquedos",
    Icone: ToyBrick,
    cor: "#ff9500",
    titulo: "Brinquedos",
    texto: "Escolha pela idade",
  },
  {
    to: "/guias",
    Icone: BookOpen,
    cor: "#007aff",
    titulo: "Guias de compra",
    texto: "Como escolher sem errar",
  },
  {
    to: "/telegram",
    Icone: Send,
    cor: "#30b0c7",
    titulo: "Ofertas no Telegram",
    texto: "Promoções conferidas",
  },
  {
    to: "/painel",
    Icone: LayoutDashboard,
    cor: "#636366",
    titulo: "Meu painel",
    texto: "Tudo o que você salvou",
  },
];

/* Only seasons with a page of their own (Black Friday has none yet). */
const SAZONAIS: Partial<Record<string, Ferramenta>> = {
  natal: {
    to: "/natal",
    Icone: TreePine,
    cor: "#ff3b30",
    titulo: "Natal",
    texto: "Presentes já comparados",
  },
  criancas: {
    to: "/dia-das-criancas",
    Icone: ToyBrick,
    cor: "#ff9500",
    titulo: "Dia das Crianças",
    texto: "Brinquedos já comparados",
  },
};

export function FerramentasHome({ className = "" }: { className?: string }) {
  const sazonais = temporadasEmDestaque()
    .map((t) => SAZONAIS[t.id])
    .filter((f): f is Ferramenta => Boolean(f));
  const itens = [...sazonais, ...FIXAS];
  return (
    <nav aria-labelledby="ferramentas-home" className={className}>
      <h2 id="ferramentas-home" className="text-lg font-extrabold tracking-tight">
        Tudo o que você encontra aqui
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {itens.map(({ to, Icone, cor, titulo, texto }, k) => (
          <li key={to} className="animate-cartao min-w-0" style={{ animationDelay: `${k * 30}ms` }}>
            <Link
              to={to}
              className="group flex h-full min-h-16 items-center gap-3 rounded-3xl bg-card p-3 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] motion-reduce:transform-none sm:p-4"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-2xl transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transform-none"
                style={{ background: `${cor}1a`, color: cor }}
                aria-hidden="true"
              >
                <Icone className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">{titulo}</span>
                <span className="mt-0.5 block text-xs leading-snug text-secondary-ink">
                  {texto}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
