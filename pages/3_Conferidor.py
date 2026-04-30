"""Conferidor — confere jogos contra um concurso, mostra acertos coloridos."""

from __future__ import annotations

import io
from collections import Counter

import streamlit as st

from lib.lottery import dezenas_de, fetch_concurso_retry
from lib.ui import inject_css, page_header, dezenas_balls, footer


st.set_page_config(page_title="Conferidor — LC Pro", page_icon="✅", layout="wide")
inject_css()
page_header("✅", "Conferidor",
            "Confere uma lista de jogos contra qualquer concurso e gera o relatório de acertos.")


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


@st.cache_data(ttl=600, show_spinner=False)
def busca_concurso(n: int):
    d = fetch_concurso_retry(n)
    return dezenas_de(d) if d else None


with st.container(border=True):
    c1, c2 = st.columns([1, 3])
    with c1:
        conc = st.number_input("Concurso a conferir", min_value=1, value=3673, step=1)
    with c2:
        arq = st.file_uploader("📁 Arquivo de jogos (.txt)", type=["txt"])


if st.button("🎯 Conferir", type="primary"):
    with st.spinner("Buscando concurso..."):
        dez_res = busca_concurso(int(conc))
    if not dez_res:
        st.error(f"Concurso {conc} não encontrado.")
    elif arq is None:
        st.error("Carregue um arquivo de jogos.")
    else:
        st.markdown(f'<div class="lc-section">Resultado do concurso #{conc}</div>',
                    unsafe_allow_html=True)
        dezenas_balls(dez_res)

        sresult = set(dez_res)
        txt = arq.read().decode("utf-8", errors="replace")
        jogos = [g for g in (parse_game(ln) for ln in txt.splitlines()) if g]

        hits_cnt: Counter[int] = Counter()
        rows = []
        for i, j in enumerate(jogos, 1):
            h = len(set(j) & sresult)
            hits_cnt[h] += 1
            rows.append({
                "N°": i,
                "Dezenas": " ".join(f"{d:02d}" for d in j),
                "Acertos": h,
            })

        st.markdown('<div class="lc-section">Distribuição dos acertos</div>',
                    unsafe_allow_html=True)
        m = st.columns(5, gap="medium")
        cores = {15: "#000000", 14: "#C8102E", 13: "#1F4E96",
                 12: "#5C7080", 11: "#90A4AE"}
        for i, pts in enumerate([15, 14, 13, 12, 11]):
            with m[i]:
                qtd = hits_cnt.get(pts, 0)
                st.markdown(
                    f'<div class="lc-metric" style="border-top:4px solid {cores[pts]};">'
                    f'<div class="lc-metric-label">{pts} pontos</div>'
                    f'<div class="lc-metric-value">{qtd}</div>'
                    f'<div class="lc-metric-sub">de {len(jogos)} jogos</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

        st.markdown('<div class="lc-section">Detalhe dos jogos</div>',
                    unsafe_allow_html=True)
        st.dataframe(rows, use_container_width=True, hide_index=True, height=440)

        # Download premio.txt
        buf = io.StringIO()
        for i, j in enumerate(jogos, 1):
            h = len(set(j) & sresult)
            buf.write(f"{i:05d} > " + " ".join(f"{d:02d}" for d in j) + f" = {h:02d}\r\n")
        st.download_button("⬇️ Baixar premio.txt",
                           data=buf.getvalue().encode("ascii"),
                           file_name="premio.txt", mime="text/plain",
                           type="primary")


footer()
