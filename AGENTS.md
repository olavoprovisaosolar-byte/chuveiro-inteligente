# Chuveiro Inteligente

Controlador para um chuveiro elétrico inteligente. O repositório contém três artefatos:

- **Web app** (`index.html`, `app.js`, `style.css`): a aplicação principal. HTML/CSS/JS puro, sem etapa de build e sem dependências a instalar. O `mqtt.js` é carregado via CDN no `index.html` da raiz e está embutido localmente em `www/mqtt.min.js`.
- **Android wrapper** (`android/`): app nativo (Kotlin) que apenas carrega os mesmos assets web num `WebView`. Gera um APK.
- **Firmware ESP32** (`esp32_chuveiro.ino`): sketch Arduino para o microcontrolador (não executável num ambiente de dev comum).

## Cursor Cloud specific instructions

- **Rodar o web app (fluxo principal de dev):** sirva os arquivos estáticos a partir da raiz do repositório, por exemplo `python3 -m http.server 8080`, e abra `http://localhost:8080/index.html`. Não há servidor de dev dedicado nem hot reload — basta recarregar o navegador após editar os arquivos.
- **Modo simulação:** o app inicia em "Modo Simulação" por padrão (checkbox `simulationMode` marcado). Nesse modo a telemetria é gerada localmente e **nenhum broker MQTT/ESP32 é necessário** para testar o fluxo principal (ligar/desligar, slider de potência, monitoramento, proteção, desligamento por temperatura). Para testar MQTT real seria preciso um broker acessível por WebSocket.
- **CDN vs. assets locais:** o `index.html` da raiz busca o `mqtt.js` no unpkg; o `www/index.html` usa `www/mqtt.min.js` local. O modo simulação não usa MQTT, então o app funciona mesmo sem acesso à CDN. As três cópias dos assets (raiz, `www/`, `android/app/src/main/assets/`) são praticamente idênticas — mantenha-as em sincronia ao editar.
- **Lint / testes:** não existem configuração de lint nem suíte de testes automatizados neste repositório (sem `package.json`).
- **Build do APK Android (opcional, pesado):** requer Android SDK (não pré-instalado) + JDK 17. O Gradle wrapper usa Gradle 8.2 e o módulo aponta para `sourceCompatibility/jvmTarget = 17`. O fluxo: copiar os assets (`cp www/index.html www/style.css www/app.js www/mqtt.min.js android/app/src/main/assets/`), criar `android/local.properties` com `sdk.dir=...`, e rodar `./gradlew assembleDebug` em `android/`. O workflow `.github/workflows/build-apk.yml` faz exatamente isso no CI.
- **Idioma:** toda a interface já está em português (pt-BR) — títulos, botões, status, telemetria e onboarding.
