"""Sistema de design — visual profissional para LC Pro Lotofácil.

Streamlit + CSS pesado: gradient mesh background, glassmorphism nos cards,
tipografia Plus Jakarta Sans, lottery balls 3D, animações sutis.
"""

from __future__ import annotations

import streamlit as st

# ---- Paleta ----
PRIMARY = "#14C6E4"
PRIMARY_DARK = "#0095B6"
PRIMARY_DARKER = "#006B82"
ACCENT = "#FF6B35"
ACCENT_WARM = "#FFB627"
INK = "#0F1B2D"
INK_SOFT = "#1A2A3A"
INK_MUTE = "#5C7080"
SOFT = "#F8FBFC"
SOFT_BLUE = "#E8F8FB"
BORDER = "#DDE8EC"


def inject_css() -> None:
    st.markdown(
        f"""
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

        <style>
        :root {{
            --primary: {PRIMARY};
            --primary-dark: {PRIMARY_DARK};
            --primary-darker: {PRIMARY_DARKER};
            --accent: {ACCENT};
            --accent-warm: {ACCENT_WARM};
            --ink: {INK};
            --ink-soft: {INK_SOFT};
            --ink-mute: {INK_MUTE};
            --soft: {SOFT};
            --soft-blue: {SOFT_BLUE};
            --border: {BORDER};
            --shadow-xs: 0 1px 2px rgba(15,27,45,.04);
            --shadow-sm: 0 2px 6px rgba(15,27,45,.05);
            --shadow-md: 0 4px 16px rgba(15,27,45,.06);
            --shadow-lg: 0 12px 32px rgba(15,27,45,.08);
            --shadow-glow: 0 8px 30px rgba(20,198,228,.18);
            --shadow-glow-lg: 0 16px 50px rgba(20,198,228,.25);
        }}

        /* Tipografia global */
        html, body, [class*="css"] {{
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            -webkit-font-smoothing: antialiased;
            color: var(--ink);
        }}

        /* Background com gradient mesh sutil */
        [data-testid="stAppViewContainer"] {{
            background:
                radial-gradient(circle at 15% 0%, rgba(20,198,228,.07) 0%, transparent 45%),
                radial-gradient(circle at 85% 100%, rgba(255,107,53,.04) 0%, transparent 50%),
                radial-gradient(circle at 50% 50%, rgba(45,212,191,.03) 0%, transparent 60%),
                #FAFCFD;
        }}

        /* Sidebar — gradient elegante com pattern */
        section[data-testid="stSidebar"] {{
            background:
                radial-gradient(circle at 0% 0%, rgba(20,198,228,.15) 0%, transparent 40%),
                linear-gradient(180deg, #0A1F2A 0%, #0F2D3D 50%, #143F52 100%);
            border-right: 1px solid rgba(255,255,255,.05);
        }}
        section[data-testid="stSidebar"] * {{
            color: #E8F8FB !important;
        }}
        section[data-testid="stSidebar"] [data-testid="stSidebarNav"] {{
            padding-top: 24px;
        }}
        section[data-testid="stSidebar"] [data-testid="stSidebarNav"] a {{
            border-radius: 10px;
            padding: 10px 14px;
            font-weight: 600;
            letter-spacing: -.01em;
            transition: all .15s;
        }}
        section[data-testid="stSidebar"] [data-testid="stSidebarNav"] a:hover {{
            background: rgba(20,198,228,.15);
            transform: translateX(2px);
        }}

        /* === HERO === */
        .lc-hero {{
            position: relative;
            padding: 48px 44px;
            border-radius: 24px;
            color: white;
            background:
                linear-gradient(135deg, var(--primary-darker) 0%, var(--primary-dark) 35%, var(--primary) 100%);
            box-shadow: var(--shadow-glow-lg), 0 1px 0 rgba(255,255,255,.25) inset;
            margin-bottom: 28px;
            overflow: hidden;
        }}
        .lc-hero::before {{
            content: '';
            position: absolute; inset: 0;
            background:
                radial-gradient(circle at 100% 0%, rgba(255,255,255,.15) 0%, transparent 35%),
                radial-gradient(circle at 0% 100%, rgba(0,0,0,.12) 0%, transparent 45%);
            pointer-events: none;
        }}
        .lc-hero::after {{
            content: '🎯';
            position: absolute;
            right: -30px; top: -30px;
            font-size: 240px;
            opacity: .07;
            transform: rotate(-12deg);
            pointer-events: none;
        }}
        .lc-hero h1 {{
            font-size: 44px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -.025em;
            line-height: 1.05;
            position: relative;
        }}
        .lc-hero p {{
            margin: 8px 0 0 0;
            font-size: 17px;
            opacity: .92;
            font-weight: 500;
            max-width: 560px;
            line-height: 1.5;
            position: relative;
        }}
        .lc-hero .lc-brand {{
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 4px;
            opacity: .85;
            font-weight: 700;
            margin-bottom: 10px;
        }}

        /* === Page header === */
        .lc-pgheader {{
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 22px 26px;
            background: white;
            border-radius: 18px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
            margin-bottom: 22px;
            position: relative;
            overflow: hidden;
        }}
        .lc-pgheader::before {{
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 3px;
            background: linear-gradient(90deg, var(--primary) 0%, var(--primary-dark) 100%);
        }}
        .lc-pgheader .lc-icon {{
            width: 56px; height: 56px;
            border-radius: 16px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            display: flex; align-items: center; justify-content: center;
            font-size: 28px;
            box-shadow: var(--shadow-glow);
        }}
        .lc-pgheader h2 {{
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -.02em;
            color: var(--ink);
        }}
        .lc-pgheader p {{
            margin: 3px 0 0 0;
            color: var(--ink-mute);
            font-size: 14px;
            font-weight: 500;
        }}

        /* === Métricas — cards premium === */
        .lc-metric {{
            position: relative;
            background: white;
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px 22px 18px 22px;
            box-shadow: var(--shadow-xs);
            transition: all .2s ease;
            height: 100%;
            min-height: 118px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
        }}
        .lc-metric::before {{
            content: '';
            position: absolute;
            top: 0; left: 16px; right: 16px;
            height: 3px;
            background: linear-gradient(90deg, var(--primary), var(--primary-dark));
            border-radius: 0 0 4px 4px;
            opacity: 0;
            transition: opacity .2s;
        }}
        .lc-metric:hover {{
            transform: translateY(-3px);
            box-shadow: var(--shadow-lg);
            border-color: rgba(20,198,228,.25);
        }}
        .lc-metric:hover::before {{
            opacity: 1;
        }}
        .lc-metric-label {{
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 1.4px;
            color: var(--ink-mute);
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}
        .lc-metric-value {{
            font-size: 24px;
            font-weight: 800;
            color: var(--ink);
            line-height: 1.15;
            margin-top: 6px;
            letter-spacing: -.02em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}
        .lc-metric-sub {{
            font-size: 11px;
            color: var(--ink-mute);
            margin-top: 4px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }}

        /* Garante que .lc-metric e .lc-tool em row tenham mesma altura */
        [data-testid="stHorizontalBlock"]:has(.lc-metric),
        [data-testid="stHorizontalBlock"]:has(.lc-tool) {{
            align-items: stretch;
        }}
        [data-testid="stHorizontalBlock"]:has(.lc-metric) [data-testid="column"] > div,
        [data-testid="stHorizontalBlock"]:has(.lc-tool) [data-testid="column"] > div {{
            height: 100%;
        }}

        /* === Lottery balls — 3D realista === */
        .lc-balls {{
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            justify-content: center;
            padding: 28px 24px;
            background:
                radial-gradient(circle at 50% 100%, rgba(20,198,228,.08) 0%, transparent 60%),
                linear-gradient(180deg, var(--soft) 0%, var(--soft-blue) 100%);
            border-radius: 18px;
            border: 1px solid var(--border);
            box-shadow: inset 0 1px 2px rgba(15,27,45,.03);
        }}
        .lc-ball {{
            width: 56px; height: 56px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 19px;
            font-weight: 800;
            color: white;
            position: relative;
            background:
                radial-gradient(circle at 30% 28%,
                    rgba(255,255,255,.45) 0%,
                    rgba(255,255,255,0) 30%),
                radial-gradient(circle at 50% 50%,
                    var(--primary) 0%,
                    var(--primary-dark) 60%,
                    var(--primary-darker) 100%);
            box-shadow:
                0 8px 18px rgba(20,198,228,.35),
                inset -4px -6px 10px rgba(0,0,0,.18),
                inset 0 1px 2px rgba(255,255,255,.4);
            text-shadow: 0 1px 2px rgba(0,0,0,.25);
            transition: transform .15s, box-shadow .15s;
            letter-spacing: -.02em;
        }}
        .lc-ball:hover {{
            transform: scale(1.08) translateY(-2px);
            box-shadow:
                0 12px 22px rgba(20,198,228,.5),
                inset -4px -6px 10px rgba(0,0,0,.2),
                inset 0 1px 2px rgba(255,255,255,.5);
        }}
        .lc-ball.dim {{
            background:
                radial-gradient(circle at 30% 28%,
                    rgba(255,255,255,.55) 0%,
                    rgba(255,255,255,0) 30%),
                radial-gradient(circle at 50% 50%,
                    #E8EDF0 0%,
                    #B8C4CC 70%,
                    #9DABB5 100%);
            color: #5C7080;
            box-shadow:
                0 4px 10px rgba(15,27,45,.08),
                inset -3px -4px 6px rgba(0,0,0,.08),
                inset 0 1px 2px rgba(255,255,255,.6);
            text-shadow: none;
        }}

        /* === Tool cards — premium === */
        .lc-tool {{
            position: relative;
            background: white;
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 28px;
            transition: all .25s cubic-bezier(.4,0,.2,1);
            height: 100%;
            min-height: 230px;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            overflow: hidden;
        }}
        .lc-tool::before {{
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(20,198,228,.04) 0%, transparent 50%);
            opacity: 0;
            transition: opacity .25s;
        }}
        .lc-tool:hover {{
            transform: translateY(-6px);
            border-color: var(--primary);
            box-shadow: 0 20px 40px rgba(20,198,228,.18);
        }}
        .lc-tool:hover::before {{
            opacity: 1;
        }}
        .lc-tool-icon {{
            width: 64px; height: 64px;
            border-radius: 18px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            display: flex; align-items: center; justify-content: center;
            font-size: 32px;
            margin-bottom: 18px;
            box-shadow: var(--shadow-glow);
            position: relative;
        }}
        .lc-tool h3 {{
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -.02em;
            color: var(--ink);
            position: relative;
        }}
        .lc-tool p {{
            margin: 0;
            color: var(--ink-mute);
            font-size: 14px;
            font-weight: 500;
            line-height: 1.55;
            position: relative;
        }}

        /* === Section titles — refinados === */
        .lc-section {{
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 2.5px;
            color: var(--primary-dark);
            margin: 28px 0 14px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .lc-section::after {{
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, var(--border) 0%, transparent 100%);
        }}

        /* === Botões premium === */
        .stButton > button {{
            border-radius: 12px;
            font-weight: 700;
            letter-spacing: -.01em;
            font-family: 'Plus Jakarta Sans', sans-serif;
            transition: all .2s;
            border: 1px solid var(--border);
        }}
        .stButton > button:hover {{
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }}
        .stButton > button[kind="primary"] {{
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            border: none;
            box-shadow: var(--shadow-glow);
            font-weight: 800;
        }}
        .stButton > button[kind="primary"]:hover {{
            transform: translateY(-2px);
            box-shadow: var(--shadow-glow-lg);
        }}

        /* Inputs com focus ring */
        [data-baseweb="input"], [data-baseweb="select"] {{
            border-radius: 10px !important;
        }}
        [data-baseweb="input"]:focus-within {{
            box-shadow: 0 0 0 3px rgba(20,198,228,.15);
        }}

        /* === Histórico — tabela premium === */
        .lc-history-wrap {{
            max-height: 540px;
            overflow-y: auto;
            border-radius: 18px;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-sm);
            background: white;
        }}
        .lc-history {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: white;
        }}
        .lc-history thead th {{
            background: linear-gradient(180deg, #FBFDFE 0%, #F4F8FA 100%);
            color: var(--ink);
            font-weight: 800;
            text-transform: uppercase;
            font-size: 10.5px;
            letter-spacing: 1px;
            padding: 12px 14px;
            text-align: left;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 1;
        }}
        .lc-history tbody td {{
            padding: 7px 14px;
            border-bottom: 1px solid #F2F6F8;
            color: var(--ink);
            white-space: nowrap;
        }}
        .lc-history tbody tr:nth-child(even) td {{
            background: #FBFDFE;
        }}
        .lc-history tbody tr:hover td {{
            background: var(--soft-blue) !important;
        }}
        .lc-history tbody tr:last-child td {{
            border-bottom: none;
        }}
        .lc-history td.lc-num {{
            font-variant-numeric: tabular-nums;
            font-weight: 600;
            text-align: right;
        }}
        .lc-history td.lc-fmt {{
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            color: var(--primary-dark);
        }}
        .lc-history td.lc-bar {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 12.5px;
            padding: 7px 14px;
            white-space: pre;
            color: #C8D4DA;
            letter-spacing: 0.5px;
            width: 1%;       /* shrink-to-fit pra não sobrar espaço */
        }}
        .lc-history td.lc-bar .x {{
            color: var(--accent);
            font-weight: 800;
        }}
        .lc-history td.lc-bar .center {{
            color: var(--primary-dark);
            font-weight: 800;
        }}

        /* Container border + sombra */
        [data-testid="stVerticalBlockBorderWrapper"] {{
            border-radius: 18px !important;
        }}

        /* Dataframes */
        [data-testid="stDataFrame"] {{
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-xs);
        }}

        /* Esconde branding clutter */
        #MainMenu {{ visibility: hidden; }}
        footer {{ visibility: hidden; }}
        header[data-testid="stHeader"] {{ background: transparent; }}

        /* Animação de entrada */
        @keyframes lc-fade-up {{
            from {{ opacity: 0; transform: translateY(8px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}
        .lc-hero, .lc-pgheader, .lc-metric, .lc-tool, .lc-balls, .lc-history-wrap {{
            animation: lc-fade-up .4s cubic-bezier(.4,0,.2,1);
        }}
        </style>
        """,
        unsafe_allow_html=True,
    )


def hero(title: str, subtitle: str = "", brand: str = "") -> None:
    brand_html = f'<div class="lc-brand">{brand}</div>' if brand else ""
    html = (
        f'<div class="lc-hero">{brand_html}'
        f'<h1>{title}</h1><p>{subtitle}</p></div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def page_header(icon: str, title: str, subtitle: str = "") -> None:
    html = (
        f'<div class="lc-pgheader">'
        f'<div class="lc-icon">{icon}</div>'
        f'<div><h2>{title}</h2><p>{subtitle}</p></div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def metric_card(label: str, value: str, sub: str = "") -> str:
    return (
        f'<div class="lc-metric">'
        f'<div class="lc-metric-label">{label}</div>'
        f'<div class="lc-metric-value">{value}</div>'
        f'<div class="lc-metric-sub">{sub}</div>'
        f'</div>'
    )


def dezenas_balls(dez: list[int], destacar: set[int] | None = None) -> None:
    html = '<div class="lc-balls">'
    for d in dez:
        cls = "lc-ball" if (destacar is None or d in destacar) else "lc-ball dim"
        html += f'<div class="{cls}">{d:02d}</div>'
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)


def tool_card(icon: str, title: str, desc: str) -> str:
    return (
        f'<div class="lc-tool">'
        f'<div class="lc-tool-icon">{icon}</div>'
        f'<h3>{title}</h3><p>{desc}</p>'
        f'</div>'
    )


def footer(version: str = "v1.0") -> None:
    """No-op."""
    return
