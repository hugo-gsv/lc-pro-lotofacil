# Setup do Supabase

Persistência de longo prazo para os jogos gerados (substitui o SQLite local que é efêmero no Streamlit Cloud).

## 1. Criar projeto

1. Acesse <https://supabase.com> → **New Project**
2. Escolha:
   - **Name:** `lc-pro-lotofacil` (qualquer)
   - **Region:** `South America (São Paulo)` (mais perto = mais rápido)
   - **Database Password:** salve num cofre (não vai precisar agora, mas guarde)
3. Clique **Create** — leva ~2 min para provisionar.

## 2. Criar a tabela

1. No painel do projeto, abra **SQL Editor** (ícone `</>` na sidebar)
2. Clique em **New query**
3. Cole o conteúdo de [`supabase_schema.sql`](supabase_schema.sql)
4. Clique em **Run** (ou `Ctrl+Enter`)
5. Verifique em **Table Editor** que `jogos_gerados` apareceu

## 3. Pegar as credenciais

1. **Settings** (ícone engrenagem) → **API**
2. Copie:
   - **Project URL** (ex: `https://abcdefgh.supabase.co`)
   - **service_role** secret key — clique em **Reveal**, depois **Copy**

> ⚠️ A `service_role` key tem **permissão total no banco**. Nunca exponha no front-end.
> No Streamlit ela fica em `st.secrets` (lado servidor) — totalmente seguro.

## 4. Configurar no LC Pro

### Local (no seu Mac):

Crie o arquivo `.streamlit/secrets.toml` com:

```toml
[supabase]
url = "https://SEU-REF.supabase.co"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

(Use [`secrets.toml.example`](../.streamlit/secrets.toml.example) como referência.)

Reinicie o Streamlit:

```bash
streamlit run streamlit_app.py
```

### Streamlit Community Cloud:

1. Vá no app em <https://share.streamlit.io/>
2. **⋯ → Settings → Secrets**
3. Cole o mesmo bloco TOML acima
4. Save → o app reinicia automaticamente

## 5. Verificar

No app, vá em qualquer página e gere um jogo. Depois cheque no Supabase:

- **Table Editor → jogos_gerados** → deve aparecer a linha inserida.

Para ver qual backend está ativo no app, este código mostra:

```python
from lib.storage import backend_name
print(backend_name())  # "supabase" se conectado, "sqlite (local)" se cair pro fallback
```

## Migrar dados do SQLite local para Supabase

Se você gerou jogos localmente antes de configurar Supabase:

```python
from lib import storage_sqlite, storage_supabase

# Usa as credenciais do st.secrets (já configuradas)
import streamlit as st
sb = storage_supabase.SupabaseStorage(
    st.secrets["supabase"]["url"],
    st.secrets["supabase"]["service_key"],
)

for it in storage_sqlite.listar(limit=10000):
    full = storage_sqlite.carregar(it["id"])
    sb.salvar_jogos(full["nome"], full["tipo"], full["params"], full["jogos"])
```

## Custo

- **Free tier:** 500 MB de banco, 2 GB de transferência/mês — sobra muito.
- Cada jogo gerado ocupa ~10–50 KB (depende do nº de combinações).
- Pra estourar 500 MB precisaria de ~50.000 lotes — improvável.

## RLS / Multi-usuário

O schema atual tem RLS desabilitado (uso single-user com `service_role`).
Para multi-usuário com login Supabase Auth, habilite RLS e adicione policy:

```sql
alter table public.jogos_gerados enable row level security;
alter table public.jogos_gerados add column user_id uuid references auth.users on delete cascade;

create policy "users can read own"     on public.jogos_gerados for select using (auth.uid() = user_id);
create policy "users can insert own"   on public.jogos_gerados for insert with check (auth.uid() = user_id);
create policy "users can delete own"   on public.jogos_gerados for delete using (auth.uid() = user_id);
```

E o front passa a usar `anon_key` em vez de `service_key`.
