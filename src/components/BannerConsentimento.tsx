import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useConsentimento } from "@/hooks/useConsentimento";
import { salvarConsentimento } from "@/lib/consentimento";

export function BannerConsentimento() {
  const { preferencias, pronto } = useConsentimento();
  const [aberto, setAberto] = useState(false);
  const [detalhes, setDetalhes] = useState(false);
  const [analise, setAnalise] = useState(false);
  const [publicidade, setPublicidade] = useState(false);

  useEffect(() => {
    const abrir = () => {
      setAnalise(preferencias?.analise ?? false);
      setPublicidade(preferencias?.publicidade ?? false);
      setDetalhes(true);
      setAberto(true);
    };
    window.addEventListener("abrir-preferencias-cookies", abrir);
    return () => window.removeEventListener("abrir-preferencias-cookies", abrir);
  }, [preferencias]);

  useEffect(() => {
    if (pronto && !preferencias) setAberto(true);
  }, [pronto, preferencias]);

  if (!aberto) return null;

  const decidir = (escolha: { analise: boolean; publicidade: boolean }) => {
    salvarConsentimento(escolha);
    setAberto(false);
    setDetalhes(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/98 p-4 shadow-[0_-8px_28px_rgba(0,0,0,0.12)] backdrop-blur"
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold">Cookies e privacidade</p>
        <p className="mt-1 text-xs leading-relaxed text-secondary-ink">
          Usamos cookies essenciais para o site funcionar. Só com a sua autorização usamos
          cookies de medição de audiência e de publicidade. Você pode mudar de ideia quando
          quiser.
        </p>

        {detalhes && (
          <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Essenciais</p>
                <p className="text-xs text-secondary-ink">
                  Necessários para exibir as páginas e lembrar esta escolha. Sempre ativos.
                </p>
              </div>
              <Switch checked disabled aria-label="Cookies essenciais, sempre ativos" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Medição de audiência</p>
                <p className="text-xs text-secondary-ink">
                  Contagem de visitas e de páginas mais úteis, sem identificar você.
                </p>
              </div>
              <Switch checked={analise} onCheckedChange={setAnalise} aria-label="Cookies de medição" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Publicidade</p>
                <p className="text-xs text-secondary-ink">
                  Anúncios de terceiros. Hoje o site não exibe nenhum anúncio.
                </p>
              </div>
              <Switch
                checked={publicidade}
                onCheckedChange={setPublicidade}
                aria-label="Cookies de publicidade"
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decidir({ analise: true, publicidade: true })}>
            Aceitar todos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => decidir({ analise: false, publicidade: false })}
          >
            Recusar opcionais
          </Button>
          {detalhes ? (
            <Button size="sm" variant="ghost" onClick={() => decidir({ analise, publicidade })}>
              Salvar minha escolha
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setDetalhes(true)}>
              Gerenciar preferências
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
