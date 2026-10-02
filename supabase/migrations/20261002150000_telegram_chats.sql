-- BOT DO TELEGRAM (Weslei, 02/10): lembra quem ja conversou (boas-vindas e
-- video so no primeiro acesso) e conta as respostas do dia que usam o
-- modelo de linguagem (limite por conversa, para nao gastar a cota da
-- conferencia pela foto). So o servidor (service role) le e grava.
CREATE TABLE IF NOT EXISTS public.telegram_chats (
  chat_id bigint PRIMARY KEY,
  primeiro_em timestamptz NOT NULL DEFAULT now(),
  ultimo_em timestamptz NOT NULL DEFAULT now(),
  ia_dia date,
  ia_usos integer NOT NULL DEFAULT 0
);
ALTER TABLE public.telegram_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_chats FROM anon, authenticated;
