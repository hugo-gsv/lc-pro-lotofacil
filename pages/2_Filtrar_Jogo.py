"""Filtrar Jogo — versão web com mesmo padrão visual do Gerador."""

from __future__ import annotations

import io

import streamlit as st

from lib.lottery import calc_var, dezenas_de, fetch_concurso, fetch_range
from lib.storage import carregar, listar
from lib.ui import inject_css, page_header, footer, metric_card


st.set_page_config(page_title="Filtrar Jogo — LC Pro", page_icon="🔍", layout="wide")
inject_css()
page_header("🔍", "Filtrar Jogo",
            "9 filtros estatísticos validados — Pares, Bordas, MODAIS, Primos, "
            "Fibonacci, Repetição Último, Posições 4/8/12.")


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


# ---------- Topo: concurso + lote do histórico ----------
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
        hist = listar(tipo="gerador", limit=50)
        opcoes = ["— Carregar do histórico —"] + [
            f"#{h['id']} · {h['nome']} · {h['n_jogos']} jogos · {h['dt'].replace('T', ' ')}"
            for h in hist
        ]
        sel = st.selectbox(
            "Lote de jogos (do histórico)", opcoes,
            help="Os jogos gerados ficam salvos no servidor — escolha aqui em vez de fazer upload.",
        )
    with st.expander("…ou enviar arquivo manualmente"):
        arquivo = st.file_uploader("Arquivo .txt", type=["txt"],
                                   label_visibility="collapsed")


# ---------- Carrega lote ----------
jogos: list[list[int]] = []
fonte = ""
nome_lote = "filtrado.txt"
if sel and sel.startswith("#"):
    sel_id = int(sel.split("·")[0].strip().lstrip("#"))
    full = carregar(sel_id)
    if full:
        jogos = [list(j) for j in full["jogos"]]
        fonte = f"histórico #{full['id']} · {full['nome']}"
        nome_lote = full["nome"].rsplit(".", 1)[0] + "F.txt"
elif arquivo is not None:
    txt = arquivo.read().decode("utf-8", errors="replace")
    for ln in txt.splitlines():
        g = parse_game(ln)
        if g:
            jogos.append(g)
    if jogos:
        fonte = f"upload: {arquivo.name}"
        nome_lote = arquivo.name.rsplit(".", 1)[0] + "F.txt"

if jogos:
    st.success(f"📥 **{len(jogos)} jogos carregados** ({fonte})")


# ---------- Histórico para "Ocorridos nos últimos 10 resultados" ----------
@st.cache_data(ttl=600, show_spinner=False)
def carrega_serie(target: int) -> list[list[int]]:
    raw = fetch_range(max(1, target - 10), target - 1)
    return [dezenas_de(raw[c]) for c in sorted(raw)]


with st.spinner("📡 Buscando últimos 10 resultados..."):
    serie = carrega_serie(int(conc))


nomes_serie = ["Pares", "Bordas", "Modas", "Primos", "Fibonacci",
                "Repetição Último", "Posição 4", "Posição 8", "Posição 12"]


# ---------- Layout: 'Ocorridos' (esquerda) | Filtros (direita) ----------
left, right = st.columns([1, 1], gap="medium")

with left:
    st.markdown('<div class="lc-section">Ocorridos nos últimos 10 resultados</div>',
                unsafe_allow_html=True)
    st.caption("Esquerda = mais antigo · Direita = mais recente")

    if serie:
        prev = None
        rows: dict[str, list[int]] = {n: [] for n in nomes_serie}
        for d in serie:
            retro = prev or set()
            for n in nomes_serie:
                rows[n].append(calc_var(n, d, retro))
            prev = set(d)

        # Tabela HTML estilo lc-history (mesmo padrão do Gerador)
        html = ['<div class="lc-history-wrap"><table class="lc-history">']
        html.append('<colgroup><col style="width:40%">')
        for _ in range(10):
            html.append('<col>')
        html.append('</colgroup>')
        html.append('<thead><tr><th>Variável</th>')
        for i in range(10):
            html.append(f'<th>{i+1}</th>')
        html.append('</tr></thead><tbody>')
        for n in nomes_serie:
            html.append('<tr>')
            html.append(f'<td class="lc-fmt" style="text-align:left;">{n}</td>')
            for v in rows[n]:
                html.append(f'<td class="lc-num">{v}</td>')
            html.append('</tr>')
        html.append('</tbody></table></div>')
        st.markdown("".join(html), unsafe_allow_html=True)
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
        h1, h2, h3, h4 = st.columns([0.5, 3.2, 1.1, 1.1])
        h1.markdown("<div style='font-size:11px;font-weight:700;color:#5C7080;text-transform:uppercase;letter-spacing:1px;'>✓</div>", unsafe_allow_html=True)
        h2.markdown("<div style='font-size:11px;font-weight:700;color:#5C7080;text-transform:uppercase;letter-spacing:1px;'>Filtro</div>", unsafe_allow_html=True)
        h3.markdown("<div style='font-size:11px;font-weight:700;color:#5C7080;text-transform:uppercase;letter-spacing:1px;'>Mín</div>", unsafe_allow_html=True)
        h4.markdown("<div style='font-size:11px;font-weight:700;color:#5C7080;text-transform:uppercase;letter-spacing:1px;'>Máx</div>", unsafe_allow_html=True)
        for nome, mn_def, mx_def in filtros_def:
            x1, x2, x3, x4 = st.columns([0.5, 3.2, 1.1, 1.1])
            on = x1.checkbox("on", key=f"on_{nome}", label_visibility="collapsed")
            x2.markdown(
                f"<div style='padding-top:8px;font-weight:600;font-size:14px;'>{nome}</div>",
                unsafe_allow_html=True,
            )
            mn = x3.number_input("min", key=f"mn_{nome}", value=mn_def,
                                  label_visibility="collapsed",
                                  min_value=0, max_value=999)
            mx = x4.number_input("max", key=f"mx_{nome}", value=mx_def,
                                  label_visibility="collapsed",
                                  min_value=0, max_value=999)
            cfg[nome] = {"on": on, "min": int(mn), "max": int(mx)}


st.divider()


# ---------- Aplicar ----------
b1, _ = st.columns([1, 4])
with b1:
    aplicar = st.button("🎯 Aplicar Filtros", type="primary",
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

    st.markdown('<div class="lc-section">Resultado</div>', unsafe_allow_html=True)
    m1, m2, m3 = st.columns(3, gap="small")
    with m1:
        st.markdown(metric_card("Lidas", str(lidas), "Total no lote"),
                    unsafe_allow_html=True)
    with m2:
        st.markdown(metric_card("Aceitas", str(len(aceitos)),
                                f"{(len(aceitos)/lidas*100 if lidas else 0):.1f}% passaram"),
                    unsafe_allow_html=True)
    with m3:
        elim_total = sum(elim.values())
        st.markdown(metric_card("Eliminadas", str(elim_total),
                                "Por todos os filtros somados"),
                    unsafe_allow_html=True)

    with st.expander("Eliminadas por filtro (detalhe)"):
        for n, _, _ in filtros_def:
            if cfg[n]["on"]:
                st.write(f"• **{n}** — eliminou {elim[n]} jogo(s)")

    if aceitos:
        buf = io.StringIO()
        for j in aceitos:
            buf.write(" ".join(f"{d:02d}" for d in j) + " \r\n")
        st.download_button(
            "⬇️ Baixar jogos filtrados",
            data=buf.getvalue().encode("ascii"),
            file_name=nome_lote, mime="text/plain", type="primary",
        )
        with st.expander(f"Ver {len(aceitos)} aprovados"):
            for i, j in enumerate(aceitos[:500], 1):
                st.code(f"{i:05d}  " + " ".join(f"{d:02d}" for d in j), language=None)
            if len(aceitos) > 500:
                st.caption(f"Mostrando 500 de {len(aceitos)}.")


footer()
