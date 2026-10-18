@echo off
chcp 65001 >nul
echo ============================================
echo  Chuveiro Inteligente - Gerar APK de Teste
echo ============================================
echo.

set "ROOT=%~dp0"
set "JAVA_HOME="
for /f "tokens=*" %%i in ('where java 2^>nul') do set "JAVA_BIN=%%i"

if not defined JAVA_BIN (
    echo [ERRO] Java JDK 17 nao encontrado.
    echo Instale: winget install Microsoft.OpenJDK.17
    pause
    exit /b 1
)

echo [1/4] Sincronizando arquivos web...
powershell -ExecutionPolicy Bypass -File "%ROOT%scripts\sync-assets.ps1"
if errorlevel 1 exit /b 1

echo.
echo [2/4] Lendo versao do APK...
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Select-String -Path '%ROOT%android\app\build.gradle.kts' -Pattern 'versionName\s*=\s*\"([^\"]+)\"').Matches[0].Groups[1].Value.Trim().TrimStart('v','V')"`) do set "APP_VERSION=%%v"
if not defined APP_VERSION (
    echo [ERRO] Nao foi possivel ler versionName em android\app\build.gradle.kts
    pause
    exit /b 1
)
set "APK_NAME=ChuveiroInteligente-v%APP_VERSION%.apk"
echo Versao: %APP_VERSION%
echo Arquivo: %APK_NAME%

echo.
echo [3/4] Verificando Android SDK...
if not exist "%ROOT%android\local.properties" (
    if exist "%LOCALAPPDATA%\Android\Sdk" (
        echo sdk.dir=%LOCALAPPDATA:\=\\%\Android\Sdk> "%ROOT%android\local.properties"
        echo SDK detectado: %LOCALAPPDATA%\Android\Sdk
    ) else if exist "%ROOT%android-sdk" (
        echo sdk.dir=..\\android-sdk> "%ROOT%android\local.properties"
    ) else (
        echo.
        echo [AVISO] Android SDK nao encontrado.
        echo.
        echo Opcao A - Android Studio ^(recomendado^):
        echo   1. Instale Android Studio
        echo   2. Abra a pasta "android"
        echo   3. Build ^> Build Bundle(s^) / APK(s^) ^> Build APK(s^)
        echo   4. APK em: android\app\build\outputs\apk\debug\app-debug.apk
        echo.
        echo Opcao B - GitHub Actions ^(sem instalar nada^):
        echo   1. Suba o projeto no GitHub
        echo   2. Actions ^> Build APK ^> Run workflow
        echo   3. Baixe o artefato "chuveiro-inteligente-apk"
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [4/4] Compilando APK debug...
cd /d "%ROOT%android"
call gradlew.bat assembleDebug --no-daemon

if exist "app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ============================================
    echo  APK gerado com sucesso!
    echo  %ROOT%android\app\build\outputs\apk\debug\app-debug.apk
    echo ============================================
    if not exist "%ROOT%downloads" mkdir "%ROOT%downloads"
    del /Q "%ROOT%downloads\ChuveiroInteligente.apk" 2>nul
    del /Q "%ROOT%downloads\ChuveiroInteligente-v*.apk" 2>nul
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "%ROOT%downloads\%APK_NAME%"
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "%ROOT%%APK_NAME%"
    echo Copia salva em: %ROOT%downloads\%APK_NAME%
    echo Copia salva em: %ROOT%%APK_NAME%
) else (
    echo [ERRO] Falha na compilacao. Use Android Studio.
)

echo.
pause
