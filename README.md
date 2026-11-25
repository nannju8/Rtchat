# 💬 Discussions de groupe en temps réel

Application de messagerie de groupe : **React + Vite + Tailwind CSS** côté frontend (hébergé sur **Netlify**), **Supabase** pour tout le backend (Auth, PostgreSQL + RLS, Realtime). Aucun serveur personnalisé.

Seuls les utilisateurs inscrits et connectés peuvent voir les groupes et les messages. Un visiteur non connecté ne voit que l'écran de connexion / inscription, et la base de données refuse de toute façon tout accès au rôle `anon` (Row Level Security).

## Arborescence

```
.
├── .env.example                  # Modèle des variables d'environnement
├── .gitignore
├── index.html
├── netlify.toml                  # Build + routage SPA + en-têtes de sécurité
├── package.json
├── supabase/
│   └── schema.sql                # Script SQL complet à exécuter dans Supabase
└── src/
    ├── main.tsx
    ├── App.tsx                   # Garde d'accès : connecté → chat, sinon → connexion
    ├── index.css
    ├── types.ts
    ├── vite-env.d.ts
    ├── lib/
    │   ├── supabase.ts           # Client Supabase (URL + clé anon uniquement)
    │   ├── errors.ts             # Messages d'erreur en français
    │   └── format.ts             # Dates, couleurs d'avatar
    ├── context/
    │   └── AuthContext.tsx       # Session, connexion, inscription, déconnexion
    ├── hooks/
    │   ├── useGroups.ts          # Liste + création de groupes (+ temps réel)
    │   └── useMessages.ts        # Historique, temps réel INSERT/DELETE, envoi, suppression
    └── components/
        ├── AuthScreen.tsx        # Connexion / Inscription
        ├── SetupScreen.tsx       # Aide si les variables d'environnement manquent
        ├── Sidebar.tsx           # Liste des groupes, nouveau groupe, déconnexion
        ├── CreateGroupModal.tsx
        ├── ChatArea.tsx          # Messages, auto-scroll, suppression
        ├── MessageInput.tsx      # Saisie (Entrée = envoyer, anti double envoi)
        ├── Avatar.tsx
        └── Icons.tsx
```

## 1. Configurer Supabase

1. Créez un compte sur <https://supabase.com> puis cliquez sur **New project** (choisissez un nom, un mot de passe de base de données et une région proche de vos utilisateurs). Attendez la fin de l'initialisation.
2. **Lancer le SQL** : menu de gauche **SQL Editor** → **New query** → copiez-collez tout le contenu de `supabase/schema.sql` → **Run**. Vous devez voir « Success. No rows returned ».
   Le script crée les tables, le trigger de création de profil, les politiques RLS, active le Realtime et crée le groupe « Général ». Il peut être relancé sans danger.
3. **Récupérer les clés** : **Project Settings** (engrenage) → **API** (ou **API Keys**) :
   - **Project URL** → valeur de `VITE_SUPABASE_URL`
   - clé **anon / public** → valeur de `VITE_SUPABASE_ANON_KEY`

   ⚠️ N'utilisez **jamais** la clé `service_role` dans le frontend.
4. **Confirmation par email** : **Authentication** → **Sign In / Providers** (ou **Providers → Email**) → option **Confirm email** :
   - **Désactivée** : l'utilisateur est connecté immédiatement après l'inscription (pratique pour les tests).
   - **Activée** : l'utilisateur reçoit un email et doit cliquer sur le lien avant de se connecter. L'application affiche alors « Vérifiez vos emails ».
5. **URL du site** (important si la confirmation par email est activée) : **Authentication** → **URL Configuration** → renseignez **Site URL** avec l'adresse Netlify (ex. `https://mon-chat.netlify.app`) une fois le site déployé. Pour les tests locaux, ajoutez `http://localhost:5173` dans **Redirect URLs**.
6. Vérification Realtime : **Database** → **Publications** → `supabase_realtime` doit contenir les tables `messages` et `groups`.

## 2. Tester en local

```bash
npm install
cp .env.example .env      # puis éditez .env avec vos deux valeurs
npm run dev
```

Ouvrez <http://localhost:5173>. Pour tester le temps réel : ouvrez deux navigateurs (ou une fenêtre de navigation privée), créez deux comptes différents, puis écrivez dans « Général ».

Build de production : `npm run build` (le résultat est dans `dist/`), aperçu : `npm run preview`.

## 3. GitHub puis Netlify

### Mettre le code sur GitHub

```bash
git init
git add .
git commit -m "Messagerie de groupe temps réel"
git branch -M main
git remote add origin https://github.com/VOTRE-UTILISATEUR/VOTRE-DEPOT.git
git push -u origin main
```

Le fichier `.env` est dans `.gitignore` : vos variables ne sont pas publiées.

### Déployer sur Netlify

1. Sur <https://app.netlify.com> : **Add new site** → **Import an existing project** → **GitHub** → choisissez votre dépôt.
2. Les réglages de build sont lus depuis `netlify.toml` (commande `npm run build`, dossier `dist`).
3. Avant de déployer, ouvrez **Site configuration → Environment variables** (ou **Add environment variables** sur l'écran de création) et ajoutez :
   - `VITE_SUPABASE_URL` = l'URL de votre projet Supabase
   - `VITE_SUPABASE_ANON_KEY` = la clé anon
4. Cliquez sur **Deploy**. Si vous ajoutez les variables après coup, relancez un déploiement (**Deploys → Trigger deploy → Clear cache and deploy site**), car Vite les intègre au moment du build.
5. Copiez l'URL Netlify obtenue dans Supabase → **Authentication → URL Configuration → Site URL** (étape 1.5).

## Sécurité — résumé

- RLS activé (et forcé) sur `profiles`, `groups`, `messages`. Aucun privilège pour `anon` sur les tables.
- Lecture réservée au rôle `authenticated` ; insertion de groupe seulement si `auth.uid() = created_by` ; insertion de message seulement si `auth.uid() = user_id` (pas d'usurpation) ; suppression de message seulement si `auth.uid() = user_id`.
- Les messages sont affichés comme du texte par React (aucun `dangerouslySetInnerHTML`).
- Seules l'URL du projet et la clé `anon` sont présentes dans le frontend.
- La fonction `is_username_available` (appelable sans connexion) ne renvoie qu'un booléen pour signaler un pseudo déjà pris pendant l'inscription. Pour la supprimer : `drop function public.is_username_available(text);` — l'inscription continuera de fonctionner, l'unicité restant garantie par la base.

## Notes techniques sur le temps réel

- Les `INSERT` sont filtrés côté serveur par groupe (`group_id=eq.<id>`).
- Les `DELETE` ne peuvent pas être filtrés par colonne dans Supabase Realtime (seule la clé primaire est transmise) : l'application retire donc simplement l'`id` reçu s'il est affiché.
- Les doublons sont évités par l'`id` du message (l'expéditeur voit son message immédiatement, l'évènement temps réel est ignoré).
- Chaque canal est supprimé (`removeChannel`) au changement de groupe, à la déconnexion et à la fermeture de la page. À la (re)connexion du canal, l'historique est rechargé pour rattraper les messages manqués.
