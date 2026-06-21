# Sincroniza arquivos web para o projeto Android
$root = Split-Path -Parent $PSScriptRoot
$www = Join-Path $root "www"
$assets = Join-Path $root "android\app\src\main\assets"

if (-not (Test-Path $www)) {
    Write-Error "Pasta www/ nao encontrada. Execute na raiz do projeto."
    exit 1
}

New-Item -ItemType Directory -Force -Path $assets | Out-Null
Copy-Item (Join-Path $www "*") $assets -Force

Write-Host "Assets sincronizados para android/app/src/main/assets/" -ForegroundColor Green
