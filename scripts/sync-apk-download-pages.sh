#!/usr/bin/env bash
# Atualiza links/páginas de download para o APK ChuveiroInteligente-vX.Y.Z.apk
# Fonte da versão: android/app/build.gradle.kts (versionName).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$("$ROOT/scripts/apk-version.sh")"
APK_NAME="$("$ROOT/scripts/apk-file-name.sh")"
REPO="olavoprovisaosolar-byte/chuveiro-inteligente"
# Branch padrão para links GitHub raw (override com APK_DOWNLOAD_BRANCH=...)
BRANCH="${APK_DOWNLOAD_BRANCH:-master}"
RAW_URL="https://github.com/${REPO}/raw/${BRANCH}/downloads/${APK_NAME}"
RELEASE_TAG="chuveiro-v${VERSION}"

replace_in_file() {
  local file="$1"
  local content
  content="$(cat "$file")"

  # Nome versionado (com ou sem sufixo antigo sem versão)
  content="$(printf '%s' "$content" | sed -E \
    -e "s|ChuveiroInteligente(-v[0-9]+\.[0-9]+\.[0-9]+)?\.apk|${APK_NAME}|g")"

  # Content-Disposition no Netlify
  content="$(printf '%s' "$content" | sed -E \
    -e "s|filename=\"ChuveiroInteligente(-v[0-9]+\.[0-9]+\.[0-9]+)?\.apk\"|filename=\"${APK_NAME}\"|g")"

  # Meta "Versão" na página de download
  content="$(printf '%s' "$content" | sed -E \
    -e "s|(<li><span>Versão</span> <strong>)[^<]*(</strong></li>)|\1${VERSION} (debug)\2|")"

  # Links raw do GitHub (branch pode ter barra, ex. cursor/nome-xxx)
  content="$(printf '%s' "$content" | sed -E \
    -e "s|https://github\.com/${REPO}/raw/.+/downloads/${APK_NAME}|${RAW_URL}|g")"

  printf '%s' "$content" > "$file"
}

FILES=(
  README.md
  download.html
  www/download.html
  index.html
  www/index.html
  android/app/src/main/assets/index.html
  netlify.toml
)

for f in "${FILES[@]}"; do
  if [[ -f "$ROOT/$f" ]]; then
    replace_in_file "$ROOT/$f"
  fi
done

printf '%s\n' "$APK_NAME"
printf '%s\n' "$RAW_URL"
printf 'tag %s\n' "$RELEASE_TAG"
