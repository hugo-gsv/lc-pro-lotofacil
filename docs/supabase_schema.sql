-- ============================================================================
-- LC Pro Lotofácil — Schema Supabase
-- ============================================================================
-- Como usar:
--   1. Crie um projeto em https://supabase.com (free tier)
--   2. Abra "SQL Editor" no menu lateral
--   3. Cole TODO esse arquivo e clique em "Run"
--   4. Em "Settings → API" pegue:
--        - Project URL  →  vai em st.secrets["supabase"]["url"]
--        - service_role key (secret) → vai em st.secrets["supabase"]["service_key"]
-- ============================================================================

create table if not exists public.jogos_gerados (
    id           bigserial primary key,
    nome         text not null,
    tipo         text,
    dt_criacao   timestamptz default now() not null,
    params_json  jsonb,
    jogos_json   jsonb not null,
    n_jogos      int not null
);

-- Índices
create index if not exists idx_jogos_gerados_id_desc on public.jogos_gerados (id desc);
create index if not exists idx_jogos_gerados_tipo    on public.jogos_gerados (tipo);

-- RLS desabilitado para uso single-user via service_role.
-- (Para multi-usuário com auth, habilite RLS e crie policies por user_id.)
alter table public.jogos_gerados disable row level security;
