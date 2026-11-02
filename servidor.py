#!/usr/bin/env python3
"""Local server for the GM panel and the in-game phone page.

The GM panel and its assets are served only to this machine. Other devices on
the network can reach only the phone page and the phone API, so players never
see answers or the GM screen.
"""

import json
import re
import socket
import subprocess
import sys
import threading
import time
import unicodedata
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
ROOT = BASE / "painel-do-mestre"
STATE_FILE = BASE / "estado-celular.json"
PORT = 8765
MAX_BODY_BYTES = 10_000
PUBLIC_PATHS = {"/celular.html"}
PUBLIC_PREFIXES = ("/assets/fichas-mapa/",)
TWO_FACTOR_CODE = "482 917"
PATTERN = [2, 1, 0, 3, 6, 7, 8]
PATTERN_TRIES = 3
PATTERN_LOCK_SECONDS = 30
PASSWORD_TRIES = 5
PASSWORD_LOCK_SECONDS = 30

MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}

QUESTIONS = [
    {"label": "Nome completo", "prompt": "Qual é o seu nome completo?", "kind": "fullname"},
    {"label": "Aniversário do Gustavo", "prompt": "Qual é a sua data de nascimento?", "kind": "date", "date": (7, 6, 1978)},
    {"label": "Data de casamento", "prompt": "Qual é a data do seu casamento?", "kind": "date", "date": (10, 8, 1997)},
    {"label": "Nascimento da filha", "prompt": "Qual é a data de nascimento da sua filha?", "kind": "date", "date": (2, 9, 2015)},
    {"label": "Nome da esposa", "prompt": "Qual é o nome da sua esposa?", "kind": "names", "names": {"olivia"}},
    {"label": "Nome da filha", "prompt": "Qual é o nome da sua filha?", "kind": "names", "names": {"laura", "laurinha"}},
]

CHATS = [
    {
        "id": "victor", "title": "Victor", "subtitle": "visto por último 18:03", "day": "Hoje", "unread": 1,
        "messages": [
            ["me", "Você estava certo, o Alan me fez uma proposta completamente maluca.", "13:38"],
            ["me", "Eu acho que tudo isso tá mexendo com a cabeça dele.", "13:39"],
            ["me", "Não sei o que fazer, ele ta aqui.", "13:43"],
            ["me", "Acho que você não deveria vir", "13:47"],
            ["me", "Ele quer realizar o ritual de novo mas fazendo algo ainda pior dessa vez", "13:47"],
            ["them", "Se precisar, eu tenho uma maneira de impedir ele de fazer isso.", "13:54"],
            ["them", "Preciso buscar algumas coisas e vou´chegar aí mais tarde, mas vou preparado para caso a gente precise fazer o necessário.", "13:55"],
            ["them", "Da um jeito de prender ele", "13:59"],
            ["them", "Daqui a pouco eu to aí", "16:13"],
            ["them", "Gustavo?", "16:45"],
        ],
    },
    {
        "id": "alan", "title": "Alan", "subtitle": "visto por último 13:04", "day": "Hoje", "unread": 0,
        "messages": [
            ["them", "Gustavo, você tá sozinho?", "12:50"],
            ["them", "eu reli os textos. eu tinha entendido uma coisa errado.", "12:50"],
            ["them", "o ritual nunca foi um milagre, ele é uma troca. as pessoas eram SACRIFICADAS para que líderes pudessem viver em seu lugar.", "12:52"],
            ["them", "entre todos que fizeram o ritual, apenas dois podem viver, Gustavo.", "12:52"],
            ["them", "e a hora de pagar a dívida tá chegando.", "12:53"],
            ["me", "Que conversa é essa alan?", "12:55"],
            ["me", "Que divida? O que vai acontecer?", "12:55"],
            ["them", "eu te explico melhor em pessoa, eu vou chegar mais cedo que os outros", "12:56"],
            ["them", "aquelas grades do seu depósito ainda estão lá?", "12:57"],
            ["me", "Alan, no que voce ta pensando...", "12:59"],
        ],
    },
    {
        "id": "reuniao", "title": "Reunião", "subtitle": "Alan, Eloísa, Eu, Kênia, Edgar, Victor", "day": "11 de outubro de 2022", "unread": 0, "group": True,
        "messages": [
            ["Alan", "pessoal, só confirmando a reunião depois de amanhã no porão do Gustavo.", "18:20"],
            ["Alan", "eu acho que tenho a resposta para resolver os problemas que temos passado", "18:21"],
            ["Alan", "precisamos estar todos juntos", "18:21"],
            ["me", "Nem a Olívia nem a Laurinha vão estar, então o timing é ótimo.", "18:30"],
            ["me", "Lembrando que eu instalei a tranca elétrica", "18:33"],
            ["me", "A senha da porta é a data que nenhum de nós conseguiria esquecer.", "18:34"],
            ["me", "O dia em que tudo mudou.", "18:34"],
        ],
    },
]


def fresh_state():
    return {
        "enabled": False,
        "hint": False,
        "acceptWeddingPassword": False,
        "questions": [2, 3, 4, 5],
        "intuition": None,
        "answered": [],
        "errors": 0,
        "lockout": False,
        "unlocked": False,
        "unlockedBy": "",
        "passwordTries": 0,
        "passwordLockUntil": 0,
        "fallback": False,
        "fallbackClarity": 1,
        "patternTries": 0,
        "patternLockUntil": 0,
        "flashlight": False,
        "door": {"open": False, "lockedUntil": None, "errors": 0, "message": "", "powered": True, "opensIn": None},
        "doorQueue": [],
        "doorSeq": 0,
        "events": [],
    }


LOCK = threading.Lock()


def load_state():
    try:
        saved = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return {**fresh_state(), **saved}
    except FileNotFoundError:
        return fresh_state()
    except (OSError, ValueError) as err:
        print(f"Estado do celular ilegível, começando do zero ({err}).", file=sys.stderr)
        return fresh_state()


STATE = load_state()


def save_state():
    try:
        STATE_FILE.write_text(json.dumps(STATE, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError as err:
        print(f"Não foi possível salvar o estado do celular: {err}", file=sys.stderr)


def add_event(text):
    STATE["events"] = ([{"ts": time.time(), "text": text}] + STATE["events"])[:200]


def normalize(text):
    decomposed = unicodedata.normalize("NFKD", str(text))
    plain = "".join(c for c in decomposed if not unicodedata.combining(c)).lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", plain).split())


def parse_date(text):
    t = normalize(text)
    for name, number in MONTHS.items():
        t = re.sub(rf"\b{name}\b", f" {number} ", t)
    t = re.sub(r"\bde\b", " ", t)
    parts = t.split()
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        day, month, year = (int(p) for p in parts)
    else:
        digits = re.sub(r"\D", "", t)
        if len(digits) == 8:
            day, month, year = int(digits[:2]), int(digits[2:4]), int(digits[4:])
        elif len(digits) == 6:
            day, month, year = int(digits[:2]), int(digits[2:4]), int(digits[4:])
        else:
            return None
    if year < 100:
        year += 2000 if year <= 30 else 1900
    return (day, month, year)


def check_answer(question, text):
    if question["kind"] == "date":
        return parse_date(text) == question["date"]
    tokens = [t for t in normalize(text).split() if t not in {"de", "da", "do", "dos", "das"}]
    if question["kind"] == "fullname":
        return tokens == ["gustavo", "alves", "campos"]
    return any(t in question["names"] for t in tokens)


def allowed_errors():
    result = STATE["intuition"]
    if result is None or result < 7:
        return None
    return (result - 7) // 3


def unlock(by):
    STATE["unlocked"] = True
    STATE["unlockedBy"] = by
    STATE["lockout"] = False
    add_event(f"Celular desbloqueado ({by}).")


def phone_view():
    now = time.time()
    view = {
        "enabled": STATE["enabled"],
        "hint": STATE["hint"],
        "unlocked": STATE["unlocked"],
        "lockout": STATE["lockout"],
        "fallback": STATE["fallback"],
        "flashlight": STATE["flashlight"],
        "passwordLockLeft": max(0, round(STATE["passwordLockUntil"] - now)),
        "patternLockLeft": max(0, round(STATE["patternLockUntil"] - now)),
        "door": STATE["door"],
        "doorPending": [item["id"] for item in STATE["doorQueue"]],
        "recovery": None,
    }
    if STATE["fallback"] and not STATE["unlocked"]:
        view["smudge"] = {"path": PATTERN, "clarity": STATE["fallbackClarity"]}
    if not STATE["unlocked"]:
        allowed = allowed_errors()
        pending = [i for i in STATE["questions"] if i not in STATE["answered"]]
        view["recovery"] = {
            "waiting": STATE["intuition"] is None,
            "failedTest": STATE["intuition"] is not None and STATE["intuition"] < 7,
            "errorsLeft": None if allowed is None else max(0, allowed - STATE["errors"]),
            "total": len(STATE["questions"]),
            "done": len(STATE["answered"]),
            "current": None if not pending else {"id": pending[0], "prompt": QUESTIONS[pending[0]]["prompt"]},
        }
    else:
        view["content"] = {"chats": CHATS, "twoFactor": TWO_FACTOR_CODE}
    return view


def gm_view(host_ip):
    return {
        "phoneUrl": f"http://{host_ip}:{PORT}/celular.html",
        "state": {k: v for k, v in STATE.items() if k not in {"doorQueue"}},
        "allowedErrors": allowed_errors(),
        "questions": [{"label": q["label"], "prompt": q["prompt"]} for q in QUESTIONS],
        "doorQueue": STATE["doorQueue"],
        "twoFactor": TWO_FACTOR_CODE,
    }


def phone_action(body):
    action = body.get("action")
    if not STATE["enabled"]:
        return {"ok": False, "message": ""}
    now = time.time()
    if action == "password":
        if STATE["unlocked"]:
            return {"ok": True}
        if now < STATE["passwordLockUntil"]:
            return {"ok": False, "message": "Aguarde para tentar de novo."}
        text = str(body.get("text", ""))[:60]
        if STATE["acceptWeddingPassword"] and parse_date(text) == (10, 8, 1997):
            add_event(f"Senha digitada: \"{text}\" (certa).")
            unlock("senha")
            return {"ok": True}
        STATE["passwordTries"] += 1
        add_event(f"Senha errada digitada: \"{text}\".")
        if STATE["passwordTries"] >= PASSWORD_TRIES:
            STATE["passwordTries"] = 0
            STATE["passwordLockUntil"] = now + PASSWORD_LOCK_SECONDS
            return {"ok": False, "message": f"Muitas tentativas. Tente de novo em {PASSWORD_LOCK_SECONDS} segundos."}
        return {"ok": False, "message": "Senha incorreta."}
    if action == "answer":
        if STATE["unlocked"] or STATE["lockout"]:
            return {"ok": False}
        allowed = allowed_errors()
        if allowed is None:
            return {"ok": False, "message": "Não foi possível verificar sua identidade."}
        qid = body.get("id")
        if qid not in STATE["questions"] or qid in STATE["answered"]:
            return {"ok": False}
        text = str(body.get("text", ""))[:80]
        question = QUESTIONS[qid]
        if check_answer(question, text):
            STATE["answered"].append(qid)
            add_event(f"Resposta certa em \"{question['label']}\": \"{text}\".")
            if len(STATE["answered"]) >= len(STATE["questions"]):
                unlock("perguntas de segurança")
            return {"ok": True, "correct": True}
        STATE["errors"] += 1
        add_event(f"Resposta errada em \"{question['label']}\": \"{text}\".")
        if STATE["errors"] > allowed:
            STATE["lockout"] = True
            add_event("Celular bloqueou: errou mais do que podia.")
        return {"ok": True, "correct": False}
    if action == "pattern":
        if STATE["unlocked"] or not STATE["fallback"]:
            return {"ok": False}
        if now < STATE["patternLockUntil"]:
            return {"ok": False, "message": "Aguarde para tentar de novo."}
        seq = body.get("seq")
        if seq == PATTERN:
            add_event("Padrão desenhado certo.")
            unlock("padrão desenhado")
            return {"ok": True, "correct": True}
        STATE["patternTries"] += 1
        add_event(f"Padrão errado ({STATE['patternTries']} de {PATTERN_TRIES}).")
        if STATE["patternTries"] >= PATTERN_TRIES:
            STATE["patternTries"] = 0
            STATE["patternLockUntil"] = now + PATTERN_LOCK_SECONDS
        return {"ok": True, "correct": False}
    if action == "door":
        if not STATE["unlocked"]:
            return {"ok": False}
        code = re.sub(r"\D", "", str(body.get("code", "")))[:6]
        STATE["doorSeq"] += 1
        item = {"id": STATE["doorSeq"], "code": code}
        STATE["doorQueue"].append(item)
        add_event(f"TRANCATRON: tentou a senha {code}.")
        return {"ok": True, "id": item["id"]}
    if action == "open":
        what = str(body.get("what", ""))[:40]
        add_event(f"Abriu: {what}.")
        return {"ok": True}
    if action == "flashlight":
        STATE["flashlight"] = bool(body.get("on"))
        add_event("Lanterna ligada." if STATE["flashlight"] else "Lanterna desligada.")
        return {"ok": True}
    return {"ok": False}


def gm_action(body):
    action = body.get("action")
    value = body.get("value")
    if action == "sync":
        door = body.get("door") or {}
        STATE["door"] = {
            "open": bool(door.get("open")),
            "lockedUntil": door.get("lockedUntil"),
            "errors": int(door.get("errors") or 0),
            "message": str(door.get("message") or "")[:200],
            "powered": bool(door.get("powered", True)),
            "opensIn": door.get("opensIn") if isinstance(door.get("opensIn"), int) else None,
        }
        acked = set(body.get("ack") or [])
        STATE["doorQueue"] = [item for item in STATE["doorQueue"] if item["id"] not in acked]
        return
    if action == "enable":
        STATE["enabled"] = bool(value)
        add_event("Celular ligado para os jogadores." if value else "Celular desligado.")
    elif action == "hint":
        STATE["hint"] = bool(value)
        add_event("Dica \"Prata = 25\" liberada." if value else "Dica escondida.")
    elif action == "wedding-password":
        STATE["acceptWeddingPassword"] = bool(value)
    elif action == "questions":
        chosen = [i for i in value if isinstance(i, int) and 0 <= i < len(QUESTIONS)]
        STATE["questions"] = chosen
        STATE["answered"] = [i for i in STATE["answered"] if i in chosen]
    elif action == "intuition":
        STATE["intuition"] = None if value in (None, "") else int(value)
        STATE["errors"] = 0
        STATE["answered"] = []
        STATE["lockout"] = STATE["intuition"] is not None and STATE["intuition"] < 7
        add_event(f"Teste de Intuição: {STATE['intuition']}." if STATE["intuition"] is not None else "Teste de Intuição apagado.")
    elif action == "release":
        STATE["intuition"] = None
        STATE["errors"] = 0
        STATE["answered"] = []
        STATE["lockout"] = False
        STATE["patternLockUntil"] = 0
        STATE["passwordLockUntil"] = 0
        add_event("Nova tentativa liberada (precisa de outro teste de Intuição).")
    elif action == "unlock":
        unlock("liberado pelo mestre")
    elif action == "relock":
        STATE["unlocked"] = False
        STATE["unlockedBy"] = ""
        STATE["answered"] = []
        STATE["errors"] = 0
        STATE["intuition"] = None
        STATE["lockout"] = False
        add_event("Celular bloqueado de novo pelo mestre.")
    elif action == "fallback":
        STATE["fallback"] = bool(value)
        add_event("Plano B (desenho na tela) liberado." if value else "Plano B escondido.")
    elif action == "clarity":
        STATE["fallbackClarity"] = 2 if value == 2 else 1
    elif action == "reset":
        STATE.clear()
        STATE.update(fresh_state())
        add_event("Celular zerado.")


def wifi_ip():
    if sys.platform != "darwin":
        return None
    for interface in ("en0", "en1"):
        try:
            out = subprocess.run(["ipconfig", "getifaddr", interface], capture_output=True, text=True, timeout=3)
        except (OSError, subprocess.TimeoutExpired):
            continue
        ip = out.stdout.strip()
        if out.returncode == 0 and ip:
            return ip
    return None


def lan_ip():
    found = wifi_ip()
    if found:
        return found
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


HOST_IP = lan_ip()


class Handler(SimpleHTTPRequestHandler):
    # Windows reads MIME types from the registry, which can map .js to text/plain.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".mp3": "audio/mpeg",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        return

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def is_local(self):
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY_BYTES:
            raise ValueError("body too large")
        raw = self.rfile.read(length) if length else b"{}"
        data = json.loads(raw.decode("utf-8") or "{}")
        if not isinstance(data, dict):
            raise ValueError("body must be an object")
        return data

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/index.html" if self.is_local() else "/celular.html")
            self.end_headers()
            return
        if path == "/api/phone":
            with LOCK:
                self.send_json(phone_view())
            return
        if path == "/api/gm":
            if not self.is_local():
                self.send_error(403)
                return
            with LOCK:
                self.send_json(gm_view(HOST_IP))
            return
        if not self.is_local() and path not in PUBLIC_PATHS and not path.startswith(PUBLIC_PREFIXES):
            self.send_error(403)
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self.read_json()
        except (ValueError, UnicodeDecodeError):
            self.send_json({"ok": False, "message": "Pedido inválido."}, 400)
            return
        if path == "/api/phone":
            with LOCK:
                result = phone_action(body)
                save_state()
            self.send_json(result)
            return
        if path == "/api/gm":
            if not self.is_local():
                self.send_error(403)
                return
            if body.get("action") == "shutdown":
                self.send_json({"ok": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            with LOCK:
                try:
                    gm_action(body)
                except (TypeError, ValueError) as err:
                    self.send_json({"ok": False, "message": str(err)}, 400)
                    return
                save_state()
                self.send_json(gm_view(HOST_IP))
            return
        self.send_error(404)


def open_panel(url):
    if sys.platform != "darwin":
        webbrowser.open(url)
        return
    try:
        subprocess.run(["open", "-a", "Google Chrome", url], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        webbrowser.open(url)


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    panel_url = f"http://localhost:{PORT}/index.html"
    open_browser = "--no-browser" not in sys.argv
    try:
        server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    except OSError:
        print(f"  A porta {PORT} já está em uso: o servidor da sessão provavelmente já está ligado.")
        print(f"  Painel do mestre: {panel_url}")
        if open_browser:
            open_panel(panel_url)
        return
    print("")
    print("  O Ídolo de Pedra: servidor da sessão ligado.")
    print(f"  Painel do mestre (só neste notebook): {panel_url}")
    print(f"  Link do celular para os jogadores:    http://{HOST_IP}:{PORT}/celular.html")
    print("  Para desligar: botão \"Desligar servidor\" no painel, ou Ctrl+C nesta janela.")
    print("")
    if open_browser:
        threading.Timer(0.8, open_panel, args=(panel_url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
