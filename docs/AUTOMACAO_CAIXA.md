# Automação Caixa

O Vercel não executa a automação dentro do seu navegador local. Por isso a integração usa uma ponte:

1. O LC Pro gera as 5 fichas.
2. O botão **Automatizar na Caixa** tenta enviar as fichas para o assistente local em `127.0.0.1`.
3. Se o assistente local não estiver aberto, o site tenta criar um job pendente no Supabase.
4. O assistente local, rodando no Mac, preenche os jogos no site da Caixa.
5. A conferência e a finalização da aposta continuam manuais.

## Instalação local

Na raiz do projeto:

```bash
python3 -m venv .venv-caixa
source .venv-caixa/bin/activate
pip install selenium
```

Se o Selenium não encontrar o ChromeDriver sozinho, use o driver antigo:

```bash
export CHROMEDRIVER_PATH="/Users/mac/Documents/Claude/Projects/Apps loteria/Lotofacil automacao/chromedriver-mac-arm64/chromedriver"
```

## Rodar como ponte local

Crie um arquivo local `.env.caixa` na raiz do projeto. Ele não vai para o Git:

```bash
cp .env.caixa.example .env.caixa
```

Preencha:

```bash
LC_PRO_URL=https://lc-pro-lotofacil.vercel.app
CAIXA_CPF=SEU_CPF
CAIXA_SENHA=SUA_SENHA
GMAIL_IMAP_EMAIL=seu-email@gmail.com
GMAIL_IMAP_APP_PASSWORD=sua-senha-de-app
GMAIL_IMAP_FROM=logincaixa@caixa.gov.br
GMAIL_IMAP_SUBJECT=Código de Validação
GMAIL_IMAP_LOOKBACK_MINUTES=10
```

Depois rode:

```bash
python3 tools/caixa_automacao_local.py --bridge --keep-open
```

Se algum campo não estiver no `.env.caixa`, o assistente pergunta no terminal.

## Rodar aguardando fila online

Use este modo se quiser deixar o assistente lendo jobs pendentes do Supabase:

```bash
export LC_PRO_URL="https://lc-pro-lotofacil.vercel.app"
python3 tools/caixa_automacao_local.py --watch --keep-open
```

## Código de validação

Com `GMAIL_IMAP_EMAIL` e `GMAIL_IMAP_APP_PASSWORD` preenchidos, o assistente lê o código do Gmail automaticamente, igual ao programa antigo. Se não conseguir ler o e-mail, ele pede o código manualmente para não travar.

Esses dados ficam somente no Mac. Não coloque CPF, senha da Caixa, senha de e-mail ou código de validação no site ou no repositório.

## Processar um job específico

```bash
python3 tools/caixa_automacao_local.py --job-id 123 --keep-open
```

## Pagamento

O padrão é parar com os jogos no carrinho. Existe a opção `--ir-pagamento` para avançar até a etapa de pagamento, mas o assistente não confirma pagamento automaticamente.
