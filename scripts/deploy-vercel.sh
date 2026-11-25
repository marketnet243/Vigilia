#!/bin/bash
# =========================================================================
# Script de déploiement Vercel pour Vigilia Command Center
# =========================================================================

set -e

echo "🚀 Préparation du déploiement Vigilia pour Vercel..."

# Vérification de bun ou npm
if command -v bun &> /dev/null; then
  PKG_MGR="bun"
else
  PKG_MGR="npm"
fi

echo "📦 Installation des dépendances via $PKG_MGR..."
$PKG_MGR install

echo "🛠️ Compilation de l'application avec le preset Vercel..."
NITRO_PRESET=vercel $PKG_MGR run build

echo "🌐 Déploiement sur Vercel..."
if command -v vercel &> /dev/null; then
  vercel --prod
else
  npx vercel --prod
fi

echo "✅ Déploiement terminé avec succès !"
