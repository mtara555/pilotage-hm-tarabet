# Pilotage Hypermarché — Architecture Modulaire

## 🔐 Déploiement sécurisé (GitHub Actions)

Les clés Supabase ne sont **jamais** dans le code source.
Elles sont stockées dans GitHub Secrets et injectées automatiquement au déploiement.

### Secrets à configurer dans GitHub
(Settings → Secrets and variables → Actions → New repository secret)

| Nom | Description |
|---|---|
| `SUPABASE_URL` | URL de ton projet Supabase |
| `SUPABASE_ANON_KEY` | Clé publique anon Supabase |
| `APP_SECRET` | Secret RLS choisi |

### Déploiement automatique
Chaque `git push` sur `main` déclenche automatiquement :
1. Injection des secrets dans `src/services/supabase.js`
2. Déploiement sur GitHub Pages (branche `gh-pages`)

### Activer GitHub Pages
Settings → Pages → Source : **Deploy from a branch** → Branch : **gh-pages**

---

## Structure

```
.github/
 └── workflows/
     └── deploy.yml       Workflow déploiement automatique
src/
 ├── services/supabase.js Connexion Supabase (placeholders %%...%%)
 ├── auth/index.js        Authentification locale
 ├── tasks/index.js       Gestion des tâches
 ├── tasks/ui.js          Rendu UI tâches
 ├── dashboard/index.js   Tableau de bord
 ├── users/index.js       Utilisateurs (CRUD)
 ├── users/ui.js          Modals utilisateurs
 ├── settings/index.js    Paramètres société
 ├── exports/index.js     Export PDF
 ├── exports/results.js   Résultats historiques
 ├── realtime/index.js    Supabase Realtime
 ├── notifications/index.js Notifications PWA
 ├── permanence/index.js  Module Permanences
 └── app.js               Point d'entrée
index.html                App principale
manifest.json             PWA manifest
service-worker.js         Cache PWA
```

## Tables Supabase

```sql
hm_app_data    -- Données générales (clé/valeur)
hm_completions -- Completions par utilisateur
hm_events      -- Événements live admin
```

## Sécurité

- ✅ Clés jamais dans le code source (GitHub Secrets)
- ✅ RLS activé sur les 3 tables
- ✅ Header x-app-secret vérifié par Supabase
- ✅ .gitignore protège les fichiers sensibles
