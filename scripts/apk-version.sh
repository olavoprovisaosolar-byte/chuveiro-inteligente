#!/usr/bin/env bash
# Lê versionName do Android (fonte da verdade da versão do APK).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$ROOT/android/app/build.gradle.kts"

if [[ ! -f "$GRADLE" ]]; then
  echo "Arquivo não encontrado: $GRADLE" >&2
  exit 1
fi

version="$(grep -E '[[:space:]]*versionName[[:space:]]*=' "$GRADLE" | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')"
version="${version#v}"
version="${version#V}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Versão inválida em build.gradle.kts: ${version:-<vazia>}" >&2
  exit 1
fi

printf '%s' "$version"
