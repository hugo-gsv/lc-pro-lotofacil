"""Componentes visuais reutilizáveis — CSS, headers, cards, lottery balls."""

from __future__ import annotations

import streamlit as st

# Paleta principal (mantém fidelidade à cyan do app original)
PRIMARY = "#14C6E4"
PRIMARY_DARK = "#0095B6"
ACCENT = "#FF6B35"
INK = "#1A2A3A"
SOFT = "#F5FBFC"
BORDER = "#D7E8EC"


def inject_css() -> None:
    """Injeta CSS global (Google Font + tema visual coeso)."""
    st.markdown(
        f"""
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

        <style>
        :root {{
            --primary: {PRIMARY};
            --primary-dark: {PRIMARY_DARK};
            --accent: {ACCENT};
            --ink: {INK};
            --soft: {SOFT};
            --border: {BORDER};
        }}

        html, body, [class*="css"] {{
            font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
        }}

        /* Sidebar */
        section[data-testid="stSidebar"] {{
            background: linear-gradient(180deg, #0E2A38 0%, #143F52 100%);
        }}
        section[data-testid="stSidebar"] * {{
            color: #E8F8FB !important;
        }}
        section[data-testid="stSidebar"] a {{
            color: #FFFFFF !important;
            font-weight: 500;
        }}

        /* Hero / page header */
        .lc-hero {{
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            padding: 36px 40px;
            border-radius: 20px;
            color: white;
            box-shadow: 0 10px 30px rgba(20,198,228,.25);
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
        }}
        .lc-hero::after {{
            content: "🎯";
            position: absolute;
            right: -10px;
            top: -10px;
            font-size: 200px;
            opacity: .08;
            transform: rotate(-15deg);
        }}
        .lc-hero h1 {{
            font-size: 36px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -0.02em;
        }}
        .lc-hero p {{
            margin: 4px 0 0 0;
            font-size: 16px;
            opacity: 0.95;
        }}
        .lc-hero .lc-brand {{
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            opacity: 0.9;
            font-weight: 600;
        }}

        /* Page-level header (smaller) */
        .lc-pgheader {{
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 20px 24px;
            background: white;
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 2px 8px rgba(20,42,58,0.04);
            margin-bottom: 20px;
        }}
        .lc-pgheader .lc-icon {{
            width: 56px; height: 56px;
            border-radius: 14px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            display: flex; align-items: center; justify-content: center;
            font-size: 28px;
            box-shadow: 0 4px 12px rgba(20,198,228,.25);
        }}
        .lc-pgheader h2 {{
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: var(--ink);
        }}
        .lc-pgheader p {{
            margin: 2px 0 0 0;
            color: #5C7080;
            font-size: 14px;
        }}

        /* Metrics card */
        .lc-metric {{
            background: white;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px 22px;
            box-shadow: 0 2px 8px rgba(20,42,58,.04);
            transition: transform .15s, box-shadow .15s;
        }}
        .lc-metric:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(20,42,58,.08);
        }}
        .lc-metric-label {{
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 1.2px;
            color: #5C7080;
            font-weight: 600;
        }}
        .lc-metric-value {{
            font-size: 28px;
            font-weight: 800;
            color: var(--ink);
            line-height: 1.2;
            margin-top: 4px;
        }}
        .lc-metric-sub {{
            font-size: 12px;
            color: #5C7080;
            margin-top: 2px;
        }}

        /* Lottery balls */
        .lc-balls {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            padding: 20px;
            background: linear-gradient(135deg, #F5FBFC 0%, #E8F8FB 100%);
            border-radius: 14px;
            border: 1px solid var(--border);
        }}
        .lc-ball {{
            width: 52px; height: 52px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px;
            font-weight: 700;
            color: white;
            background: radial-gradient(circle at 30% 30%, var(--primary) 0%, var(--primary-dark) 100%);
            box-shadow: 0 4px 12px rgba(20,198,228,.35), inset -3px -3px 6px rgba(0,0,0,.15);
            transition: transform .15s;
        }}
        .lc-ball:hover {{
            transform: scale(1.08);
        }}
        .lc-ball.dim {{
            background: radial-gradient(circle at 30% 30%, #E0E8EC 0%, #B5C3CB 100%);
            color: #5C7080;
            box-shadow: 0 2px 6px rgba(20,42,58,.08), inset -3px -3px 6px rgba(0,0,0,.08);
        }}

        /* Tool card */
        .lc-tool {{
            background: white;
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            transition: transform .2s, box-shadow .2s, border-color .2s;
            height: 100%;
        }}
        .lc-tool:hover {{
            transform: translateY(-4px);
            border-color: var(--primary);
            box-shadow: 0 12px 28px rgba(20,198,228,.18);
        }}
        .lc-tool-icon {{
            width: 56px; height: 56px;
            border-radius: 14px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            display: flex; align-items: center; justify-content: center;
            font-size: 28px;
            margin-bottom: 14px;
            box-shadow: 0 4px 12px rgba(20,198,228,.25);
        }}
        .lc-tool h3 {{
            margin: 0 0 6px 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--ink);
        }}
        .lc-tool p {{
            margin: 0 0 16px 0;
            color: #5C7080;
            font-size: 14px;
            line-height: 1.5;
        }}

        /* Section title */
        .lc-section {{
            font-size: 13px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 2px;
            color: var(--primary-dark);
            margin: 24px 0 12px 0;
        }}

        /* Footer */
        .lc-footer {{
            margin-top: 60px;
            padding: 24px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #5C7080;
            font-size: 13px;
        }}
        .lc-footer a {{
            color: var(--primary-dark);
            text-decoration: none;
            font-weight: 600;
        }}
        .lc-footer a:hover {{
            text-decoration: underline;
        }}

        /* Dataframes / tables look cleaner */
        [data-testid="stDataFrame"] {{
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid var(--border);
        }}

        /* Buttons (primary look) */
        .stButton > button {{
            border-radius: 10px;
            font-weight: 600;
            transition: transform .12s, box-shadow .12s;
        }}
        .stButton > button[kind="primary"] {{
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            border: none;
            box-shadow: 0 4px 12px rgba(20,198,228,.3);
        }}
        .stButton > button[kind="primary"]:hover {{
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(20,198,228,.4);
        }}

        /* Input fields */
        [data-baseweb="input"], [data-baseweb="select"] {{
            border-radius: 10px !important;
        }}

        /* ASCII chart */
        .lc-chart {{
            background: var(--ink);
            color: #B8E8F2;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            padding: 16px;
            border-radius: 12px;
            line-height: 1.4;
            white-space: pre;
            overflow-x: auto;
        }}
        .lc-chart .x {{ color: var(--accent); font-weight: 700; }}
        .lc-chart .center {{ color: var(--primary); }}

        /* Hide Streamlit branding clutter */
        #MainMenu {{ visibility: hidden; }}
        footer {{ visibility: hidden; }}
        header[data-testid="stHeader"] {{ background: transparent; }}
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
    """Renderiza dezenas como bolas. Se 'destacar' for dado, só essas
    aparecem coloridas; as outras ficam dim."""
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
    """No-op: rodapé removido a pedido do usuário."""
    return
