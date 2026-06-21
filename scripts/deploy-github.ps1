# Publica o projeto no GitHub e dispara build do APK via Actions
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "=== Deploy Chuveiro Inteligente para GitHub ===" -ForegroundColor Cyan

# Verificar autenticacao
$authCheck = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] GitHub CLI nao autenticado." -ForegroundColor Red
    Write-Host "Execute: gh auth login -w" -ForegroundColor Yellow
    exit 1
}

$user = gh api user --jq .login
$email = gh api user --jq .email
if (-not $email -or $email -eq "null") {
    $email = "$user@users.noreply.github.com"
}

Write-Host "Conta: $user" -ForegroundColor Green

# Commit (usa env vars, sem alterar git config global)
$env:GIT_AUTHOR_NAME = $user
$env:GIT_COMMITTER_NAME = $user
$env:GIT_AUTHOR_EMAIL = $email
$env:GIT_COMMITTER_EMAIL = $email

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

git add .
$status = git status --porcelain
if ($status) {
    git commit -m "Add chuveiro inteligente web app, ESP32 firmware and Android APK build."
    Write-Host "Commit criado." -ForegroundColor Green
} else {
    Write-Host "Nenhuma alteracao para commitar." -ForegroundColor Yellow
}

# Criar repositorio se nao existir remote
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    $repoName = "chuveiro-inteligente"
    Write-Host "Criando repositorio: $user/$repoName" -ForegroundColor Cyan
    gh repo create $repoName --public --source=. --remote=origin --push --description "Chuveiro Eletrico Inteligente - App Mobile + ESP32"
} else {
    Write-Host "Remote existente: $remote" -ForegroundColor Yellow
    git push -u origin main 2>$null
    if ($LASTEXITCODE -ne 0) { git push -u origin master }
}

# Disparar workflow
Write-Host "Disparando GitHub Actions (Build APK)..." -ForegroundColor Cyan
gh workflow run "Build APK"
Start-Sleep -Seconds 5

# Aguardar conclusao
Write-Host "Aguardando build (pode levar 3-5 min)..." -ForegroundColor Yellow
gh run watch --exit-status

if ($LASTEXITCODE -eq 0) {
    $runId = gh run list --workflow="Build APK" --limit 1 --json databaseId --jq ".[0].databaseId"
    New-Item -ItemType Directory -Force -Path "dist" | Out-Null
    gh run download $runId -n chuveiro-inteligente-apk -D dist
    Write-Host ""
    Write-Host "APK baixado em: $root\dist\app-debug.apk" -ForegroundColor Green
    $repoUrl = gh repo view --json url --jq .url
    Write-Host "Repositorio: $repoUrl" -ForegroundColor Cyan
} else {
    Write-Host "[ERRO] Build falhou. Verifique Actions no GitHub." -ForegroundColor Red
    gh run view --log-failed
    exit 1
}
