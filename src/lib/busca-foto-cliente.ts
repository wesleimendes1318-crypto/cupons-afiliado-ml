/* Busca por foto no navegador (09/10): a pessoa escolhe a origem (câmera ou
   galeria), vê a prévia e só então CONSENTE o envio ("Usar esta foto";
   Weslei, 09/10: "sempre com o consentimento do usuário"). Aí a foto é
   reduzida, vai para /api/public/buscar-foto e decide: certeza -> compara
   sozinho; senão a pessoa escolhe entre os produtos achados. Nada sai do
   aparelho antes do consentimento, e a foto não é guardada. */
import { useCallback, useEffect, useState } from "react";

import type { Identificacao } from "@/lib/busca-foto";
import type { ResultadoBusca } from "@/lib/busca-guiada";
import { otimizarImagem } from "@/lib/otimizar-imagem";

export type EstadoFoto =
  | { fase: "parado" }
  /* Escolher entre câmera e galeria. */
  | { fase: "origem" }
  /* Prévia esperando o consentimento. */
  | { fase: "confirmar"; arquivo: File; previa: string }
  | { fase: "lendo" }
  | { fase: "escolher"; identificado: Identificacao | null; candidatos: ResultadoBusca[] }
  | { fase: "erro"; mensagem: string };

const SEM_PRODUTO =
  "Não identifiquei o produto nesta foto. Tente uma foto de frente, com o nome ou o modelo visível, ou cole o link do anúncio.";

export function useBuscaPorFoto(comparar: (url: string) => void) {
  const [estado, setEstado] = useState<EstadoFoto>({ fase: "parado" });

  /* A prévia é um endereço local (blob:); solto ao sair da confirmação. */
  const previa = estado.fase === "confirmar" ? estado.previa : null;
  useEffect(() => {
    if (!previa) return;
    return () => URL.revokeObjectURL(previa);
  }, [previa]);

  const abrir = useCallback(() => setEstado({ fase: "origem" }), []);

  const escolher = useCallback((arquivo: File) => {
    if (!/^image\//.test(arquivo.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name)) {
      setEstado({ fase: "erro", mensagem: "Este arquivo não é uma foto. Escolha uma imagem." });
      return;
    }
    setEstado({ fase: "confirmar", arquivo, previa: URL.createObjectURL(arquivo) });
  }, []);

  const enviar = useCallback(
    async (arquivo: File) => {
      setEstado({ fase: "lendo" });
      try {
        const { base64 } = await otimizarImagem(arquivo);
        const r = await fetch("/api/public/buscar-foto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagem: base64 }),
        });
        const j = (await r.json().catch(() => null)) as {
          erro?: string;
          identificado?: Identificacao | null;
          candidatos?: ResultadoBusca[];
          confiante?: boolean;
        } | null;
        if (!r.ok) {
          setEstado({
            fase: "erro",
            mensagem: j?.erro ?? "Não deu para ler esta foto agora. Tente de novo ou cole o link.",
          });
          return;
        }
        const candidatos = (j?.candidatos ?? []).filter((c) =>
          /^https:\/\/www\.mercadolivre\.com\.br\/p\/MLB\d+/.test(c.url),
        );
        if (!j?.identificado || !candidatos.length) {
          setEstado({ fase: "erro", mensagem: SEM_PRODUTO });
          return;
        }
        if (j.confiante) {
          setEstado({ fase: "parado" });
          comparar(candidatos[0]!.url);
          return;
        }
        setEstado({ fase: "escolher", identificado: j.identificado, candidatos });
      } catch {
        setEstado({
          fase: "erro",
          mensagem: "Não deu para ler esta foto. Tente outra foto ou cole o link do anúncio.",
        });
      }
    },
    [comparar],
  );

  /* Só com o "Usar esta foto". */
  const consentir = useCallback(() => {
    if (estado.fase === "confirmar") void enviar(estado.arquivo);
  }, [estado, enviar]);

  const fechar = useCallback(() => setEstado({ fase: "parado" }), []);
  return { estado, abrir, escolher, consentir, fechar };
}
