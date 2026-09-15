#!/usr/bin/env bash
# Sincroniza arquivos web para o projeto Android (assets do WebView)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$ROOT/www"
ASSETS="$ROOT/android/app/src/main/assets"

if [[ ! -d "$WWW" ]]; then
  echo "Pasta www/ nao encontrada. Execute na raiz do projeto." >&2
  exit 1
fi

mkdir -p "$ASSETS"
# Apenas os arquivos do app — nao copiar downloads/ nem APKs
for f in index.html style.css app.js mqtt.min.js; do
  if [[ -f "$WWW/$f" ]]; then
    cp -f "$WWW/$f" "$ASSETS/$f"
  fi
done

echo "Assets sincronizados para android/app/src/main/assets/"
