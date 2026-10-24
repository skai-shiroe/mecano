**Check**

Application Expo / React Native pour consulter des prix de référence et comparer des devis. Le premier pilote porte sur l’automobile et accueille particuliers et assureurs.

**Installation**

Utiliser Node.js 22, avec la version du fichier `.nvmrc` (22.22.1 pour ce socle), et npm. Depuis la racine du projet :

```bash
nvm use
npm ci
cp .env.example .env.local
```

Le projet utilise Expo SDK 58. Les dépendances Expo et natives s’installent avec `npx expo install` pour conserver les versions compatibles.

**Lancement et vérifications**

| Commande | Usage |
| --- | --- |
| `npm start` | Démarrer Metro ; le client de développement est utilisé lorsqu’il est installé. |
| `npm run start:go` | Démarrer pour Expo Go. |
| `npm run start:dev` | Démarrer pour le client de développement Check. |
| `npm run android` | Démarrer et ouvrir Android. |
| `npm run ios` | Démarrer et ouvrir iOS sur un environnement compatible. |
| `npm run web` | Démarrer la version web. |
| `npm run typecheck` | Vérifier les types TypeScript. |
| `npm run lint` | Vérifier le code avec ESLint, sans avertissement accepté. |
| `npm run lint:fix` | Appliquer les corrections automatiques du lint. |
| `npm run check` | Exécuter TypeScript puis ESLint. |
| `npm run check:deps` | Vérifier les versions attendues par Expo. |
| `npm run doctor` | Lancer le diagnostic Expo Doctor. |
| `npm run export:web` | Compiler le client web et les routes serveur dans `dist/`. |
| `npm run export:android` | Compiler le bundle JavaScript Android dans `dist/`. |

L’export Android vérifie la compilation JavaScript et les assets. Un binaire natif et une validation sur téléphone complètent cette vérification.

**Organisation du code**

```text
src/
  app/           Routes Expo Router et layouts
  components/    Composants d’interface partagés
  hooks/         Hooks et variantes propres au web
  constants/     Couleurs et constantes partagées
  config/        Configuration publique par environnement
assets/          Images et polices
docs/            Cadrage, plan et bilan technique
```

L’alias `@/` pointe vers `src/`. Les fichiers de configuration restent à la racine. Les assets restent dans `assets/` ; les imports relatifs doivent tenir compte de l’emplacement du fichier source. Les accès aux données et fonctions métier seront ajoutés hors de `src/app/` lorsqu’ils seront développés.

**Environnements**

`.env.example` fournit `EXPO_PUBLIC_APP_ENV`. Les valeurs prévues sont `development`, `preview` et `production`, exposées par `src/config/env.ts`. Les fichiers locaux `.env*` sont ignorés, à l’exception de l’exemple.

Les variables `EXPO_PUBLIC_*` sont publiques dans le bundle. Les clés privilégiées des futurs services restent côté serveur. Expo SDK 58 charge les fichiers d’environnement standards selon la commande ; utiliser `.env.local` en local et les environnements EAS pour les builds.

**Client de développement et builds**

`expo-dev-client` et les profils `development`, `preview` et `production` sont préparés. Le profil preview produit un APK Android installable. Pour préparer le premier binaire Android avec le compte Expo du projet :

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform android
```

Le premier rattachement EAS demande le projet Expo, les identifiants natifs et les credentials de signature. Après installation du binaire sur le téléphone, lancer `npm run start:dev`. Le test des écrans du socle peut aussi se faire avec `npm run start:go` tant que les modules utilisés sont disponibles dans Expo Go.

**Contrôle automatique**

Le workflow GitHub `quality.yml` installe le lockfile avec `npm ci`, exécute `npm run check` puis compile le web à chaque push ou pull request. Il utilise la même version Node que `.nvmrc`.

**Données de référence**

L'étape 3 fournit les données automobiles en JSON et CSV dans `data/reference/2026-01/`, avec un échantillon de 40 articles et une file de revue. Le PDF source est conservé localement hors Git. Les commandes d'extraction sont documentées dans [scripts/reference](scripts/reference/README.md).

**Backend Supabase**

Le projet Supabase `check-app` contient la migration du pilote, les règles RLS, les types TypeScript générés et l’import de référence 2026-01. Les 419 entrées et 87 signalements sont chargés en préparation ; aucune référence n’est encore publiée. Voir [le schéma Supabase](docs/SCHEMA_SUPABASE.md) et [les procédures Supabase](supabase/README.md).

La première connexion applicative utilise Google Authentication. La configuration requise est décrite dans [AUTH_GOOGLE.md](docs/AUTH_GOOGLE.md). Le téléphone/OTP et les abonnements/paiements sont reportés.

**Documents du projet**

- [Cadrage du pilote](docs/CADRAGE_PILOTE.md).
- [Plan de développement](docs/PLAN_DEVELOPPEMENT.md).
- [Bilan de stabilisation Expo](docs/STABILISATION_EXPO.md).
- [Préparation des données et anomalies](docs/PREPARATION_DONNEES.md).
- [Dictionnaire des données de référence](docs/DICTIONNAIRE_REFERENCE.md).
- [Documentation Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).
- [Organisation sous src](https://docs.expo.dev/router/reference/src-directory/).
- [Configuration ESLint](https://docs.expo.dev/guides/using-eslint/).
- [Variables d’environnement](https://docs.expo.dev/guides/environment-variables/).
