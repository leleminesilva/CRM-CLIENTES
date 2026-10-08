#!/bin/bash
# Backup SÓ DE LEITURA do banco de produção (pg_dump não altera nada no banco).
# Lê a DIRECT_URL de prisma/.env, sem mostrar a senha na tela.
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(grep -E '^DIRECT_URL=' prisma/.env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
if [ -z "$URL" ]; then echo "DIRECT_URL não encontrada em prisma/.env"; exit 1; fi

DEST="$HOME/Desktop/Backups CRM/producao-$(date +%Y-%m-%d_%H%M).dump"
mkdir -p "$(dirname "$DEST")"

# Só o schema public (dados do CRM). Sem dono/permissões, para restaurar em outro projeto.
/usr/local/opt/libpq/bin/pg_dump "$URL" \
  --schema=public --no-owner --no-privileges --format=custom --file="$DEST"

echo "Backup salvo em: $DEST"
ls -lh "$DEST"
