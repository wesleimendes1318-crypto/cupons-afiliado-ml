-- PUBLIC SHARED WISHLIST (Weslei, 05/11/2026): /lista/<id>. Additive only.
-- Writes go only through the server route /api/public/lista-compartilhada
-- (service role): RLS on, no policies. The owner proves ownership with a
-- secret edit key (only its sha256 is stored); gift marks store a sha256 of
-- the marker's device token so only that device can undo them.
-- Reads are public on purpose through lista_publica(), which never returns
-- the hashes.

create table if not exists public.listas_compartilhadas (
  id text primary key check (id ~ '^[A-Za-z0-9]{10}$'),
  chave_hash text not null,
  usuario_id uuid,
  titulo text not null default '' check (char_length(titulo) <= 60),
  ocasiao text not null default '' check (char_length(ocasiao) <= 40),
  itens jsonb not null default '[]'::jsonb,
  status_presentes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.listas_compartilhadas enable row level security;

create or replace function public.lista_publica(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', l.id, 'titulo', l.titulo, 'ocasiao', l.ocasiao, 'itens', l.itens,
    'presentes', coalesce((select jsonb_object_agg(k, v - 'quem') from jsonb_each(l.status_presentes) as s(k, v)), '{}'::jsonb),
    'atualizada_em', l.updated_at)
  from public.listas_compartilhadas l where l.id = p_id;
$$;
revoke all on function public.lista_publica(text) from public;
grant execute on function public.lista_publica(text) to anon, authenticated;
