/* Variáveis do Vite usadas no navegador. Acesso sempre com ponto
   (import.meta.env.VITE_X): com colchetes o Vite põe o objeto inteiro do
   .env no javascript do site, e em 19/10 a chave do banco antigo do Lovable
   que estava lá fez a extensão ser recusada pelo banco novo (401). */
interface ImportMetaEnv {
  /** Publisher ID do AdSense (ca-pub-...). Vazio = anúncios desligados. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** Slots manuais dos dois espaços do artigo dos Guias. */
  readonly VITE_ADSENSE_SLOT_GUIA_MEIO?: string;
  readonly VITE_ADSENSE_SLOT_GUIA_FIM?: string;
  readonly VITE_GA_ID?: string;
}
