#!/bin/bash
# Lê as variáveis do arquivo prisma/.env, remove aspas e configura no Vercel
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/prisma/.env"

# Remove aspas simples e duplas dos valores
DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DIRECT_URL=$(grep '^DIRECT_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL não encontrada em prisma/.env"
  exit 1
fi

echo "Removendo variáveis antigas e reconfigurando sem aspas..."

# Remove as antigas (que foram salvas com aspas)
vercel env rm DATABASE_URL production --yes 2>/dev/null || true
vercel env rm DATABASE_URL preview --yes 2>/dev/null || true
vercel env rm DATABASE_URL development --yes 2>/dev/null || true
vercel env rm DIRECT_URL production --yes 2>/dev/null || true
vercel env rm DIRECT_URL preview --yes 2>/dev/null || true
vercel env rm DIRECT_URL development --yes 2>/dev/null || true

# Adiciona sem aspas
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL preview
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL development

if [ -n "$DIRECT_URL" ]; then
  printf '%s' "$DIRECT_URL" | vercel env add DIRECT_URL production
  printf '%s' "$DIRECT_URL" | vercel env add DIRECT_URL preview
  printf '%s' "$DIRECT_URL" | vercel env add DIRECT_URL development
fi

echo "✅ Variáveis configuradas corretamente."
echo "O Vercel vai auto-deployar pelo GitHub automaticamente."
