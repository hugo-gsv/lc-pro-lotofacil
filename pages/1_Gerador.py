"""Gerador — clone web do LC Pro com layout profissional."""

from __future__ import annotations

import io
import itertools

import streamlit as st

from lib.lottery import (
    coluna_de, csn, dezenas_de, fetch_concurso, fetch_concurso_retry,
    fetch_range, formato_coluna, formato_linha, spq, todos_formatos,
)
from lib.storage import salvar_jogos
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
        retros = st.number_input("Retros", min_value=5, max_value=200, value=10, step=5)
    with cc3:
        tipo = st.radio("Dados de", ["Linhas", "Colunas", "Linha x Coluna"],
                        horizontal=True, index=0)
    with cc4:
        graf = st.radio("Gráfico",
                         ["SPQ (30 a 60)", "CSN (10 a 629)"],
                         horizontal=True)
        graf = "SPQ" if graf.startswith("SPQ") else "CSN"

st.write("")


# ---------- Histórico ----------
with st.spinner("📡 Buscando histórico da Caixa..."):
    hist = carrega_historico(int(target), int(retros))

if not hist:
    st.error("⚠️ Não foi possível carregar histórico. Tente reduzir Retros.")
    st.stop()


# ---------- Constrói tabela ----------
# Sempre 5 colunas: Conc | Linha | Coluna | CSN | SPQ
# CSN/SPQ refletem o tipo selecionado:
#   - Linhas        → CSN/SPQ do formato linha
#   - Colunas       → CSN/SPQ do formato coluna
#   - Linha x Coluna → CSN/SPQ do formato linha (gráfico mostra Soma)
linhas_data = []
somas: dict[str, int] = {}
for c, dez in hist:
    fl = formato_linha(dez); fc = formato_coluna(dez)
    soma = sum(dez)
    cstr = f"{c:04d}"
    if tipo == "Colunas":
        cn, sp = csn(fc), spq(fc)
    else:  # Linhas ou Linha x Coluna
        cn, sp = csn(fl), spq(fl)
    linhas_data.append({
        "Conc": cstr,
        "Linha": fl,
        "Coluna": fc,
        "CSN": cn,
        "SPQ": sp,
    })
    somas[cstr] = soma


# ---------- Histórico unificado (tabela + sparkline SVG numa mesma tabela) ----------
if tipo == "Linha x Coluna":
    GRAF_NAME = "Soma"
    GRAF_MIN, GRAF_MAX = 120, 270
    var_caption = f"Soma das Dezenas — range {GRAF_MIN} a {GRAF_MAX}"
elif graf == "SPQ":
    GRAF_NAME = "SPQ"
    GRAF_MIN, GRAF_MAX = 30, 60
    var_caption = f"SPQ — range {GRAF_MIN} a {GRAF_MAX}"
else:
    GRAF_NAME = "CSN"
    GRAF_MIN, GRAF_MAX = 10, 629
    var_caption = f"CSN — range {GRAF_MIN} a {GRAF_MAX}"

st.markdown(f'<div class="lc-section">Histórico — Gráfico {GRAF_NAME}</div>',
            unsafe_allow_html=True)


def make_bar(v: int, vmin: int, vmax: int) -> str:
    """Sparkline em HTML/CSS puro: trilho + 5 ticks + linha do centro + marcador.
    Vantagem sobre SVG: círculos sempre redondos, responsivo sem distorção."""
    frac = (v - vmin) / max(vmax - vmin, 1)
    frac = max(0.0, min(1.0, frac))
    pct = frac * 100
    dist_to_center = abs(frac - 0.5) * 2
    color_class = "lc-mk-or" if dist_to_center > 0.15 else "lc-mk-cy"
    ticks = "".join(
        f'<span class="lc-tick" style="left:{i*25}%"></span>' for i in range(5)
    )
    return (
        f'<div class="lc-spark">'
        f'<div class="lc-track"></div>'
        f'{ticks}'
        f'<span class="lc-center"></span>'
        f'<span class="lc-marker {color_class}" style="left:{pct:.2f}%"></span>'
        f'</div>'
    )


html = ['<div class="lc-history-wrap"><table class="lc-history">']
# Larguras padronizadas (fixed table-layout no CSS)
html.append(
    '<colgroup>'
    '<col style="width:11%">'    # Concurso
    '<col style="width:10%">'    # Linha
    '<col style="width:10%">'    # Coluna
    '<col style="width:8%">'     # CSN
    '<col style="width:8%">'     # SPQ
    '<col style="width:8%">'     # Soma
    '<col style="width:45%">'    # Gráfico
    '</colgroup>'
    '<thead><tr>'
    '<th>Concurso</th>'
    '<th>Linha</th>'
    '<th>Coluna</th>'
    '<th>CSN</th>'
    '<th>SPQ</th>'
    '<th>Soma</th>'
    '<th>Gráfico</th>'
    '</tr></thead><tbody>'
)

for row in linhas_data:
    soma_v = somas[row["Conc"]]
    if tipo == "Linha x Coluna":
        v = soma_v
    else:
        v = row["SPQ"] if GRAF_NAME == "SPQ" else row["CSN"]
    html.append(
        f'<tr>'
        f'<td class="lc-num">{row["Conc"]}</td>'
        f'<td class="lc-fmt">{row["Linha"]}</td>'
        f'<td class="lc-fmt">{row["Coluna"]}</td>'
        f'<td class="lc-num">{row["CSN"]}</td>'
        f'<td class="lc-num">{row["SPQ"]}</td>'
        f'<td class="lc-num">{soma_v}</td>'
        f'<td class="lc-bar">{make_bar(v, GRAF_MIN, GRAF_MAX)}</td>'
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


if "formato_selecionado" not in st.session_state:
    st.session_state.formato_selecionado = None

fa1, fa2 = st.columns([3, 2], gap="medium")

with fa1:
    st.markdown('<div class="lc-section">Formatos Aceitos</div>',
                unsafe_allow_html=True)
    formatos = st.session_state.formatos_aceitos
    # Detecta clique via query param (?fmt=24333)
    qp = st.query_params
    if "fmt" in qp:
        clicked = qp["fmt"]
        if clicked == st.session_state.formato_selecionado:
            st.session_state.formato_selecionado = None
        else:
            st.session_state.formato_selecionado = clicked
        del st.query_params["fmt"]
        st.rerun()

    if not formatos:
        st.info("Defina SPQ/CSN e clique em **Mostrar formatos** acima.")
    else:
        st.caption(
            f"{len(formatos)} formato(s) no intervalo — clique no número para selecionar"
        )
        rows_html = []
        sel_atual = st.session_state.formato_selecionado
        for fmt in formatos:
            cls = "fmt-row" + (" fmt-row-sel" if fmt == sel_atual else "")
            rows_html.append(
                f'<a class="{cls}" href="?fmt={fmt}" target="_self">{fmt}</a>'
            )
        st.markdown(
            f'<div class="lc-fmt-list">{"".join(rows_html)}</div>',
            unsafe_allow_html=True,
        )

sel = st.session_state.formato_selecionado


# --- Direita: Inclusas (tabela única + dois botões de adicionar) ---
with fa2:
    st.markdown('<div class="lc-section">Inclusos</div>', unsafe_allow_html=True)

    linhas = st.session_state.linhas_inclusas
    colunas = st.session_state.colunas_inclusas
    max_rows = max(len(linhas), len(colunas), 1)

    # Cabeçalho
    h1, h2 = st.columns(2, gap="small")
    h1.markdown(
        '<div style="text-align:center;font-weight:700;text-transform:uppercase;'
        'font-size:11px;letter-spacing:1.2px;color:#0095B6;'
        'padding:10px 0;border-bottom:1px solid #DDE8EC;'
        'background:linear-gradient(180deg,#FBFDFE,#F4F8FA);'
        'border-radius:14px 0 0 0;">Linhas</div>',
        unsafe_allow_html=True,
    )
    h2.markdown(
        '<div style="text-align:center;font-weight:700;text-transform:uppercase;'
        'font-size:11px;letter-spacing:1.2px;color:#0095B6;'
        'padding:10px 0;border-bottom:1px solid #DDE8EC;'
        'background:linear-gradient(180deg,#FBFDFE,#F4F8FA);'
        'border-radius:0 14px 0 0;">Colunas</div>',
        unsafe_allow_html=True,
    )

    # Linhas da tabela com botão ✕ inline
    for i in range(max_rows):
        l = linhas[i] if i < len(linhas) else None
        c = colunas[i] if i < len(colunas) else None
        cl, cc = st.columns(2, gap="small")

        with cl:
            if l is not None:
                a, b = st.columns([4, 1], gap="small")
                a.markdown(
                    f'<div class="lc-incluso-cell">{l}</div>',
                    unsafe_allow_html=True,
                )
                if b.button("✕", key=f"rm_lin_{i}_{l}",
                             help=f"Remover {l}",
                             use_container_width=True):
                    st.session_state.linhas_inclusas.remove(l)
                    st.rerun()
            else:
                st.markdown(
                    '<div class="lc-incluso-cell lc-incluso-empty">—</div>',
                    unsafe_allow_html=True,
                )

        with cc:
            if c is not None:
                a, b = st.columns([4, 1], gap="small")
                a.markdown(
                    f'<div class="lc-incluso-cell">{c}</div>',
                    unsafe_allow_html=True,
                )
                if b.button("✕", key=f"rm_col_{i}_{c}",
                             help=f"Remover {c}",
                             use_container_width=True):
                    st.session_state.colunas_inclusas.remove(c)
                    st.rerun()
            else:
                st.markdown(
                    '<div class="lc-incluso-cell lc-incluso-empty">—</div>',
                    unsafe_allow_html=True,
                )

    # Botões de adicionar
    st.write("")
    bcols = st.columns(2, gap="small")
    with bcols[0]:
        disabled = sel is None
        label = "⬅︎ Adicionar a Linhas" if not sel else f"⬅︎ {sel} → Linhas"
        if st.button(label, use_container_width=True, type="primary",
                     disabled=disabled, key="add_linha_btn"):
            if sel and sel not in st.session_state.linhas_inclusas:
                st.session_state.linhas_inclusas.append(sel)
            st.session_state.formato_selecionado = None
            st.rerun()
    with bcols[1]:
        disabled = sel is None
        label = "➡︎ Adicionar a Colunas" if not sel else f"➡︎ {sel} → Colunas"
        if st.button(label, use_container_width=True, type="primary",
                     disabled=disabled, key="add_coluna_btn"):
            if sel and sel not in st.session_state.colunas_inclusas:
                st.session_state.colunas_inclusas.append(sel)
            st.session_state.formato_selecionado = None
            st.rerun()


st.divider()


# ---------- Geração ----------
st.markdown('<div class="lc-section">Geração das Combinações</div>',
            unsafe_allow_html=True)

with st.container(border=True):
    st.caption("Soma das dezenas — intervalo permitido: 120 a 270")
    g1, g2, g3, g4 = st.columns([1, 1, 3, 1.4],
                                  vertical_alignment="bottom")
    soma_min = g1.number_input("Soma mín", value=120,
                                min_value=120, max_value=270)
    soma_max = g2.number_input("Soma máx", value=270,
                                min_value=120, max_value=270)
    nome_arq = g3.text_input("Nome do arquivo", value=f"{int(target)}A.txt")
    gerar = g4.button("🎯 Gerar", type="primary",
                       use_container_width=True)


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
            # Persiste no histórico (SQLite no servidor)
            params = {
                "concurso_alvo": int(target),
                "retros": int(retros),
                "tipo_dados": tipo,
                "linhas": list(st.session_state.linhas_inclusas),
                "colunas": list(st.session_state.colunas_inclusas),
                "soma_min": int(soma_min),
                "soma_max": int(soma_max),
            }
            saved_id = salvar_jogos(nome_arq, "gerador", params, jogos)
            st.success(
                f"✅ **{len(jogos)} combinações geradas e salvas no histórico** "
                f"(ID #{saved_id} — `{nome_arq}`)"
            )

            r1, r2, r3 = st.columns([1.2, 1.2, 2.6])
            with r1:
                buf = io.StringIO()
                for j in jogos:
                    buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
                st.download_button(
                    "⬇️ Baixar .txt",
                    data=buf.getvalue().encode("ascii"),
                    file_name=nome_arq, mime="text/plain",
                    use_container_width=True,
                )
            with r2:
                st.page_link("pages/4_Historico.py",
                             label="📂 Ver histórico",
                             use_container_width=True)
            with r3:
                st.page_link("pages/2_Filtrar_Jogo.py",
                             label="🔍 Ir para Filtrar Jogo",
                             use_container_width=True)

            with st.expander(f"Ver as {len(jogos)} combinações"):
                preview = jogos[:500]
                for i, j in enumerate(preview, 1):
                    st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
                if len(jogos) > 500:
                    st.caption(f"Mostrando 500 de {len(jogos)}.")


footer()
