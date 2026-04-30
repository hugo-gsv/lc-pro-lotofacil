"""Gerador — clone web do LC Pro com layout profissional."""

from __future__ import annotations

import io
import itertools

import streamlit as st

from lib.lottery import (
    coluna_de, csn, dezenas_de, fetch_concurso, fetch_concurso_retry,
    fetch_range, formato_coluna, formato_linha, spq, todos_formatos,
)
from lib.ui import inject_css, page_header, footer


st.set_page_config(page_title="Gerador — LC Pro", page_icon="📊", layout="wide")
inject_css()
page_header("📊", "Gerador",
            "Cruzamento matricial Linha × Coluna com filtros SPQ, CSN e Soma.")


# ---------- Estado ----------
if "linhas_inclusas" not in st.session_state:
    st.session_state.linhas_inclusas = []
if "colunas_inclusas" not in st.session_state:
    st.session_state.colunas_inclusas = []
if "formatos_aceitos" not in st.session_state:
    st.session_state.formatos_aceitos = []


# ---------- Utilitários cacheados ----------
@st.cache_data(ttl=300, show_spinner=False)
def latest_concurso_n() -> int:
    return int(fetch_concurso(timeout=15)["numero"])


@st.cache_data(ttl=600, show_spinner=False)
def carrega_historico(target: int, retros: int) -> list[tuple[int, list[int]]]:
    if retros <= 0 or target <= 1:
        return []
    inicio = max(1, target - retros)
    fim = target - 1
    raw = fetch_range(inicio, fim, max_workers=10)
    return [(c, dezenas_de(raw[c])) for c in sorted(raw)]


# ---------- Topo: parâmetros ----------
with st.container(border=True):
    cc1, cc2, cc3, cc4 = st.columns([1.5, 1, 3, 2])
    with cc1:
        try:
            ult = latest_concurso_n()
        except Exception:  # noqa: BLE001
            ult = 3673
        target = st.number_input("Para Concurso", min_value=2, max_value=ult + 1,
                                  value=ult + 1, step=1)
    with cc2:
        retros = st.number_input("Retros", min_value=5, max_value=200, value=30, step=5)
    with cc3:
        tipo = st.radio("Dados de", ["Linhas", "Colunas", "Linha x Coluna"],
                        horizontal=True, index=1)
    with cc4:
        graf = st.radio("Gráfico", ["SPQ", "CSN"], horizontal=True)

st.write("")


# ---------- Histórico ----------
with st.spinner("📡 Buscando histórico da Caixa..."):
    hist = carrega_historico(int(target), int(retros))

if not hist:
    st.error("⚠️ Não foi possível carregar histórico. Tente reduzir Retros.")
    st.stop()


# ---------- Constrói tabela ----------
linhas_data = []
somas: dict[str, int] = {}
for c, dez in hist:
    fl = formato_linha(dez); fc = formato_coluna(dez)
    soma = sum(dez)
    cstr = f"{c:04d}"
    if tipo == "Linhas":
        linhas_data.append({"Conc": cstr, "Formato": fl,
                            "CSN": csn(fl), "SPQ": spq(fl)})
    elif tipo == "Colunas":
        linhas_data.append({"Conc": cstr, "Formato": fc,
                            "CSN": csn(fc), "SPQ": spq(fc)})
    else:  # Linha x Coluna — formato linha + formato coluna SEPARADOS
        linhas_data.append({
            "Conc": cstr,
            "Formato": fl,             # formato da linha
            "Coluna": fc,              # formato da coluna (nova)
            "CSN": csn(fl),            # numérico (do formato linha)
            "SPQ": spq(fl),
            "Soma": soma,
        })
    somas[cstr] = soma


# ---------- Histórico unificado (tabela + gráfico ASCII numa mesma tabela) ----------
st.markdown(f'<div class="lc-section">Histórico — Gráfico {graf}</div>',
            unsafe_allow_html=True)

CHART_W = 31; CHART_CENTER = CHART_W // 2
if tipo == "Linha x Coluna":
    vmin, vmax = 120, 270
    var_caption = "Soma das Dezenas — cada tracinho = 5 unidades (range 120..270)"
elif graf == "SPQ":
    vmin, vmax = 30, 60
    var_caption = "SPQ — cada tracinho = 1 unidade (range 30..60)"
else:
    vmin, vmax = 10, 629
    var_caption = "CSN — cada tracinho = 20 unidades (range 10..629)"


def make_bar(v: int) -> str:
    pos = max(0, min(CHART_W - 1,
                      int(round((v - vmin) / max(vmax - vmin, 1) * (CHART_W - 1)))))
    out = ""
    for i in range(CHART_W):
        if i == pos:
            out += '<span class="x">x</span>'
        elif i == CHART_CENTER:
            out += '<span class="center">!</span>'
        else:
            out += "_"
    return out


html = ['<div class="lc-history-wrap"><table class="lc-history">']
if tipo == "Linha x Coluna":
    html.append(
        '<thead><tr>'
        '<th>Conc</th><th>Formato</th><th>Coluna</th>'
        '<th style="text-align:right">CSN</th>'
        '<th style="text-align:right">SPQ</th>'
        '<th style="text-align:right">Soma</th>'
        '<th>Gráfico</th>'
        '</tr></thead><tbody>'
    )
else:
    html.append(
        '<thead><tr>'
        '<th>Conc</th><th>Formato</th>'
        '<th style="text-align:right">CSN</th>'
        '<th style="text-align:right">SPQ</th>'
        '<th>Gráfico</th>'
        '</tr></thead><tbody>'
    )

for row in linhas_data:
    if tipo == "Linha x Coluna":
        v = row["Soma"]
        html.append(
            f'<tr>'
            f'<td class="lc-num">{row["Conc"]}</td>'
            f'<td class="lc-fmt">{row["Formato"]}</td>'
            f'<td class="lc-fmt">{row["Coluna"]}</td>'
            f'<td class="lc-num">{row["CSN"]}</td>'
            f'<td class="lc-num">{row["SPQ"]}</td>'
            f'<td class="lc-num">{row["Soma"]}</td>'
            f'<td class="lc-bar">{make_bar(v)}</td>'
            f'</tr>'
        )
    else:
        v = row["SPQ"] if graf == "SPQ" else row["CSN"]
        html.append(
            f'<tr>'
            f'<td class="lc-num">{row["Conc"]}</td>'
            f'<td class="lc-fmt">{row["Formato"]}</td>'
            f'<td class="lc-num">{row["CSN"]}</td>'
            f'<td class="lc-num">{row["SPQ"]}</td>'
            f'<td class="lc-bar">{make_bar(v)}</td>'
            f'</tr>'
        )
html.append("</tbody></table></div>")
st.markdown("".join(html), unsafe_allow_html=True)
st.caption(var_caption)


st.divider()


# ---------- Estimativas ----------
st.markdown('<div class="lc-section">Estimativas para escolher Formatos</div>',
            unsafe_allow_html=True)

with st.container(border=True):
    e1, e2, e3, e4, e5 = st.columns([1, 1, 1, 1, 1.5])
    spq_min = e1.number_input("SPQ mín", value=44, min_value=30, max_value=60)
    spq_max = e2.number_input("SPQ máx", value=47, min_value=30, max_value=60)
    csn_min = e3.number_input("CSN mín", value=200, min_value=1, max_value=651)
    csn_max = e4.number_input("CSN máx", value=500, min_value=1, max_value=651)
    with e5:
        st.write(""); st.write("")
        if st.button("🔍 Mostrar formatos", type="primary", use_container_width=True):
            st.session_state.formatos_aceitos = [
                "".join(map(str, t)) for t in todos_formatos()
                if spq_min <= spq("".join(map(str, t))) <= spq_max
                and csn_min <= csn("".join(map(str, t))) <= csn_max
            ]


fa1, fa2, fa3 = st.columns(3, gap="medium")

with fa1:
    st.markdown('<div class="lc-section">Formatos Aceitos</div>',
                unsafe_allow_html=True)
    formatos = st.session_state.formatos_aceitos
    if formatos:
        sel = st.selectbox(f"{len(formatos)} dentro do range", formatos,
                           label_visibility="collapsed")
    else:
        sel = None
        st.info("Defina SPQ/CSN e clique em **Mostrar formatos** acima.")

with fa2:
    st.markdown('<div class="lc-section">Linhas Inclusas</div>',
                unsafe_allow_html=True)
    if sel and st.button("⬅︎ Adicionar a Linhas", use_container_width=True):
        if sel not in st.session_state.linhas_inclusas:
            st.session_state.linhas_inclusas.append(sel)
            st.rerun()
    if st.session_state.linhas_inclusas:
        for i, f in enumerate(st.session_state.linhas_inclusas):
            r1, r2 = st.columns([4, 1])
            r1.code(f, language=None)
            if r2.button("✕", key=f"rm_lin_{i}"):
                st.session_state.linhas_inclusas.pop(i); st.rerun()
    else:
        st.caption("Vazio. Adicione formatos com 'Linhas' marcado.")

with fa3:
    st.markdown('<div class="lc-section">Colunas Inclusas</div>',
                unsafe_allow_html=True)
    if sel and st.button("➡︎ Adicionar a Colunas", use_container_width=True):
        if sel not in st.session_state.colunas_inclusas:
            st.session_state.colunas_inclusas.append(sel)
            st.rerun()
    if st.session_state.colunas_inclusas:
        for i, f in enumerate(st.session_state.colunas_inclusas):
            r1, r2 = st.columns([4, 1])
            r1.code(f, language=None)
            if r2.button("✕", key=f"rm_col_{i}"):
                st.session_state.colunas_inclusas.pop(i); st.rerun()
    else:
        st.caption("Vazio.")


st.divider()


# ---------- Geração ----------
st.markdown('<div class="lc-section">Geração das Combinações</div>',
            unsafe_allow_html=True)

with st.container(border=True):
    st.caption("Soma das dezenas — intervalo permitido: 120 a 270")
    g1, g2, g3, g4 = st.columns([1, 1, 3, 1.3])
    soma_min = g1.number_input("Soma mín", value=120,
                                min_value=120, max_value=270,
                                label_visibility="visible")
    soma_max = g2.number_input("Soma máx", value=270,
                                min_value=120, max_value=270,
                                label_visibility="visible")
    nome_arq = g3.text_input("Nome do arquivo", value=f"{int(target)}A.txt")
    with g4:
        st.write("")
        st.write("")
        gerar = st.button("🎯 Gerar", type="primary", use_container_width=True)


def enumera(linhas: list[str], colunas: list[str],
            smin: int, smax: int) -> list[list[int]]:
    out: list[list[int]] = []
    if not linhas: linhas = ["33333"]
    if not colunas: colunas = ["33333"]
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
            if tuple(cc) in col_set:
                out.append(sorted(jogo))
    return out


if gerar:
    if not (st.session_state.linhas_inclusas or st.session_state.colunas_inclusas):
        st.error("⚠️ Inclua pelo menos um formato em Linhas Inclusas ou Colunas Inclusas.")
    else:
        with st.spinner("⚙️ Calculando combinações..."):
            jogos = enumera(
                st.session_state.linhas_inclusas,
                st.session_state.colunas_inclusas,
                int(soma_min), int(soma_max),
            )
        if not jogos:
            st.warning("Nenhuma combinação encontrada. Reduza filtros.")
        else:
            st.success(f"✅ **{len(jogos)} combinações geradas.**")
            buf = io.StringIO()
            for j in jogos:
                buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
            r1, r2 = st.columns([1, 3])
            with r1:
                st.download_button(
                    "⬇️ Baixar arquivo",
                    data=buf.getvalue().encode("ascii"),
                    file_name=nome_arq,
                    mime="text/plain",
                    type="primary",
                    use_container_width=True,
                )
            with st.expander(f"Ver as {len(jogos)} combinações"):
                preview = jogos[:500]
                for i, j in enumerate(preview, 1):
                    st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
                if len(jogos) > 500:
                    st.caption(f"Mostrando 500 de {len(jogos)}.")


footer()
