# Déploiement sur Vercel — Vigilia Command Center

Ce guide explique comment déployer Vigilia Command Center sur [Vercel](https://vercel.com).

---

## 1. Déploiement automatique depuis GitHub

1. Poussez votre code sur votre dépôt GitHub : `https://github.com/marketnet243/Vigilia.git`.
2. Connectez-vous sur votre compte [Vercel Dashboard](https://vercel.com/new).
3. Cliquez sur **Import** en sélectionnant le dépôt `marketnet243/Vigilia`.
4. Vercel détecte automatiquement la configuration grâce à [vercel.json](file:///l:/PRODUCTION/PROJECT_NET/PROJET/VIGILIA/vercel.json) :
   - **Framework Preset** : `Other` ou `TanStack Start`
   - **Build Command** : `NITRO_PRESET=vercel vite build`
   - **Output Directory** : `.vercel/output`

---

## 2. Variables d'environnement obligatoires sur Vercel

Dans **Project Settings → Environment Variables** sur Vercel, ajoutez ces variables pour tous les environnements (Production, Preview, Development) :

| Variable | Description | Exemple |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de l'API Supabase | `https://gqttqjehlfeodocofytp.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publishable / anon Supabase | `sb_publishable_...` |
| `SUPABASE_URL` | Identique à VITE_SUPABASE_URL (pour le SSR) | `https://gqttqjehlfeodocofytp.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Identique à VITE_SUPABASE_PUBLISHABLE_KEY | `sb_publishable_...` |

---

## 3. Déploiement direct via CLI

Si vous avez installé la CLI Vercel (`npm i -g vercel`), vous pouvez utiliser les scripts prêts à l'emploi :

- **Linux / macOS** :
  ```bash
  chmod +x scripts/deploy-vercel.sh
  ./scripts/deploy-vercel.sh
  ```

- **Windows (PowerShell)** :
  ```powershell
  .\scripts\deploy-vercel.ps1
  ```
