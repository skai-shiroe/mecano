# Backend Check

Projet distant : `nhdwiuukewfofaexbxmi` (`check-app`). Le fichier `project.json` conserve la référence publique ; il ne contient aucune clé. `config.toml` configure le développement local et ne modifie pas à lui seul les réglages Auth du projet distant.

## Structure

- `migrations/` : schéma du pilote, créé avec la CLI Supabase et suivi dans l'historique de migration.
- `imports/2026-01/` : lots DML idempotents du répertoire, importés uniquement en préparation.
- `inspect.sql` : requêtes de lecture pour les compteurs et privilèges.
- [Schéma, relations et permissions](../docs/SCHEMA_SUPABASE.md).

## Commandes de référence

CLI utilisée : 2.122.0. Pour travailler ensuite avec la CLI depuis la racine du projet :

```bash
npx supabase@2.122.0 login
npx supabase@2.122.0 link --project-ref nhdwiuukewfofaexbxmi
npx supabase@2.122.0 migration list
npx supabase@2.122.0 db push --dry-run
```

Le projet dispose déjà de son schéma après l'installation initiale ; les migrations suivantes devront être ajoutées avec `migration new` et relues avant leur application.

Pour régénérer les types après une migration :

```bash
npx supabase@2.122.0 gen types --lang typescript --linked > src/types/database.ts
```

Les types sont générés depuis la base distante ; les régénérer après chaque changement du schéma exposé.

## Répertoire de référence

Génération des lots depuis les fichiers vérifiés de l'étape 3 :

```bash
python3 scripts/reference/build_supabase_import.py
```

Les lots sont des requêtes SQL contenant les données en littéraux JSON, transmises depuis le client. Aucun fichier du serveur PostgreSQL n'est lu. Chaque lot est transactionnel ; le dernier rapproche les effectifs et marque l'import terminé. La répétition d'un lot ne réinitialise pas les revues existantes.

Pour charger une autre base de développement après le schéma, exécuter les fichiers `.sql` de `imports/2026-01/` dans l'ordre numérique avec une connexion administrative. La cible doit être explicitement sélectionnée par l'opérateur. Le client Expo ne reçoit pas d'autorité d'import ou de paiement.

Les formules restent inactives, sans tarifs ni durées. L'import ne crée ni droits d'accès payants ni publications automatiques. Les clés privilégiées resteront côté serveur lors des intégrations futures.
