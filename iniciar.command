#!/bin/bash
# Doble clic en Mac: arranca el servidor y abre el navegador.
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Falta Node.js: instálalo desde https://nodejs.org (botón LTS) y vuelve a abrir."; read -n1; exit 1; }
(sleep 1; open "http://127.0.0.1:3000") &
node server.js
