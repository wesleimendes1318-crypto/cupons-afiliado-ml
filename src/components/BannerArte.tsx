/* BANNER COM ARTE (09/10): abertura de seção das categorias e vitrines com
   as artes do pacote ME-Imagens (src/lib/artes.ts). Título, texto e botões
   são do site (HTML), nunca da imagem.
   - PC: a arte ocupa o banner inteiro; o texto fica na área livre da
     esquerda, sobre um véu em degradê da cor do tom (contraste garantido).
   - Celular: a arte vira uma faixa no topo, enquadrada nos objetos, e o
     texto vem abaixo, no cartão (nada de texto sobre a foto em tela
     pequena).
   A imagem é decorativa (alt vazio): o conteúdo está no texto. */
import type { CSSProperties, ReactNode } from "react";

import { ALTURA_ARTE, LARGURA_ARTE, srcArte, type Arte } from "@/lib/artes";

export function BannerArte({
  arte,
  etiqueta,
  titulo,
  resumo,
  children,
  prioridade = false,
  comoTitulo = "h1",
  className = "",
}: {
  arte: Arte;
  etiqueta?: string;
  titulo: string;
  resumo?: string;
  /* Botões e links abaixo do texto. */
  children?: ReactNode;
  /* Banner do topo da página: carrega primeiro (sem lazy). */
  prioridade?: boolean;
  comoTitulo?: "h1" | "h2";
  className?: string;
}) {
  const escuro = arte.tom === "escuro";
  const Titulo = comoTitulo;
  return (
    <section
      className={
        "relative overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] sm:min-h-[340px] lg:min-h-[380px] " +
        className
      }
    >
      {/* Arte: faixa no celular, fundo inteiro no PC. */}
      <div className="relative h-44 overflow-hidden min-[480px]:h-56 sm:absolute sm:inset-0 sm:h-auto">
        <picture>
          <source media="(max-width: 639px)" srcSet={srcArte(arte.id, true)} />
          <img
            src={srcArte(arte.id)}
            width={LARGURA_ARTE}
            height={ALTURA_ARTE}
            alt=""
            loading={prioridade ? "eager" : "lazy"}
            fetchPriority={prioridade ? "high" : "auto"}
            decoding="async"
            className="banner-arte-img absolute inset-0 h-full w-full object-cover"
            style={
              {
                "--foco": arte.foco,
                "--foco-celular": arte.focoCelular,
              } as CSSProperties
            }
          />
        </picture>
        {/* Véu do PC: garante a leitura do texto na área livre. */}
        <span
          aria-hidden="true"
          className={
            "absolute inset-0 hidden sm:block " +
            (escuro ? "banner-veu-escuro" : "banner-veu-claro")
          }
        />
      </div>

      <div
        className={
          "relative px-5 pb-5 pt-4 sm:flex sm:min-h-[340px] sm:max-w-[54%] sm:flex-col sm:justify-center sm:px-8 sm:py-8 lg:min-h-[380px] lg:max-w-[48%] lg:px-10 " +
          (escuro ? "sm:text-white" : "sm:text-[#1d1d1f] sm:dark:text-white")
        }
      >
        {etiqueta && (
          <p
            className={
              "inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] " +
              (escuro
                ? "bg-[#F7F5FC] text-[#21134A] sm:bg-white/15 sm:text-white"
                : "bg-[#F7F5FC] text-[#5b36d6]")
            }
          >
            {etiqueta}
          </p>
        )}
        <Titulo className="mt-2.5 text-[26px] font-extrabold leading-[1.12] tracking-tight sm:text-[32px] lg:text-[38px]">
          {titulo}
        </Titulo>
        {resumo && (
          <p
            className={
              "mt-2.5 text-sm leading-relaxed sm:text-base " +
              (escuro
                ? "text-secondary-ink sm:text-white/85"
                : "text-secondary-ink sm:text-[#424245] sm:dark:text-white/85")
            }
          >
            {resumo}
          </p>
        )}
        {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
      </div>
    </section>
  );
}
