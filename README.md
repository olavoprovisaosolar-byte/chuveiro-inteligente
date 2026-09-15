# Chuveiro Inteligente

App mobile + ESP32 para controle de chuveiro elétrico com monitoramento de proteção.

## Baixar o APK agora

**Arquivo no repositório:** [downloads/ChuveiroInteligente.apk](./downloads/ChuveiroInteligente.apk)

**Link direto (GitHub raw):**  
https://github.com/olavoprovisaosolar-byte/chuveiro-inteligente/raw/cursor/prepare-apk-download-f825/downloads/ChuveiroInteligente.apk

**Página de download:** [download.html](./download.html)

### Instalar no Android

1. Abra o link no celular e baixe `ChuveiroInteligente.apk`.
2. Permita instalar apps de fontes desconhecidas, se o Android pedir.
3. Abra o app **Chuveiro Inteligente**.

### Abrir o aplicativo web

```bash
python3 -m http.server 8080
```

Acesse `http://localhost:8080/download.html` para baixar o APK pela página, ou `http://localhost:8080/downloads/ChuveiroInteligente.apk` para o arquivo direto.

## Desenvolvimento

- Web: `index.html`, `app.js`, `style.css` (cópia offline em `www/`)
- Android: pasta `android/` (WebView)
- Firmware: `esp32_chuveiro.ino`
- Sync assets: `bash scripts/sync-assets.sh`
- Build APK: `cd android && ./gradlew assembleDebug` → copie para `downloads/ChuveiroInteligente.apk`
- CI: GitHub Actions gera o APK e publica release em cada push em `master`
