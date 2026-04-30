"""Página Filtrar Jogo — clone web do "Filtros" do LC Pro original.

10 filtros validados:
  Pares, Bordas, Modas (MODAIS), Primos, Fibonacci, Repetição Último,
  Posição 4, Posição 8, Posição 12.

Aceita upload do arquivo de jogos (gerado pelo Gerador) e devolve XXXAAF.txt.
"""

from __future__ import annotations

import io

import streamlit as st

from lib.lottery import calc_var, dezenas_de, fetch_concurso_retry, fetch_range


st.set_page_config(page_title="Filtrar Jogo — LC Pro", page_icon="🔍", layout="wide")
st.title("🔍 Filtrar Jogo — SISTEMA LC Pro")


def parse_game(line: str) -> list[int] | None:
    s = line
    if ">" in s: s = s.split(">", 1)[1]
    if "=" in s: s = s.split("=", 1)[0]
    tokens = [int(p) for p in s.replace(",", " ").split() if p.isdigit()]
    dez = [t for t in tokens if 1 <= t <= 25]
    if len(dez) >= 15:
        cand = dez[-15:]
        if len(set(cand)) == 15:
            return sorted(cand)
    return None


# ---------- Topo: concurso-alvo + arquivo ----------
top1, top2 = st.columns([1, 3])
with top1:
    conc = st.number_input("Concurso Número", min_value=2, value=3674, step=1)
with top2:
    arquivo = st.file_uploader("Localiza Jogos (arquivo .txt)", type=["txt"])


# ---------- Carrega jogos ----------
jogos: list[list[int]] = []
if arquivo is not None:
    txt = arquivo.read().decode("utf-8", errors="replace")
    for ln in txt.splitlines():
        g = parse_game(ln)
        if g:
            jogos.append(g)


# ---------- Histórico para "Ocorridos nos últimos 10 resultados" ----------
@st.cache_data(ttl=600)
def carrega_serie(target: int) -> list[list[int]]:
    raw = fetch_range(max(1, target - 10), target - 1)
    return [dezenas_de(raw[c]) for c in sorted(raw)]


with st.spinner("Buscando últimos 10 resultados..."):
    serie = carrega_serie(int(conc))


# ---------- Layout: Esquerda = série | Direita = filtros ----------
left, right = st.columns([1, 1])

with left:
    st.markdown("**Ocorridos nos últimos 10 resultados** _(esquerda = mais antigo)_")
    nomes_serie = ["Pares", "Bordas", "Modas", "Primos", "Fibonacci",
                    "Repetição Último", "Posição 4", "Posição 8", "Posição 12"]
    if serie:
        prev = None
        rows = {n: [] for n in nomes_serie}
        for d in serie:
            retro = prev or set()
            for n in nomes_serie:
                rows[n].append(calc_var(n, d, retro))
            prev = set(d)
        for n in nomes_serie:
            valores = " ".join(f"{v:>2}" for v in rows[n])
            st.markdown(f"**{n}**  `{valores}`")
    else:
        st.info("Sem histórico disponível.")


with right:
    st.markdown("**Filtros**")
    if "filtro_cfg" not in st.session_state:
        st.session_state.filtro_cfg = {}

    filtros_def = [
        ("Pares",            8, 8),
        ("Bordas",           9, 11),
        ("Modas",            8, 9),
        ("Primos",           6, 7),
        ("Fibonacci",        5, 6),
        ("Repetição Último", 7, 10),
        ("Posição 4",        0, 25),
        ("Posição 8",        0, 25),
        ("Posição 12",       0, 25),
    ]
    cfg: dict[str, dict] = {}
    for nome, mn_def, mx_def in filtros_def:
        c1, c2, c3 = st.columns([1, 1, 1])
        on = c1.checkbox(nome, key=f"on_{nome}")
        mn = c2.number_input("Min", key=f"mn_{nome}", value=mn_def,
                              label_visibility="collapsed", min_value=0, max_value=999)
        mx = c3.number_input("Max", key=f"mx_{nome}", value=mx_def,
                              label_visibility="collapsed", min_value=0, max_value=999)
        cfg[nome] = {"on": on, "min": int(mn), "max": int(mx)}


st.divider()

# ---------- Aplicar filtro ----------
b1, b2 = st.columns([1, 3])
if b1.button("Filtrar jogos", type="primary", use_container_width=True):
    if not jogos:
        st.error("Carregue um arquivo de jogos primeiro.")
    else:
        retro = set(serie[-1]) if serie else set()
        aprovados = []
        elim_counts: dict[str, int] = {n: 0 for n, _, _ in filtros_def}
        for j in jogos:
            ok = True
            for n, _, _ in filtros_def:
                f = cfg[n]
                if not f["on"]:
                    continue
                v = calc_var(n, j, retro)
                if not (f["min"] <= v <= f["max"]):
                    elim_counts[n] += 1
                    ok = False
            if ok:
                aprovados.append(j)
        st.session_state.aprovados = aprovados
        st.session_state.elim_counts = elim_counts
        st.session_state.lidas = len(jogos)


if "aprovados" in st.session_state:
    aceitos = st.session_state.aprovados
    elim = st.session_state.elim_counts
    st.markdown(f"**Lidas:** {st.session_state.lidas}  •  "
                f"**Aceitas:** {len(aceitos)}")
    with st.expander("Eliminadas por filtro"):
        for n, _, _ in filtros_def:
            if cfg[n]["on"]:
                st.write(f"  {n}: {elim[n]}")

    if aceitos:
        # Download
        buf = io.StringIO()
        for j in aceitos:
            buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
        nome_out = (arquivo.name.rsplit(".", 1)[0] + "F.txt") if arquivo else "filtrado.txt"
        st.download_button(
            "⬇️ Baixar jogos filtrados",
            data=buf.getvalue().encode("ascii"),
            file_name=nome_out,
            mime="text/plain",
        )
        with st.expander(f"Ver jogos aprovados ({len(aceitos)})"):
            for i, j in enumerate(aceitos[:500], 1):
                st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
            if len(aceitos) > 500:
                st.caption(f"(mostrando 500 de {len(aceitos)})")
