"""Núcleo de cálculo do LC Pro — fórmulas SPQ, CSN, MODAIS, filtros e API Caixa.

Validado byte-a-byte contra os arquivos do app Liberty BASIC original.
"""

from __future__ import annotations

import concurrent.futures as cf
import json
import ssl
import time
import urllib.request
from typing import Iterable

# ============================================================================
#  Constantes — geometria 5×5 da Lotofácil
# ============================================================================
MODAIS: set[int] = {1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 18, 20, 22, 24, 25}
"""15 dezenas-modal (Vid117 do canal Mais Chances Loterias).

Propriedades:
- 8 pares + 7 ímpares
- Formato 33333 em linhas e colunas
- Simetria perfeita (cada par soma 26) + dezena central 13
- Soma total = 195
"""

BORDAS: set[int] = {1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25}
"""Moldura do volante — 16 dezenas das bordas."""

PRIMOS: set[int] = {2, 3, 5, 7, 11, 13, 17, 19, 23}
FIBO:   set[int] = {1, 2, 3, 5, 8, 13, 21}


def linha_de(d: int) -> int:
    """Retorna 1..5 — linha da dezena no volante."""
    return (d - 1) // 5 + 1


def coluna_de(d: int) -> int:
    """Retorna 1..5 — coluna da dezena no volante."""
    return (d - 1) % 5 + 1


def formato_linha(dez: Iterable[int]) -> str:
    """5 dígitos: quantas dezenas em cada linha. Ex: '33423'."""
    cnt = [0] * 5
    for d in dez:
        cnt[(d - 1) // 5] += 1
    return "".join(str(x) for x in cnt)


def formato_coluna(dez: Iterable[int]) -> str:
    cnt = [0] * 5
    for d in dez:
        cnt[coluna_de(d) - 1] += 1
    return "".join(str(x) for x in cnt)


# ============================================================================
#  SPQ — Soma Ponderada por Quadro/Posição
# ============================================================================
def spq(fmt: str) -> int:
    """SPQ = Σ fᵢ·i (i = 1..5).
    Validado 9/9 contra a tabela do screenshot do autor.
    Range: 30 (formato 55500) a 60 (formato 00555)."""
    if len(fmt) != 5:
        return 0
    return sum(int(fmt[i]) * (i + 1) for i in range(5))


# ============================================================================
#  CSN — Combination Sequence Number
# ============================================================================
def _build_csn_map() -> dict[tuple[int, ...], int]:
    fmts: list[tuple[int, ...]] = []
    for a in range(6):
        for b in range(6):
            for c in range(6):
                for d in range(6):
                    e = 15 - a - b - c - d
                    if 0 <= e <= 5:
                        fmts.append((a, b, c, d, e))
    fmts_sorted = sorted(fmts, key=lambda t: int("".join(map(str, t))))
    return {f: rank for rank, f in enumerate(fmts_sorted, 1)}


_CSN_MAP: dict[tuple[int, ...], int] = _build_csn_map()


def csn(fmt: str) -> int:
    """CSN = rank crescente do formato como inteiro de 5 dígitos
    entre os 651 formatos com soma 15.
    Validado 9/9 contra a tabela do screenshot."""
    if len(fmt) != 5:
        return 0
    try:
        return _CSN_MAP.get(tuple(int(c) for c in fmt), 0)
    except ValueError:
        return 0


def todos_formatos() -> list[tuple[int, ...]]:
    """Os 651 formatos válidos, em ordem crescente (CSN=1 → CSN=651)."""
    return sorted(_CSN_MAP, key=lambda t: int("".join(map(str, t))))


# ============================================================================
#  Filtros (Pares, Modas, Bordas, Primos, Fibo, Posições, Retros)
# ============================================================================
def seq_max(dez: list[int]) -> int:
    s = sorted(dez); best = cur = 1
    for i in range(1, len(s)):
        if s[i] == s[i - 1] + 1:
            cur += 1; best = max(best, cur)
        else:
            cur = 1
    return best


def calc_var(nome: str, dez: list[int], retro_set: set[int]) -> int:
    sd = set(dez)
    if nome == "Pares":           return sum(1 for d in dez if d % 2 == 0)
    if nome == "Bordas":          return len(sd & BORDAS)
    if nome == "Modas":           return len(sd & MODAIS)
    if nome == "Primos":          return len(sd & PRIMOS)
    if nome == "Fibonacci":       return len(sd & FIBO)
    if nome == "Repetição Último": return len(sd & retro_set)
    if nome == "Posição 4":       return dez[3] if len(dez) >= 4 else 0
    if nome == "Posição 8":       return dez[7] if len(dez) >= 8 else 0
    if nome == "Posição 12":      return dez[11] if len(dez) >= 12 else 0
    if nome == "Soma":            return sum(dez)
    if nome == "Sequência máxima": return seq_max(dez)
    return 0


# ============================================================================
#  API oficial da Caixa (servicebus2)
# ============================================================================
CAIXA_API = "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil"


def _ssl_ctx() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def fetch_concurso(concurso: int | None = None, timeout: float = 30.0) -> dict:
    """Busca um concurso da API. Sem argumento → último."""
    url = CAIXA_API if concurso is None else f"{CAIXA_API}/{concurso}"
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 lc-pro-lotofacil/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_concurso_retry(concurso: int, attempts: int = 4,
                         timeout: float = 30.0) -> dict | None:
    for i in range(attempts):
        try:
            return fetch_concurso(concurso, timeout=timeout)
        except Exception:  # noqa: BLE001
            if i == attempts - 1:
                return None
            time.sleep(0.5 * (i + 1))
    return None


def fetch_range(start: int, end: int, max_workers: int = 10,
                progress_cb=None) -> dict[int, dict]:
    """Baixa concursos [start, end] em paralelo."""
    out: dict[int, dict] = {}
    with cf.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(fetch_concurso_retry, n): n
                   for n in range(start, end + 1)}
        done = 0
        for f in cf.as_completed(futures):
            n = futures[f]
            try:
                d = f.result()
                if d:
                    out[n] = d
            except Exception:  # noqa: BLE001
                pass
            done += 1
            if progress_cb:
                progress_cb(done, len(futures))
    return out


def dezenas_de(api_dict: dict) -> list[int]:
    return sorted(int(x) for x in api_dict["listaDezenas"])
