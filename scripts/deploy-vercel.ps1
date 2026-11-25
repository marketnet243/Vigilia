# =========================================================================
# Script de déploiement Vercel pour Vigilia Command Center (PowerShell)
# =========================================================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 Préparation du déploiement Vigilia pour Vercel..." -ForegroundColor Cyan

# Détection du gestionnaire de paquets
$pkg = "npm"
if (Get-Command bun -ErrorAction SilentlyContinue) {
    $pkg = "bun"
}

Write-Host "📦 Installation des dépendances avec $pkg..." -ForegroundColor Cyan
& $pkg install

Write-Host "🛠️ Compilation de l'application pour Vercel..." -ForegroundColor Cyan
$env:NITRO_PRESET = "vercel"
& $pkg run build

Write-Host "🌐 Déploiement sur Vercel..." -ForegroundColor Cyan
if (Get-Command vercel -ErrorAction SilentlyContinue) {
    vercel --prod
} else {
    npx vercel --prod
}

Write-Host "✅ Déploiement terminé avec succès !" -ForegroundColor Green
