"""Backend Supabase para persistência dos jogos gerados.

Tabela esperada (rodar SQL em docs/supabase_schema.sql no SQL Editor):

    create table public.jogos_gerados (
        id bigserial primary key,
        nome text not null,
        tipo text,
        dt_criacao timestamptz default now() not null,
        params_json jsonb,
        jogos_json jsonb not null,
        n_jogos int not null
    );

Credenciais ficam em st.secrets["supabase"] (URL + service_key) ou em
variáveis de ambiente SUPABASE_URL / SUPABASE_KEY.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any

from supabase import Client, create_client


class SupabaseStorage:
    def __init__(self, url: str, key: str) -> None:
        self.client: Client = create_client(url, key)

    # ---------- writes ----------
    def salvar_jogos(self, nome: str, tipo: str, params: dict,
                     jogos: list[list[int]]) -> int:
        res = self.client.table("jogos_gerados").insert({
            "nome": nome,
            "tipo": tipo,
            "dt_criacao": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            "params_json": params,
            "jogos_json": jogos,
            "n_jogos": len(jogos),
        }).execute()
        if res.data:
            return int(res.data[0]["id"])
        return 0

    def excluir(self, id_: int) -> None:
        self.client.table("jogos_gerados").delete().eq("id", id_).execute()

    def renomear(self, id_: int, nome_novo: str) -> None:
        self.client.table("jogos_gerados").update(
            {"nome": nome_novo}
        ).eq("id", id_).execute()

    # ---------- reads ----------
    def listar(self, limit: int = 50, tipo: str | None = None) -> list[dict]:
        q = (
            self.client.table("jogos_gerados")
            .select("id, nome, tipo, dt_criacao, params_json, n_jogos")
            .order("id", desc=True)
            .limit(limit)
        )
        if tipo:
            q = q.eq("tipo", tipo)
        res = q.execute()
        return [
            {
                "id": r["id"], "nome": r["nome"], "tipo": r["tipo"],
                "dt": _to_local_str(r["dt_criacao"]),
                "params": r["params_json"] or {},
                "n_jogos": r["n_jogos"],
            }
            for r in (res.data or [])
        ]

    def carregar(self, id_: int) -> dict | None:
        res = (
            self.client.table("jogos_gerados")
            .select("*").eq("id", id_).limit(1).execute()
        )
        if not res.data:
            return None
        r = res.data[0]
        return {
            "id": r["id"], "nome": r["nome"], "tipo": r["tipo"],
            "dt": _to_local_str(r["dt_criacao"]),
            "params": r["params_json"] or {},
            "jogos": r["jogos_json"],
            "n_jogos": r["n_jogos"],
        }


def _to_local_str(iso: Any) -> str:
    """Converte ISO-8601 do Supabase em string legível."""
    if not iso:
        return ""
    s = str(iso).replace("T", " ")
    # remove os microssegundos e timezone para ficar curto
    if "." in s:
        s = s.split(".", 1)[0]
    if "+" in s:
        s = s.rsplit("+", 1)[0]
    return s.strip()
