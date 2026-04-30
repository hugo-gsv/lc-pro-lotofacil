"""Armazenamento persistente dos jogos gerados (SQLite).

⚠️ No Streamlit Community Cloud o filesystem é EFÊMERO — o DB pode ser
resetado quando o app reinicia. Para persistência de longo prazo, migrar
para Supabase/Turso (basta trocar `_conn()` por SQLAlchemy + cloud DSN).
"""

from __future__ import annotations

import datetime as _dt
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "lc.db"


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.execute(
        """CREATE TABLE IF NOT EXISTS jogos_gerados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT,
            dt_criacao TEXT NOT NULL,
            params_json TEXT,
            jogos_json TEXT NOT NULL,
            n_jogos INTEGER NOT NULL
        )"""
    )
    return con


def salvar_jogos(nome: str, tipo: str, params: dict,
                 jogos: list[list[int]]) -> int:
    """Insere um lote de jogos e retorna o id criado."""
    with _conn() as con:
        cur = con.execute(
            "INSERT INTO jogos_gerados "
            "(nome, tipo, dt_criacao, params_json, jogos_json, n_jogos) "
            "VALUES (?,?,?,?,?,?)",
            (
                nome,
                tipo,
                _dt.datetime.now().isoformat(timespec="seconds"),
                json.dumps(params, ensure_ascii=False),
                json.dumps(jogos),
                len(jogos),
            ),
        )
        return int(cur.lastrowid or 0)


def listar(limit: int = 50, tipo: str | None = None) -> list[dict]:
    sql = (
        "SELECT id, nome, tipo, dt_criacao, params_json, n_jogos "
        "FROM jogos_gerados "
    )
    args: tuple = ()
    if tipo:
        sql += "WHERE tipo = ? "
        args = (tipo,)
    sql += "ORDER BY id DESC LIMIT ?"
    args = args + (limit,)
    with _conn() as con:
        rows = con.execute(sql, args).fetchall()
    return [
        {
            "id": r[0], "nome": r[1], "tipo": r[2],
            "dt": r[3],
            "params": json.loads(r[4]) if r[4] else {},
            "n_jogos": r[5],
        }
        for r in rows
    ]


def carregar(id_: int) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT id, nome, tipo, dt_criacao, params_json, jogos_json, n_jogos "
            "FROM jogos_gerados WHERE id = ?",
            (id_,),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row[0], "nome": row[1], "tipo": row[2],
        "dt": row[3],
        "params": json.loads(row[4]) if row[4] else {},
        "jogos": json.loads(row[5]),
        "n_jogos": row[6],
    }


def ultimo(tipo: str | None = None) -> dict | None:
    """Retorna o jogo mais recente, opcionalmente filtrado por tipo."""
    rows = listar(limit=1, tipo=tipo)
    if not rows:
        return None
    return carregar(rows[0]["id"])


def excluir(id_: int) -> None:
    with _conn() as con:
        con.execute("DELETE FROM jogos_gerados WHERE id = ?", (id_,))


def renomear(id_: int, nome_novo: str) -> None:
    with _conn() as con:
        con.execute(
            "UPDATE jogos_gerados SET nome = ? WHERE id = ?",
            (nome_novo, id_),
        )
