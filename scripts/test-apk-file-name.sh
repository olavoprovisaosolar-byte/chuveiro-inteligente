#!/usr/bin/env bash
# Teste rápido: nome do APK inclui a versão do Gradle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/apk-version.sh scripts/apk-file-name.sh scripts/sync-apk-download-pages.sh

VERSION="$(bash scripts/apk-version.sh)"
NAME="$(bash scripts/apk-file-name.sh)"
EXPECTED="ChuveiroInteligente-v${VERSION}.apk"

if [[ "$NAME" != "$EXPECTED" ]]; then
  echo "FALHOU: esperado $EXPECTED, obtido $NAME" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "FALHOU: versão inválida $VERSION" >&2
  exit 1
fi

echo "OK: $NAME (versionName=$VERSION)"
