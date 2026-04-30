# LC Pro Lotofácil

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://lc-pro-lotofacil.streamlit.app/)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Sistema online de **análise e geração de jogos para a Lotofácil**.

## ✨ Recursos

- **📊 Gerador**: cruzamento matricial Linha × Coluna com SPQ, CSN, soma e múltiplos formatos aceitos
- **🔍 Filtrar Jogo**: 9 filtros estatísticos (Pares, Bordas, **Modas/MODAIS**, Primos, Fibonacci, Repetição Último, Posições 4/8/12)
- **✅ Conferidor**: confere jogos contra qualquer concurso e gera `premio.txt`
- **🔄 Auto-update**: pega último resultado da API oficial da Caixa automaticamente

## 🧮 Conceitos validados

| Métrica | Definição | Validação |
|---|---|---|
| **SPQ** | `Σ fᵢ·i` (soma ponderada por posição), range 30–60 | 9/9 contra screenshot do app original |
| **CSN** | rank crescente do formato como inteiro de 5 dígitos, entre os 651 formatos válidos | 9/9 contra screenshot do app original |
| **MODAIS** | `{1, 2, 4, 6, 8, 9, 11, 13, 15, 17, 18, 20, 22, 24, 25}` — 8 pares + 7 ímpares, formato 33333, simetria perfeita, soma 195 | 100% contra arquivo `3673AAF.txt` (330 aceitos com Modas∈[8,9]) |

## 🚀 Rodar local

```bash
git clone https://github.com/hugo-gsv/lc-pro-lotofacil.git
cd lc-pro-lotofacil
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Abre em `http://localhost:8501`.

## 🌐 Versão online

Acesse: **<https://lc-pro-lotofacil.streamlit.app/>**

## 📂 Estrutura

```
lc-pro-lotofacil/
├── streamlit_app.py      # entrada — Home com último resultado
├── pages/
│   ├── 1_Gerador.py
│   ├── 2_Filtrar_Jogo.py
│   └── 3_Conferidor.py
├── lib/
│   └── lottery.py        # SPQ, CSN, MODAIS, API Caixa
├── .streamlit/config.toml
├── requirements.txt
└── README.md
```

## 📡 API utilizada

- `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil` (oficial Caixa)

## 📝 Licença

MIT — veja [LICENSE](LICENSE).
