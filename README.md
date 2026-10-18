# Chuveiro Inteligente

App mobile + ESP32 para controle de chuveiro elétrico com monitoramento de proteção.

## Baixar o APK agora

**Arquivo no repositório:** [downloads/ChuveiroInteligente-v1.0.0.apk](./downloads/ChuveiroInteligente-v1.0.0.apk)

**Link direto (GitHub raw):**  
https://github.com/olavoprovisaosolar-byte/chuveiro-inteligente/raw/master/downloads/ChuveiroInteligente-v1.0.0.apk

**Página de download:** [download.html](./download.html)

### Instalar no Android

1. Abra o link no celular e baixe `ChuveiroInteligente-v1.0.0.apk`.
2. Permita instalar apps de fontes desconhecidas, se o Android pedir.
3. Abra o app **Chuveiro Inteligente**.

### Abrir o aplicativo web

```bash
python3 -m http.server 8080
```

Acesse `http://localhost:8080/download.html` para baixar o APK pela página, ou `http://localhost:8080/downloads/ChuveiroInteligente-v1.0.0.apk` para o arquivo direto.

## Desenvolvimento

- Web: `index.html`, `app.js`, `style.css` (cópia offline em `www/`)
- Android: pasta `android/` (WebView)
- Firmware: `esp32_chuveiro.ino`
- Sync assets: `bash scripts/sync-assets.sh`
- Versão do APK: `versionName` em `android/app/build.gradle.kts` (ex.: `1.0.0`)
- Após mudar a versão: `bash scripts/sync-apk-download-pages.sh` (atualiza nome `ChuveiroInteligente-vX.Y.Z.apk` nas páginas)
- Build APK: `bash scripts/apk-file-name.sh` mostra o nome; CI e `build-apk.bat` gravam em `downloads/ChuveiroInteligente-vX.Y.Z.apk`
- CI: GitHub Actions gera o APK versionado e publica release em cada push em `master`