#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Assistente local da automação Caixa.

Ele lê a fila criada pelo LC Pro em /api/automacao/jobs, abre o navegador no Mac
e preenche os jogos no site da Caixa. Credenciais ficam somente na máquina local:
variáveis de ambiente ou prompt no terminal.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

CAIXA_HOME = "https://www.loteriasonline.caixa.gov.br/silce-web/#/home"
CAIXA_LOTOFACIL = "https://www.loteriasonline.caixa.gov.br/silce-web/#/lotofacil"
BRIDGE_LOCK = threading.Lock()

try:
    from selenium import webdriver
    from selenium.common.exceptions import (
        ElementClickInterceptedException,
        StaleElementReferenceException,
        TimeoutException,
    )
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait
except ImportError:
    webdriver = None  # type: ignore[assignment]
    Service = None  # type: ignore[assignment]
    By = None  # type: ignore[assignment]
    EC = None  # type: ignore[assignment]
    WebDriverWait = None  # type: ignore[assignment]
    TimeoutException = Exception  # type: ignore[misc,assignment]
    ElementClickInterceptedException = Exception  # type: ignore[misc,assignment]
    StaleElementReferenceException = Exception  # type: ignore[misc,assignment]


def http_json(method: str, url: str, payload: dict[str, Any] | None = None) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def endpoint(base_url: str, path: str) -> str:
    return base_url.rstrip("/") + path


def buscar_job(base_url: str, job_id: int) -> dict[str, Any]:
    return http_json("GET", endpoint(base_url, f"/api/automacao/jobs/{job_id}"))


def buscar_pendente(base_url: str) -> dict[str, Any] | None:
    jobs = http_json("GET", endpoint(base_url, "/api/automacao/jobs?status=pendente&limit=1"))
    if isinstance(jobs, list) and jobs:
        return jobs[0]
    return None


def atualizar_job(base_url: str, job_id: int, status: str, mensagem: str) -> None:
    try:
        http_json(
            "PATCH",
            endpoint(base_url, f"/api/automacao/jobs/{job_id}"),
            {"status": status, "detalhes": {"mensagem": mensagem}},
        )
    except Exception as exc:
        print(f"[aviso] Não consegui atualizar o job #{job_id}: {exc}")


def normalizar_jogos(raw: Any) -> list[list[int]]:
    if not isinstance(raw, list):
        raise ValueError("jogos_json inválido")
    jogos: list[list[int]] = []
    for idx, jogo in enumerate(raw, start=1):
        if not isinstance(jogo, list):
            raise ValueError(f"jogo {idx} inválido")
        dezenas = sorted({int(d) for d in jogo})
        if len(dezenas) != 15 or any(d < 1 or d > 25 for d in dezenas):
            raise ValueError(f"jogo {idx} precisa ter 15 dezenas únicas entre 1 e 25")
        jogos.append(dezenas)
    return jogos


def credenciais_caixa() -> tuple[str, str]:
    cpf = os.environ.get("CAIXA_CPF") or input("CPF Caixa: ").strip()
    senha = os.environ.get("CAIXA_SENHA") or getpass.getpass("Senha Caixa: ")
    if not cpf or not senha:
        raise RuntimeError("CPF e senha são obrigatórios")
    return cpf, senha


def buscar_codigo_email() -> str | None:
    usuario = os.environ.get("GMAIL_IMAP_EMAIL")
    senha = os.environ.get("GMAIL_IMAP_APP_PASSWORD")
    if not usuario or not senha:
        return None

    import email
    import imaplib
    from email.utils import parsedate_to_datetime

    remetente = os.environ.get("GMAIL_IMAP_FROM", "logincaixa@caixa.gov.br")
    assunto = os.environ.get("GMAIL_IMAP_SUBJECT", "Código de Validação")
    minutos = int(os.environ.get("GMAIL_IMAP_LOOKBACK_MINUTES", "10"))

    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(usuario, senha)
    mail.select("inbox")
    _status, data = mail.search(None, f'(FROM "{remetente}")')
    mail_ids = data[0].split()
    agora = datetime.now(timezone.utc)

    for email_id in reversed(mail_ids):
        _status, data = mail.fetch(email_id, "(RFC822)")
        msg = email.message_from_bytes(data[0][1])
        data_email = msg.get("Date")
        if data_email:
            try:
                dt_email = parsedate_to_datetime(data_email)
                if (agora - dt_email).total_seconds() > minutos * 60:
                    continue
            except Exception:
                pass

        subject = email.header.decode_header(msg.get("Subject"))
        subject_decoded = ""
        for part, enc in subject:
            subject_decoded += part.decode(enc or "utf-8", errors="ignore") if isinstance(part, bytes) else part
        if assunto.lower() not in subject_decoded.lower():
            continue

        corpo = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    corpo = part.get_payload(decode=True).decode(errors="ignore")
                    break
        else:
            corpo = msg.get_payload(decode=True).decode(errors="ignore")

        codigo = re.search(r"\b\d{6}\b", corpo)
        if codigo:
            return codigo.group(0)
    return None


def obter_codigo_validacao() -> str:
    print("Aguardando o código de validação da Caixa...")
    for _ in range(10):
        codigo = buscar_codigo_email()
        if codigo:
            print("Código recebido por e-mail.")
            return codigo
        time.sleep(5)
    return input("Digite o código recebido por e-mail/SMS: ").strip()


def iniciar_driver(chromedriver: str | None):
    if webdriver is None:
        raise RuntimeError("Selenium não instalado. Rode: pip install selenium")

    if chromedriver:
        service = Service(chromedriver)
        driver = webdriver.Chrome(service=service)
    else:
        driver = webdriver.Chrome()
    driver.get(CAIXA_HOME)
    return driver, WebDriverWait(driver, 30)


def existe_elemento_xpath(driver, xpath: str, timeout: int = 3) -> bool:
    try:
        WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.XPATH, xpath)))
        return True
    except TimeoutException:
        return False


def clicar_xpath(driver, xpath: str, timeout: int = 30, tentativas: int = 3) -> None:
    last_exc: Exception | None = None
    for _ in range(tentativas):
        try:
            el = WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.XPATH, xpath)))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", el)
            WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((By.XPATH, xpath))).click()
            return
        except (ElementClickInterceptedException, StaleElementReferenceException, TimeoutException) as exc:
            last_exc = exc
            try:
                el = driver.find_element(By.XPATH, xpath)
                driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", el)
                driver.execute_script("arguments[0].click();", el)
                return
            except Exception:
                time.sleep(0.7)
    if last_exc:
        raise last_exc


def login_caixa(driver, wait, cpf: str, senha: str) -> None:
    try:
        clicar_xpath(driver, '//*[@id="botaosim"]', timeout=5)
        print("Termos aceitos.")
    except Exception:
        print("Tela de aceite não apareceu.")

    clicar_xpath(driver, '//*[@id="btnLogin"]/span')
    wait.until(EC.visibility_of_element_located((By.XPATH, '//*[@id="username"]'))).send_keys(cpf)
    clicar_xpath(driver, '//*[@id="button-submit"]')
    clicar_xpath(driver, '//*[@id="form-login"]/div[2]/button[1]')

    codigo = obter_codigo_validacao()
    wait.until(EC.visibility_of_element_located((By.XPATH, '//*[@id="codigo"]'))).send_keys(codigo)
    clicar_xpath(driver, '//*[@id="form-login"]/div[3]/button[1]')

    wait.until(EC.visibility_of_element_located((By.XPATH, '//*[@id="password"]'))).send_keys(senha)
    clicar_xpath(driver, '//*[@id="template-section"]/form[1]/div/button')


def selecionar_dezenas(driver, dezenas: list[int]) -> None:
    script = ""
    for dezena in dezenas:
        script += (
            f"var e=document.getElementById('n{dezena:02d}');"
            "if(e && !String(e.className).includes('selected')){e.click();}"
        )
    driver.execute_script(script)

    selecionadas: list[int] = []
    for dezena in dezenas:
        el = driver.find_element(By.XPATH, f'//*[@id="n{dezena:02d}"]')
        if "selected" in el.get_attribute("class"):
            selecionadas.append(dezena)

    if len(selecionadas) != 15:
        faltantes = [d for d in dezenas if d not in selecionadas]
        for dezena in faltantes:
            driver.execute_script(f"document.getElementById('n{dezena:02d}').click();")
        selecionadas = []
        for dezena in dezenas:
            el = driver.find_element(By.XPATH, f'//*[@id="n{dezena:02d}"]')
            if "selected" in el.get_attribute("class"):
                selecionadas.append(dezena)

    if len(selecionadas) != 15:
        raise RuntimeError(f"Apenas {len(selecionadas)} dezenas foram selecionadas: {selecionadas}")


def inserir_jogos_caixa(
    jogos: list[list[int]],
    chromedriver: str | None,
    ir_pagamento: bool,
    keep_open: bool,
) -> None:
    cpf, senha = credenciais_caixa()
    driver, wait = iniciar_driver(chromedriver)
    try:
        login_caixa(driver, wait, cpf, senha)
        clicar_xpath(driver, '//*[@id="Lotofácil"]')
        print("Lotofácil aberta.")

        for idx, jogo in enumerate(jogos, start=1):
            print(f"Inserindo jogo {idx:02d}: {' '.join(str(d).zfill(2) for d in jogo)}")
            driver.get(CAIXA_LOTOFACIL)
            WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.XPATH, '//*[@id="n01"]')))
            selecionar_dezenas(driver, jogo)
            clicar_xpath(driver, '//*[@id="colocarnocarrinho"]')
            time.sleep(1)

        if ir_pagamento:
            clicar_xpath(driver, '//*[@id="irparapagamento"]')
            modal_xpath = '//*[@id="simnao-cancel"]/div/div/div[3]/button[2]'
            if existe_elemento_xpath(driver, modal_xpath, timeout=5):
                clicar_xpath(driver, modal_xpath, timeout=5)
            print("Jogos enviados para a etapa de pagamento. Confira manualmente antes de finalizar.")
        else:
            print("Jogos inseridos no carrinho. Confira manualmente no site da Caixa.")

        if keep_open:
            input("Pressione Enter para fechar o navegador...")
    finally:
        if not keep_open:
            driver.quit()
        else:
            driver.quit()


def processar_job(base_url: str, job: dict[str, Any], args: argparse.Namespace) -> None:
    job_id = int(job["id"])
    jogos = normalizar_jogos(job.get("jogos_json"))
    atualizar_job(base_url, job_id, "rodando", "Assistente local iniciou a inserção")
    try:
        inserir_jogos_caixa(jogos, args.chromedriver, args.ir_pagamento, args.keep_open)
        atualizar_job(base_url, job_id, "concluido", "Jogos inseridos no carrinho da Caixa")
    except Exception as exc:
        atualizar_job(base_url, job_id, "erro", str(exc))
        raise


def origem_permitida(origin: str | None, base_url: str) -> bool:
    if not origin:
        return True
    base_origin = urllib.parse.urlparse(base_url)
    allowed = {
        f"{base_origin.scheme}://{base_origin.netloc}",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    }
    extra = os.environ.get("LC_PRO_ALLOWED_ORIGIN")
    if extra:
        allowed.add(extra.rstrip("/"))
    return origin.rstrip("/") in allowed


def responder_json(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    origin = handler.headers.get("Origin")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Private-Network", "true")
    if origin:
        handler.send_header("Access-Control-Allow-Origin", origin)
    else:
        handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(json.dumps(payload).encode("utf-8"))


def processar_jogos_bridge(jogos: list[list[int]], args: argparse.Namespace) -> None:
    try:
        inserir_jogos_caixa(jogos, args.chromedriver, args.ir_pagamento, args.keep_open)
        print("Job local concluído.")
    except Exception as exc:
        print(f"Erro no job local: {exc}", file=sys.stderr)
    finally:
        BRIDGE_LOCK.release()


def criar_bridge_handler(args: argparse.Namespace):
    class BridgeHandler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *fmt_args: Any) -> None:
            print("[bridge] " + fmt % fmt_args)

        def do_OPTIONS(self) -> None:
            if not origem_permitida(self.headers.get("Origin"), args.base_url):
                responder_json(self, 403, {"ok": False, "error": "origem não permitida"})
                return
            responder_json(self, 200, {"ok": True})

        def do_GET(self) -> None:
            if self.path != "/health":
                responder_json(self, 404, {"ok": False, "error": "rota não encontrada"})
                return
            responder_json(self, 200, {"ok": True, "status": "online"})

        def do_POST(self) -> None:
            if self.path != "/jobs":
                responder_json(self, 404, {"ok": False, "error": "rota não encontrada"})
                return
            if not origem_permitida(self.headers.get("Origin"), args.base_url):
                responder_json(self, 403, {"ok": False, "error": "origem não permitida"})
                return
            if not BRIDGE_LOCK.acquire(blocking=False):
                responder_json(self, 409, {"ok": False, "error": "assistente ocupado"})
                return

            try:
                size = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(size).decode("utf-8")
                payload = json.loads(body or "{}")
                jogos = normalizar_jogos(payload.get("jogos"))
                nome = payload.get("nome") or "job-local"
                thread = threading.Thread(
                    target=processar_jogos_bridge,
                    args=(jogos, args),
                    daemon=True,
                    name=f"lcpro-caixa-{nome}",
                )
                thread.start()
                responder_json(self, 202, {"ok": True, "status": "rodando", "id": "local"})
            except Exception as exc:
                BRIDGE_LOCK.release()
                responder_json(self, 400, {"ok": False, "error": str(exc)})

    return BridgeHandler


def iniciar_bridge(args: argparse.Namespace) -> None:
    server = ThreadingHTTPServer((args.bridge_host, args.bridge_port), criar_bridge_handler(args))
    print(f"Assistente local ouvindo em http://{args.bridge_host}:{args.bridge_port}")
    print("Deixe esta janela aberta e clique em 'Automatizar na Caixa' no LC Pro.")
    try:
        server.serve_forever()
    finally:
        server.server_close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Assistente local LC Pro -> Caixa")
    parser.add_argument("--base-url", default=os.environ.get("LC_PRO_URL", "https://lc-pro-lotofacil.vercel.app"))
    parser.add_argument("--job-id", type=int, help="Processa um job específico")
    parser.add_argument("--watch", action="store_true", help="Fica aguardando jobs pendentes")
    parser.add_argument("--bridge", action="store_true", help="Recebe jogos direto do site em localhost")
    parser.add_argument("--bridge-host", default=os.environ.get("LC_PRO_BRIDGE_HOST", "127.0.0.1"))
    parser.add_argument("--bridge-port", type=int, default=int(os.environ.get("LC_PRO_BRIDGE_PORT", "8725")))
    parser.add_argument("--poll-seconds", type=int, default=8)
    parser.add_argument("--chromedriver", default=os.environ.get("CHROMEDRIVER_PATH"))
    parser.add_argument("--ir-pagamento", action="store_true", help="Avança até a etapa de pagamento, sem pagar")
    parser.add_argument("--keep-open", action="store_true", help="Mantém a janela aberta até Enter")
    args = parser.parse_args()

    print(f"LC Pro: {args.base_url.rstrip('/')}")

    if args.bridge:
        iniciar_bridge(args)
        return 0

    if args.job_id:
        job = buscar_job(args.base_url, args.job_id)
        processar_job(args.base_url, job, args)
        return 0

    while True:
        job = buscar_pendente(args.base_url)
        if job:
            print(f"Job pendente encontrado: #{job['id']} - {job.get('nome', '')}")
            processar_job(args.base_url, job, args)
            if not args.watch:
                return 0
        elif not args.watch:
            print("Nenhum job pendente.")
            return 0
        time.sleep(args.poll_seconds)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nEncerrado pelo usuário.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nErro: {exc}", file=sys.stderr)
        raise SystemExit(1)
