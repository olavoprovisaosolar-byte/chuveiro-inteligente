#!/usr/bin/env bash
# Imprime o nome do APK de download com a versão, ex.: ChuveiroInteligente-v1.0.0.apk
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
version="$("$SCRIPT_DIR/apk-version.sh")"
printf 'ChuveiroInteligente-v%s.apk' "$version"
