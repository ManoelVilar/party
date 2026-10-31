#!/usr/bin/env bash
# Roda a verificação do build, os testes de fumaça e o replay do cliente contra as regras do Firebase. Uso: bash tests/run.sh [--all]
#   --all  também executa os cenários longos (WebRTC, portas, gatos...) que só imprimem observações.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node scripts/build.mjs --check
node scripts/gera-regras.mjs --check
node tests/rules/rules.test.cjs
node tests/rules/acesso.test.cjs
node tests/rules/agente.test.cjs
node tests/rules/claude-agente.test.cjs
node tests/limpeza.test.mjs
PORT=8765
if ! curl -s -o /dev/null "localhost:$PORT"; then
  (python3 -m http.server $PORT >/dev/null 2>&1 & echo $! > /tmp/party-http.pid); sleep 1; STARTED=1
fi
cleanup() { [ "${STARTED:-0}" = 1 ] && kill "$(cat /tmp/party-http.pid)" 2>/dev/null || true; }
trap cleanup EXIT
cd tests/e2e
python3 smoke.py
python3 jogos.py
python3 gatos.py
python3 jukebox.py
python3 turn.py
python3 meet.py
python3 chat.py
python3 fluidez.py
python3 reconectar.py
python3 posicao.py
python3 contas.py
# grava as escritas reais do cliente e confere contra as regras do Firebase
python3 record_ops.py
(cd "$ROOT" && node tests/rules/replay.cjs)
if [ "${1:-}" = "--all" ]; then
  for t in door2 cat3 own vid1 rtc4 mix; do echo; echo "== cenário $t (observacional)"; python3 $t.py; done
fi
