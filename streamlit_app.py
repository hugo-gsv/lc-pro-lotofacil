"""LC Pro Lotofácil — Home (último concurso + atalhos para as ferramentas)."""

from __future__ import annotations

import streamlit as st

from lib.lottery import (
    csn, dezenas_de, fetch_concurso, formato_coluna, formato_linha, spq,
)
from lib.ui import (
    dezenas_balls, footer, hero, inject_css, metric_card, tool_card,
)


# ---------- Page config ----------
st.set_page_config(
    page_title="LC Pro Lotofácil",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_css()


# ---------- Hero ----------
hero(
    "LC Pro Lotofácil",
    "Sistema profissional de análise estatística e geração de jogos.",
    brand="",
)


# ---------- Último resultado ----------
@st.cache_data(ttl=300, show_spinner=False)
def carrega_ultimo() -> dict:
    return fetch_concurso()


with st.spinner("🔄 Sincronizando com a Caixa..."):
    try:
        latest = carrega_ultimo()
    except Exception as e:  # noqa: BLE001
        st.error(f"Não foi possível conectar à Caixa: {e}")
        st.stop()

dez = dezenas_de(latest)
fl = formato_linha(dez); fc = formato_coluna(dez)

st.markdown('<div class="lc-section">Último concurso oficial</div>',
            unsafe_allow_html=True)

c1, c2, c3, c4 = st.columns(4)
with c1:
    st.markdown(metric_card("Concurso", f"#{latest['numero']}", "Oficial Caixa"),
                unsafe_allow_html=True)
with c2:
    st.markdown(metric_card("Data do sorteio", latest["dataApuracao"], ""),
                unsafe_allow_html=True)
with c3:
    st.markdown(metric_card("SPQ (linha / coluna)", f"{spq(fl)} / {spq(fc)}",
                            f"Formato {fl} / {fc}"),
                unsafe_allow_html=True)
with c4:
    st.markdown(metric_card("CSN (linha / coluna)", f"{csn(fl)} / {csn(fc)}",
                            "Rank entre 651 formatos"),
                unsafe_allow_html=True)

st.write("")
dezenas_balls(dez)


# ---------- Atalhos ----------
st.markdown('<div class="lc-section">Ferramentas</div>', unsafe_allow_html=True)
t1, t2, t3 = st.columns(3, gap="medium")
with t1:
    st.markdown(tool_card(
        "📊", "Gerador",
        "Cruzamento Linha × Coluna com SPQ, CSN e Soma. Múltiplos formatos aceitos.",
    ), unsafe_allow_html=True)
    st.page_link("pages/1_Gerador.py", label="Abrir Gerador →",
                 use_container_width=True)
with t2:
    st.markdown(tool_card(
        "🔍", "Filtrar Jogo",
        "9 filtros estatísticos validados — Pares, Bordas, MODAIS, Primos, Fibonacci, retros, posições.",
    ), unsafe_allow_html=True)
    st.page_link("pages/2_Filtrar_Jogo.py", label="Abrir Filtros →",
                 use_container_width=True)
with t3:
    st.markdown(tool_card(
        "✅", "Conferidor",
        "Confere uma lista de jogos contra qualquer concurso e gera relatório de acertos.",
    ), unsafe_allow_html=True)
    st.page_link("pages/3_Conferidor.py", label="Abrir Conferidor →",
                 use_container_width=True)

footer()
