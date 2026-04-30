"""Storage adaptativo: tenta Supabase primeiro, cai para SQLite se sem credenciais.

Configuração do Supabase (recomendado em produção):
- Em local: edite .streamlit/secrets.toml
    [supabase]
    url = "https://xxx.supabase.co"
    service_key = "eyJ..."
- Em Streamlit Cloud: Settings → Secrets → cola o mesmo bloco
- Ou variáveis de ambiente: SUPABASE_URL e SUPABASE_KEY
"""

from __future__ import annotations

import os
from typing import Callable

from . import storage_sqlite as _sqlite

# Detect Supabase config (st.secrets primeiro, env vars depois)
_URL: str | None = None
_KEY: str | None = None

try:
    import streamlit as _st  # type: ignore
    try:
        sb = _st.secrets.get("supabase", {}) if hasattr(_st, "secrets") else {}
        _URL = sb.get("url")
        _KEY = sb.get("service_key") or sb.get("anon_key")
    except Exception:
        pass
except ImportError:
    pass

if not (_URL and _KEY):
    _URL = os.environ.get("SUPABASE_URL") or _URL
    _KEY = os.environ.get("SUPABASE_KEY") or _KEY

USE_SUPABASE = bool(_URL and _KEY)
_sb_storage = None  # lazy


def _backend():
    global _sb_storage
    if USE_SUPABASE:
        if _sb_storage is None:
            from .storage_supabase import SupabaseStorage
            _sb_storage = SupabaseStorage(_URL, _KEY)  # type: ignore[arg-type]
        return _sb_storage
    return _sqlite


def backend_name() -> str:
    return "supabase" if USE_SUPABASE else "sqlite (local)"


# ---------- API pública ----------
def salvar_jogos(nome: str, tipo: str, params: dict,
                 jogos: list[list[int]]) -> int:
    return _backend().salvar_jogos(nome, tipo, params, jogos)


def listar(limit: int = 50, tipo: str | None = None) -> list[dict]:
    return _backend().listar(limit=limit, tipo=tipo)


def carregar(id_: int) -> dict | None:
    return _backend().carregar(id_)


def ultimo(tipo: str | None = None) -> dict | None:
    rows = listar(limit=1, tipo=tipo)
    if not rows:
        return None
    return carregar(rows[0]["id"])


def excluir(id_: int) -> None:
    _backend().excluir(id_)


def renomear(id_: int, nome_novo: str) -> None:
    _backend().renomear(id_, nome_novo)
