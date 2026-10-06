-- "Receber até" no bot (06/10): CEP informado pelo cliente na conversa, para
-- as próximas comparações. Só o servidor lê (a tabela já é só serviço).
alter table public.telegram_chats add column if not exists cep text;
