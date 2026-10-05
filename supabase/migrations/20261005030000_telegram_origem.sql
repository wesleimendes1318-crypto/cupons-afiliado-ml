-- De onde veio a conversa com o bot (Weslei, 05/10): o convite do site usa
-- t.me/AfiliadosMELI_bot?start=<origem> (topo, home, resultado, meus_precos,
-- rodape, pagina_telegram, canal). Gravado so no primeiro contato.
ALTER TABLE public.telegram_chats ADD COLUMN IF NOT EXISTS origem text;
