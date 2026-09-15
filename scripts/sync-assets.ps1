# Sincroniza arquivos web para o projeto Android
$root = Split-Path -Parent $PSScriptRoot
$www = Join-Path $root "www"
$assets = Join-Path $root "android\app\src\main\assets"

if (-not (Test-Path $www)) {
    Write-Error "Pasta www/ nao encontrada. Execute na raiz do projeto."
    exit 1
}

New-Item -ItemType Directory -Force -Path $assets | Out-Null

# Apenas arquivos do app — nao copiar downloads/ nem APKs
$files = @("index.html", "style.css", "app.js", "mqtt.min.js")
foreach ($f in $files) {
    $src = Join-Path $www $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $assets $f) -Force
    }
}

Write-Host "Assets sincronizados para android/app/src/main/assets/" -ForegroundColor Green
