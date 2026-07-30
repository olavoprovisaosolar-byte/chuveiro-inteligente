# Chuveiro Inteligente

App mobile + ESP32 para controle de chuveiro elétrico com monitoramento de proteção.

## Baixar aplicativo e APK

| Recurso | Link |
|---------|------|
| **Página de download** | [download.html](./download.html) |
| **APK Android** | [downloads/ChuveiroInteligente.apk](./downloads/ChuveiroInteligente.apk) |
| **Última release (GitHub)** | [Releases](https://github.com/olavoprovisaosolar-byte/chuveiro-inteligente/releases/latest) |
| **APK direto (release)** | [ChuveiroInteligente.apk](https://github.com/olavoprovisaosolar-byte/chuveiro-inteligente/releases/latest/download/ChuveiroInteligente.apk) |
| **Aplicativo web** | [index.html](./index.html) |

### Instalar o APK

1. Baixe `ChuveiroInteligente.apk` pelo link acima.
2. No Android, abra o arquivo e permita instalação de fontes desconhecidas se solicitado.
3. Abra o app **Chuveiro Inteligente**.

### Abrir o aplicativo web

Abra `index.html` no navegador (Chrome/Safari) ou sirva a pasta do projeto:

```bash
python3 -m http.server 8080
```

Acesse `http://localhost:8080` e use a página [download.html](http://localhost:8080/download.html) para baixar o APK.

## Desenvolvimento

- Web: `index.html`, `app.js`, `style.css` (cópia offline em `www/`)
- Android: pasta `android/` (WebView)
- Firmware: `esp32_chuveiro.ino`
- Build APK local: `build-apk.bat` (Windows) ou `cd android && ./gradlew assembleDebug`
- CI: GitHub Actions gera o APK e publica uma release em cada push em `master`
