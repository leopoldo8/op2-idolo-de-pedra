# OP2 playtest: "A Maldição do Ídolo de Pedra", Act I

Game-master kit built to run the Ordem Paranormal RPG II playtest (Alpha v1.1), Act I, at home, for 3, 4 or 5 players.
First used on 2026-11-01 with 3 players.

**Portuguese setup guide for game masters: [COMO-USAR.md](COMO-USAR.md).**

The game content (book, character sheets, histories, handouts, maps, music, tokens) belongs to the publisher of Ordem Paranormal RPG II and comes from the public playtest.
This repository only adds GM tools around it.

## What is here

| Path | What it is |
|---|---|
| `folha-do-mestre-idolo-de-pedra-ato-1.md` | GM sheet in pt-BR: what to explain to players, step-by-step progression, locks, hacks, curse, house rules, PD narration lines. |
| `painel-do-mestre/` | Browser GM panel (`index.html` + `app.js`), the players' TV screen (`jogadores.html` + `stage.js`) and the players' phone page (`celular.html`). `mesa.js` decides, for the chosen player count, who is playable, who is a corpse, who is absent, and which text variant applies. |
| `servidor.py` | Local LAN server (port 8765). Serves the panel and the phone page, and holds the phone state in `estado-celular.json`. |
| `iniciar-sessao.bat` (Windows), `iniciar-sessao.command` (macOS) | Start the server. On macOS, `tools/build-sessao-app.sh` also builds `Sessão OP2.app`, which registers the `op2painel://iniciar` URL used by the panel's "start server" button. |
| `impressao/` | Printable handouts. Edit `impressao.html`, then regenerate `material-para-imprimir.pdf` (command below). |
| `handouts-hack-tecnico/`, `tools/make_hack_handouts.py` | Generated images for the technical-hack minigame, plus the answer key. |
| `tools/teste-*.mjs`, `tools/teste-*.cjs` | Test suites (below). |
| `fonte/` | Source material: the book PDF, its extracted text (used to look up rules and page numbers), and the extras zip (gitignored, 93 MB). |

## Running a session

1. Start the server: double-click `iniciar-sessao.bat` (Windows, needs Python 3 on PATH) or `iniciar-sessao.command` (macOS). Without the server, `painel-do-mestre/index.html` still works from disk, minus the players' phone.
2. The panel opens at `http://localhost:8765/index.html`. Open the TV screen from the "Mapa e TV" tab and drag that window to the TV.
3. Players open `http://<LAN IP>:8765/celular.html` on their phones. The page stays on "Celular desligado" until the GM turns it on in the "Celular" tab.
4. Pick 3, 4 or 5 players in the "Jogadores" selector at the top of the panel. With 3, Edgar is already dead on the altar; with 5, Kênia joins.
5. Panel state lives in the browser's localStorage. Use "Nova sessão" to reset it.

## Tests

Stop the session server first: the browser tests start their own on port 8765 and refuse to run if the port is busy.

```
node tools/teste-mesa.cjs
node tools/teste-falas-pd.cjs
node tools/teste-ritmo.mjs
node tools/teste-servidor-painel.mjs
node tools/teste-tela-jogadores.mjs "file://$PWD/painel-do-mestre/index.html"
```

The browser tests drive headless Google Chrome through the DevTools protocol.

## Regenerating the print PDF

```
cd impressao
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer --user-data-dir="$(mktemp -d)" --print-to-pdf="$PWD/material-para-imprimir.pdf" "file://$PWD/impressao.html"
```

## Reusing this for an original adventure

What carries over with little change:
- The TV screen: map image plus draggable character tokens, with alive, unconscious, dead and escaped states (`jogadores.html`, `stage.js`).
- The GM panel skeleton: character cards with PV and PD, round counter, dice roller, sending images to the TV, log and notes, music.
- PD-loss narration lines per character and severity tier (`falas-pd.js`), and three-level hints per sticking point (`dicas.js`).
- The LAN server and the pattern of a GM-controlled page on the players' phones.
- The printable-handout pipeline and the test harness.

What is specific to this adventure and must be rewritten:
- `painel-do-mestre/data.js`: characters, starting positions, locks, steps, curse table, gallery, rules summary. Any text can be a map keyed by player count (`{ 3: "...", 4: "..." }`); `Mesa.pick` takes the largest key not above the chosen count.
- `painel-do-mestre/dicas.js`, `falas-pd.js`: content only; the mechanism is generic.
- `painel-do-mestre/ritmo.js`: house rules for this adventure (Gustavo's body rising, door countdown).
- `servidor.py` and `celular.html`: the content of Gustavo's phone (chats, security questions, unlock pattern, password).
- `app.js`: most tabs are generic, but "Caminho e porta", "Travas", "Hacks" and "Maldição" still contain Act I flows and strings.
- `assets/`, the GM sheet and `impressao/`.

## Known limitations

- The Windows path (`iniciar-sessao.bat`, MIME types, LAN IP detection) was written for Windows but only exercised on macOS with the Windows code path forced.
- Changing the player count mid-session resets Edgar and Kênia to their starting state.
