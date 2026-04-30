"""Página Conferidor — confere uma lista de jogos contra um concurso."""

from __future__ import annotations

import io
import streamlit as st

from lib.lottery import dezenas_de, fetch_concurso_retry


st.set_page_config(page_title="Conferidor — LC Pro", page_icon="✅", layout="wide")
st.title("✅ Conferidor de Jogos")


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


COLOR_BY_HITS = {15: "#000000", 14: "#C8102E", 13: "#1F4E96",
                 12: "#555555", 11: "#777777"}


@st.cache_data(ttl=600)
def busca_concurso(n: int):
    d = fetch_concurso_retry(n)
    return dezenas_de(d) if d else None


col1, col2 = st.columns([1, 3])
with col1:
    conc = st.number_input("Concurso a conferir", min_value=1, value=3673, step=1)
with col2:
    arq = st.file_uploader("Arquivo de jogos (.txt)", type=["txt"])


if st.button("Conferir", type="primary"):
    dez = busca_concurso(int(conc))
    if not dez:
        st.error(f"Concurso {conc} não encontrado.")
    elif arq is None:
        st.error("Carregue um arquivo de jogos.")
    else:
        st.markdown(f"**Resultado do concurso {conc}:** "
                    + " ".join(f"`{d:02d}`" for d in dez))
        sresult = set(dez)
        txt = arq.read().decode("utf-8", errors="replace")
        jogos = [g for g in (parse_game(ln) for ln in txt.splitlines()) if g]
        from collections import Counter
        hits_cnt: Counter[int] = Counter()
        rows = []
        for i, j in enumerate(jogos, 1):
            h = len(set(j) & sresult)
            hits_cnt[h] += 1
            cor = COLOR_BY_HITS.get(h, "#AAAAAA")
            rows.append({
                "N°": i,
                "Dezenas": " ".join(f"{d:02d}" for d in j),
                "Acertos": h,
            })
        m = st.columns(5)
        for k, (pts, col) in enumerate([(15, m[0]), (14, m[1]), (13, m[2]),
                                          (12, m[3]), (11, m[4])]):
            col.metric(f"{pts} pts", hits_cnt.get(pts, 0))
        st.dataframe(rows, use_container_width=True, hide_index=True, height=480)
        # Download premio.txt
        buf = io.StringIO()
        for i, j in enumerate(jogos, 1):
            h = len(set(j) & sresult)
            buf.write(f"{i:05d} > " + " ".join(f"{d:02d}" for d in j) + f" = {h:02d}\r\n")
        st.download_button("⬇️ Baixar premio.txt",
                           data=buf.getvalue().encode("ascii"),
                           file_name="premio.txt", mime="text/plain")
