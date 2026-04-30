"""Filtrar Jogo — versão web profissional."""

from __future__ import annotations

import io

import streamlit as st

from lib.lottery import calc_var, dezenas_de, fetch_concurso, fetch_range
from lib.ui import inject_css, page_header, footer


st.set_page_config(page_title="Filtrar Jogo — LC Pro", page_icon="🔍", layout="wide")
inject_css()
page_header("🔍", "Filtrar Jogo",
            "9 filtros estatísticos validados — Pares, Bordas, MODAIS, Primos, Fibonacci, Retros, Posições.")


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


# ---------- Topo ----------
with st.container(border=True):
    c1, c2 = st.columns([1, 3])
    with c1:
        try:
            ult = int(fetch_concurso(timeout=15)["numero"])
        except Exception:
            ult = 3673
        conc = st.number_input("Concurso a conferir", min_value=2,
                                value=ult + 1, step=1)
    with c2:
        arquivo = st.file_uploader("📁 Arquivo de jogos (.txt)", type=["txt"],
                                   help="Aceita formato gerado pelo Gerador ou qualquer arquivo com 15 dezenas por linha.")


jogos: list[list[int]] = []
if arquivo is not None:
    txt = arquivo.read().decode("utf-8", errors="replace")
    for ln in txt.splitlines():
        g = parse_game(ln)
        if g:
            jogos.append(g)
    if jogos:
        st.success(f"📥 **{len(jogos)} jogos carregados** de `{arquivo.name}`")


# ---------- Histórico ----------
@st.cache_data(ttl=600, show_spinner=False)
def carrega_serie(target: int) -> list[list[int]]:
    raw = fetch_range(max(1, target - 10), target - 1)
    return [dezenas_de(raw[c]) for c in sorted(raw)]


with st.spinner("📡 Buscando últimos 10 resultados..."):
    serie = carrega_serie(int(conc))


# ---------- Layout: série | filtros ----------
left, right = st.columns([1, 1], gap="medium")

with left:
    st.markdown('<div class="lc-section">Ocorridos nos últimos 10 resultados</div>',
                unsafe_allow_html=True)
    st.caption("Esquerda = mais antigo, Direita = mais recente")

    nomes_serie = ["Pares", "Bordas", "Modas", "Primos", "Fibonacci",
                    "Repetição Último", "Posição 4", "Posição 8", "Posição 12"]
    if serie:
        prev = None
        rows: dict[str, list[int]] = {n: [] for n in nomes_serie}
        for d in serie:
            retro = prev or set()
            for n in nomes_serie:
                rows[n].append(calc_var(n, d, retro))
            prev = set(d)
        # Tabela legível
        table_html = '<div style="background:white;border:1px solid #D7E8EC;border-radius:12px;padding:14px;font-family:JetBrains Mono,monospace;font-size:13px;">'
        for n in nomes_serie:
            valores = "  ".join(f"<span style='display:inline-block;width:22px;text-align:center;color:#0095B6;font-weight:600'>{v}</span>" for v in rows[n])
            table_html += f'<div style="display:flex;align-items:center;padding:4px 0;border-bottom:1px solid #F5FBFC;"><span style="width:140px;font-weight:600;color:#1A2A3A">{n}</span>{valores}</div>'
        table_html += "</div>"
        st.markdown(table_html, unsafe_allow_html=True)
    else:
        st.info("Sem histórico disponível.")


with right:
    st.markdown('<div class="lc-section">Filtros</div>', unsafe_allow_html=True)
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
    with st.container(border=True):
        # cabeçalho
        h1, h2, h3 = st.columns([3, 1, 1])
        h1.caption("**Filtro**")
        h2.caption("**Mín**")
        h3.caption("**Máx**")
        for nome, mn_def, mx_def in filtros_def:
            x1, x2, x3 = st.columns([3, 1, 1])
            on = x1.checkbox(nome, key=f"on_{nome}")
            mn = x2.number_input("min", key=f"mn_{nome}", value=mn_def,
                                  label_visibility="collapsed",
                                  min_value=0, max_value=999)
            mx = x3.number_input("max", key=f"mx_{nome}", value=mx_def,
                                  label_visibility="collapsed",
                                  min_value=0, max_value=999)
            cfg[nome] = {"on": on, "min": int(mn), "max": int(mx)}


st.divider()


# ---------- Aplicar ----------
b1, b2 = st.columns([1, 4])
with b1:
    aplicar = st.button("🎯 Filtrar jogos", type="primary",
                        use_container_width=True,
                        disabled=not jogos)

if aplicar:
    retro = set(serie[-1]) if serie else set()
    aprovados: list[list[int]] = []
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


# ---------- Resultado ----------
if "aprovados" in st.session_state:
    aceitos = st.session_state.aprovados
    elim = st.session_state.elim_counts
    lidas = st.session_state.lidas

    r1, r2 = st.columns([1, 2])
    with r1:
        st.metric("Lidas", lidas)
        st.metric("Aceitas", len(aceitos))
    with r2:
        with st.expander(f"Eliminadas por filtro"):
            for n, _, _ in filtros_def:
                if cfg[n]["on"]:
                    st.write(f"• **{n}** — eliminou {elim[n]} jogo(s)")

    if aceitos:
        buf = io.StringIO()
        for j in aceitos:
            buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
        nome_out = (arquivo.name.rsplit(".", 1)[0] + "F.txt") if arquivo else "filtrado.txt"
        st.download_button(
            "⬇️ Baixar jogos filtrados",
            data=buf.getvalue().encode("ascii"),
            file_name=nome_out, mime="text/plain", type="primary",
        )
        with st.expander(f"Ver {len(aceitos)} aprovados"):
            for i, j in enumerate(aceitos[:500], 1):
                st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
            if len(aceitos) > 500:
                st.caption(f"Mostrando 500 de {len(aceitos)}.")


footer()
