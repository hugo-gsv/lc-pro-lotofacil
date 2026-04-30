"""LC Pro Lotofácil — versão online (Streamlit).

Ponto de entrada do app multi-página. As páginas vivem em pages/.
Para rodar local:
    pip install -r requirements.txt
    streamlit run streamlit_app.py
"""

from __future__ import annotations

import streamlit as st

from lib.lottery import fetch_concurso, dezenas_de, formato_linha, formato_coluna, spq, csn

# ---------- Page config ----------
st.set_page_config(
    page_title="LC Pro Lotofácil",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        "About": "**LC Pro Lotofácil** — Sistema de análise e geração de jogos.",
    },
)


# ---------- Cabeçalho ----------
col_logo, col_title = st.columns([1, 6])
with col_logo:
    st.markdown("# 🎯")
with col_title:
    st.markdown("# Mais Chances Loterias — LC Pro")
    st.caption("Sistema online de análise e geração de jogos para Lotofácil")

st.divider()


# ---------- Painel: último resultado (auto-update via API) ----------
@st.cache_data(ttl=300)
def carrega_ultimo() -> dict:
    """Busca último concurso da Caixa (cache de 5 min)."""
    return fetch_concurso()


with st.spinner("Buscando último resultado da Caixa..."):
    try:
        latest = carrega_ultimo()
    except Exception as e:  # noqa: BLE001
        st.error(f"Não foi possível conectar à Caixa: {e}")
        st.stop()

dez = dezenas_de(latest)
fl = formato_linha(dez)
fc = formato_coluna(dez)

st.subheader("Último concurso da Lotofácil")
m1, m2, m3, m4 = st.columns(4)
m1.metric("Concurso", latest["numero"])
m2.metric("Data", latest["dataApuracao"])
m3.metric("SPQ (linha / coluna)", f"{spq(fl)} / {spq(fc)}")
m4.metric("CSN (linha / coluna)", f"{csn(fl)} / {csn(fc)}")

st.markdown("**Dezenas sorteadas:**")
cols = st.columns(15)
for col, d in zip(cols, dez):
    col.markdown(
        f"<div style='background:#14C6E4;border-radius:50%;width:48px;height:48px;"
        f"display:flex;align-items:center;justify-content:center;"
        f"font-size:18px;font-weight:bold;color:black;margin:auto;'>{d:02d}</div>",
        unsafe_allow_html=True,
    )

st.divider()


# ---------- Navegação ----------
st.markdown("### Ferramentas disponíveis")
c1, c2, c3 = st.columns(3)
with c1:
    st.markdown("#### 📊 Gerador")
    st.caption("Linha × Coluna, SPQ, CSN, formatos aceitos, soma das dezenas.")
    st.page_link("pages/1_Gerador.py", label="Abrir Gerador", icon="📊")
with c2:
    st.markdown("#### 🔍 Filtrar Jogo")
    st.caption("Pares, Bordas, Modas (Modais), Primos, Fibo, Repetições, Posições.")
    st.page_link("pages/2_Filtrar_Jogo.py", label="Abrir Filtros", icon="🔍")
with c3:
    st.markdown("#### ✅ Conferidor")
    st.caption("Confere seus jogos contra qualquer concurso e mostra acertos.")
    st.page_link("pages/3_Conferidor.py", label="Abrir Conferidor", icon="✅")

st.divider()
st.caption(
    "Fórmulas SPQ e CSN validadas 9/9 contra a tabela do screenshot do autor. "
    "Conjunto MODAIS validado 100% contra arquivos do app Liberty BASIC original."
)
