"""Página Gerador — clone web do screenshot do app LC Pro original.

Reproduz as 3 etapas do fluxo (Vid138):
1. Define concurso-alvo + retros + tipo de dados (Linhas / Colunas / Linha×Coluna)
2. Vê tabela histórica com SPQ/CSN, ajusta limites SPQ/CSN/Soma
3. Inclui formatos aceitos em "Linhas Inclusas" e "Colunas Inclusas"
4. Gera arquivo de combinações
"""

from __future__ import annotations

import io
import itertools

import streamlit as st

from lib.lottery import (
    coluna_de, csn, dezenas_de, fetch_concurso, fetch_concurso_retry,
    fetch_range, formato_coluna, formato_linha, spq, todos_formatos,
)

st.set_page_config(page_title="Gerador — LC Pro", page_icon="📊", layout="wide")

st.title("📊 Gerador — SISTEMA LC Pro")
st.caption("Cruzamento matricial Linha × Coluna com filtros SPQ, CSN e Soma das Dezenas.")


# ---------- Estado ----------
if "dados" not in st.session_state:
    st.session_state.dados = {}      # {concurso: [dezenas]}
if "linhas_inclusas" not in st.session_state:
    st.session_state.linhas_inclusas = []
if "colunas_inclusas" not in st.session_state:
    st.session_state.colunas_inclusas = []
if "ultimo_concurso" not in st.session_state:
    st.session_state.ultimo_concurso = 0


# ---------- Carregar histórico (com cache) ----------
@st.cache_data(ttl=600, show_spinner="Buscando dados da Caixa...")
def carrega_historico(target: int, retros: int) -> dict[int, list[int]]:
    """Baixa concursos [target-retros, target-1] da Caixa em paralelo."""
    if retros <= 0 or target <= 1:
        return {}
    inicio = max(1, target - retros)
    fim = target - 1
    raw = fetch_range(inicio, fim, max_workers=10)
    return {n: dezenas_de(d) for n, d in raw.items()}


@st.cache_data(ttl=300, show_spinner="Verificando último concurso...")
def latest_concurso() -> int:
    return int(fetch_concurso()["numero"])


ult = latest_concurso()


# ---------- Topo: parâmetros ----------
top1, top2, top3 = st.columns([2, 1, 4])
with top1:
    target = st.number_input("Para Concurso", min_value=2, max_value=ult + 1,
                             value=ult + 1, step=1)
with top2:
    retros = st.number_input("Retros", min_value=5, max_value=200, value=50, step=5)
with top3:
    tipo = st.radio("Dados de", options=["Linhas", "Colunas", "Linha x Coluna"],
                    horizontal=True, index=1)

# Carrega dados
hist = carrega_historico(int(target), int(retros))
if not hist:
    st.error("Não foi possível obter histórico. Tente reduzir Retros ou conferir conexão.")
    st.stop()

# ---------- Tabela + Gráfico ASCII ----------
graf = st.radio("Gráfico", ["SPQ (30..60)", "CSN (10..629)"], horizontal=True)
modo = "spq" if graf.startswith("SPQ") else "csn"

linhas_data = []
ordenado = sorted(hist.items())
prev = None
for c, dez in ordenado:
    fl = formato_linha(dez); fc = formato_coluna(dez)
    if tipo == "Linhas":
        fmt = fl
    elif tipo == "Colunas":
        fmt = fc
    else:
        fmt = f"{fl}-{fc}"
    soma = sum(dez)
    sp = spq(fl if tipo == "Linhas" else fc)
    cn = csn(fl if tipo == "Linhas" else fc)
    linhas_data.append({
        "Conc": f"{c:04d}",
        "Formato": fmt,
        "CSN": cn,
        "SPQ": sp,
        "Soma": soma,
    })

col_tab, col_chart = st.columns([1, 2])
with col_tab:
    st.markdown("**Tabela**")
    st.dataframe(linhas_data, use_container_width=True, hide_index=True, height=480)

with col_chart:
    st.markdown(f"**{graf}**")
    CHART_W = 31
    CHART_CENTER = CHART_W // 2
    if tipo == "Linha x Coluna":
        vmin, vmax = 120, 270
        var_label = "Soma das Dezenas (120..270)"
    elif modo == "spq":
        vmin, vmax = 30, 60
        var_label = "SPQ (30..60)"
    else:
        vmin, vmax = 10, 629
        var_label = "CSN (10..629)"

    chart_lines = []
    for row in linhas_data:
        if tipo == "Linha x Coluna":
            v = row["Soma"]
        elif modo == "spq":
            v = row["SPQ"]
        else:
            v = row["CSN"]
        pos = int(round((v - vmin) / max(vmax - vmin, 1) * (CHART_W - 1)))
        pos = max(0, min(CHART_W - 1, pos))
        line = ["_"] * CHART_W
        line[CHART_CENTER] = "!"
        line[pos] = "x"
        chart_lines.append(f"`{row['Conc']}` `{''.join(line)}`  ({var_label[:3]}={v})")
    st.markdown("\n".join(chart_lines))

st.divider()


# ---------- Estimativas + Mostrar ----------
st.markdown("### Estimativas para escolher Formatos Aceitos")
e1, e2, e3, e4, e5 = st.columns([1, 1, 1, 1, 1])
spq_min = e1.number_input("SPQ min", value=44, min_value=30, max_value=60)
spq_max = e2.number_input("SPQ max", value=47, min_value=30, max_value=60)
csn_min = e3.number_input("CSN min", value=200, min_value=1, max_value=651)
csn_max = e4.number_input("CSN max", value=500, min_value=1, max_value=651)

with e5:
    st.write("")
    st.write("")
    if st.button("Mostrar formatos aceitos", use_container_width=True):
        st.session_state.formatos_aceitos = []
        for fmt_t in todos_formatos():
            f = "".join(map(str, fmt_t))
            if spq_min <= spq(f) <= spq_max and csn_min <= csn(f) <= csn_max:
                st.session_state.formatos_aceitos.append(f)


fa1, fa2, fa3 = st.columns([1, 1, 1])
with fa1:
    st.markdown("**Formatos Aceitos**")
    formatos = st.session_state.get("formatos_aceitos", [])
    if formatos:
        sel = st.selectbox(f"{len(formatos)} formato(s)", formatos,
                           key="select_formato", label_visibility="collapsed")
    else:
        sel = None
        st.info("Clique em 'Mostrar formatos aceitos' acima.")

with fa2:
    st.markdown("**Linhas Inclusas**")
    if sel and st.button("→ Adicionar a Linhas", use_container_width=True):
        if sel not in st.session_state.linhas_inclusas:
            st.session_state.linhas_inclusas.append(sel)
            st.rerun()
    if st.session_state.linhas_inclusas:
        for i, f in enumerate(st.session_state.linhas_inclusas):
            cc1, cc2 = st.columns([3, 1])
            cc1.code(f, language=None)
            if cc2.button("✕", key=f"rm_lin_{i}"):
                st.session_state.linhas_inclusas.pop(i)
                st.rerun()
    else:
        st.caption("(vazio)")

with fa3:
    st.markdown("**Colunas Inclusas**")
    if sel and st.button("→ Adicionar a Colunas", use_container_width=True):
        if sel not in st.session_state.colunas_inclusas:
            st.session_state.colunas_inclusas.append(sel)
            st.rerun()
    if st.session_state.colunas_inclusas:
        for i, f in enumerate(st.session_state.colunas_inclusas):
            cc1, cc2 = st.columns([3, 1])
            cc1.code(f, language=None)
            if cc2.button("✕", key=f"rm_col_{i}"):
                st.session_state.colunas_inclusas.pop(i)
                st.rerun()
    else:
        st.caption("(vazio)")

st.divider()


# ---------- Soma + Gerar ----------
st.markdown("### Geração")
g1, g2, g3 = st.columns([1, 1, 2])
soma_min = g1.number_input("Soma das Dezenas — mín", value=120, min_value=120, max_value=270)
soma_max = g2.number_input("Soma das Dezenas — máx", value=270, min_value=120, max_value=270)
nome_arq = g3.text_input("Nome para Arquivo das combinações",
                          value=f"{int(target)}A.txt")


def enumera(linhas: list[str], colunas: list[str],
            smin: int, smax: int) -> list[list[int]]:
    out: list[list[int]] = []
    if not linhas:
        linhas = ["33333"]
    if not colunas:
        colunas = ["33333"]
    col_set = {tuple(int(c) for c in fc) for fc in colunas}
    for fl in linhas:
        fl_t = tuple(int(c) for c in fl)
        if sum(fl_t) != 15:
            continue
        escolhas = [list(itertools.combinations(range(1 + 5*i, 6 + 5*i), fl_t[i]))
                    for i in range(5)]
        for combo in itertools.product(*escolhas):
            jogo: list[int] = []
            for c in combo:
                jogo.extend(c)
            if not (smin <= sum(jogo) <= smax):
                continue
            cc = [0] * 5
            for d in jogo:
                cc[coluna_de(d) - 1] += 1
            if tuple(cc) not in col_set:
                continue
            out.append(sorted(jogo))
    return out


if st.button("🎯 Gerar Combinações", type="primary", use_container_width=True):
    if not (st.session_state.linhas_inclusas or st.session_state.colunas_inclusas):
        st.error("Inclua pelo menos um formato em Linhas Inclusas ou Colunas Inclusas.")
    else:
        with st.spinner("Gerando..."):
            jogos = enumera(
                st.session_state.linhas_inclusas,
                st.session_state.colunas_inclusas,
                int(soma_min), int(soma_max),
            )
        if jogos:
            st.success(f"✅ {len(jogos)} combinações geradas.")
            buf = io.StringIO()
            for j in jogos:
                buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
            st.download_button(
                "⬇️ Baixar arquivo .txt",
                data=buf.getvalue().encode("ascii"),
                file_name=nome_arq,
                mime="text/plain",
            )
            with st.expander(f"Ver combinações ({len(jogos)})"):
                for i, j in enumerate(jogos[:1000], 1):
                    st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
                if len(jogos) > 1000:
                    st.caption(f"(mostrando 1000 de {len(jogos)})")
        else:
            st.warning("Nenhuma combinação encontrada com esses critérios.")
