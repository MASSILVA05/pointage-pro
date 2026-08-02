# Pointage Pro

Logiciel de pointage employés multi-organisations (SaaS). PWA-ready React + Vite + Tailwind, Supabase (BDD + Auth + Storage) avec isolation stricte des données par organisation (RLS).

## Démarrage

1. Installer les dépendances :
   ```
   npm install
   ```
2. Créer un projet [Supabase](https://supabase.com), puis exécuter `schema.sql` dans l'éditeur SQL du projet (Database > SQL Editor).
3. Dans **Authentication > Sign In / Providers** (ou **Authentication > Emails** selon la version du dashboard), désactiver **"Confirm email"** : l'app utilise un email interne dérivé du numéro de téléphone (jamais un vrai email), donc aucune confirmation ne peut jamais aboutir si elle est requise.
4. Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings > API).
5. Lancer le serveur de développement :
   ```
   npm run dev
   ```

## Build de production

```
npm run build
```

## Comment fonctionne l'authentification

Supabase Auth n'a pas d'auth téléphone + mot de passe sans fournisseur SMS payant. Pour éviter cette dépendance, l'app dérive un email interne du numéro de téléphone (`src/lib/phone.js`, ex. `213555123456@phone.pointage-pro.internal`), jamais affiché à l'utilisateur — qui ne voit que "téléphone + mot de passe". Le vrai numéro est stocké dans `organizations.owner_phone` / `employees.phone`.

## Structure

- `src/pages/Signup.jsx`, `Login.jsx` — inscription organisation et connexion (patron + employé unifiés)
- `src/pages/Invite.jsx` — un employé pré-enregistré rejoint son organisation via le lien d'invitation
- `src/pages/EmployeePointer.jsx` — vue de pointage (géolocalisation + photo + horodatage)
- `src/pages/dashboard/` — espace patron : tableau de bord, employés, pointages (filtres + export Excel)
- `src/lib/auth.jsx` — contexte d'authentification, garde-fous `RequireOwner` / `RequireEmployee`
- `schema.sql` — tables, triggers de quota/isolation, RLS multi-tenant, bucket storage
