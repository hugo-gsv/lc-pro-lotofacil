"""Histórico de jogos gerados — visualizar, baixar, excluir, carregar para filtrar."""

from __future__ import annotations

import io
import streamlit as st

from lib.storage import carregar, excluir, listar, renomear
from lib.ui import inject_css, page_header, footer


st.set_page_config(page_title="Histórico — LC Pro", page_icon="📂", layout="wide")
inject_css()
page_header("📂", "Histórico de Jogos Gerados",
            "Todos os jogos ficam salvos no servidor — acesse de qualquer dispositivo.")


# ---------- Lista ----------
items = listar(limit=200)

if not items:
    st.info(
        "Nenhum jogo gerado ainda. Vá ao **Gerador** e clique em 'Gerar' para "
        "criar seu primeiro lote — ele aparecerá aqui automaticamente."
    )
    st.page_link("pages/1_Gerador.py", label="Abrir Gerador →")
    footer()
    st.stop()


st.markdown(f'<div class="lc-section">{len(items)} jogo(s) no histórico</div>',
            unsafe_allow_html=True)

# Cabeçalho
hdr = st.columns([1, 3, 2, 1.2, 1.5, 1.5, 1.5])
hdr[0].markdown("**ID**")
hdr[1].markdown("**Nome**")
hdr[2].markdown("**Quando**")
hdr[3].markdown("**Jogos**")
hdr[4].markdown("**Tipo**")
hdr[5].markdown("**Ações**")
hdr[6].markdown("**ㅤ**")

st.divider()

for it in items:
    cols = st.columns([1, 3, 2, 1.2, 1.5, 1.5, 1.5])
    cols[0].markdown(f"`#{it['id']}`")
    cols[1].markdown(f"**{it['nome']}**")
    cols[2].caption(it["dt"].replace("T", " "))
    cols[3].markdown(f"**{it['n_jogos']}**")
    cols[4].caption(it["tipo"] or "-")

    # Ações
    with cols[5]:
        if st.button("👁️ Ver", key=f"ver_{it['id']}", use_container_width=True):
            st.session_state["hist_view"] = it["id"]
    with cols[6]:
        c1, c2 = st.columns(2)
        with c1:
            full = carregar(it["id"])
            if full:
                buf = io.StringIO()
                for j in full["jogos"]:
                    buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
                st.download_button(
                    "⬇️", data=buf.getvalue().encode("ascii"),
                    file_name=it["nome"], mime="text/plain",
                    key=f"dl_{it['id']}", help="Baixar .txt",
                    use_container_width=True,
                )
        with c2:
            if st.button("🗑️", key=f"del_{it['id']}",
                         help="Excluir do histórico",
                         use_container_width=True):
                excluir(it["id"])
                st.rerun()


# ---------- Visualização do jogo selecionado ----------
if "hist_view" in st.session_state:
    full = carregar(st.session_state["hist_view"])
    if full:
        st.divider()
        st.markdown(f'<div class="lc-section">Detalhes — #{full["id"]} · {full["nome"]}</div>',
                    unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**Parâmetros usados:**")
            st.json(full["params"])
        with c2:
            buf = io.StringIO()
            for j in full["jogos"]:
                buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
            st.download_button(
                "⬇️ Baixar este lote",
                data=buf.getvalue().encode("ascii"),
                file_name=full["nome"], mime="text/plain", type="primary",
            )
            st.page_link("pages/2_Filtrar_Jogo.py",
                         label="🔍 Filtrar este lote")
            st.session_state["filtrar_carregar_id"] = full["id"]

        with st.expander(f"Ver as {full['n_jogos']} combinações"):
            for i, j in enumerate(full["jogos"][:1000], 1):
                st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
            if full["n_jogos"] > 1000:
                st.caption(f"Mostrando 1000 de {full['n_jogos']}.")


footer()
