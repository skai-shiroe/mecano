**Check — Bilan de stabilisation Expo**

23 octobre 2026. Projet : `/home/skai/Bureau/labo-dev/mecano/`.

Le code du socle est stabilisé et les contrôles locaux passent. La validation interactive sur téléphone Android reste à réaliser.

**Changements réalisés**

- Correction des deux erreurs TypeScript du template dans `src/components/Themed.tsx` avec `ComponentProps` ; types des liens externes et des hooks précisés.
- Déplacement des routes dans `src/app/`, des composants dans `src/components/` et des hooks dans `src/hooks/`. Les constantes et la configuration ont leur propre dossier. L’alias `@/` pointe vers `src/` et le chemin de la police a été adapté.
- Configuration ESLint officielle Expo, commandes TypeScript/lint et corrections demandées par les règles React. Le hook web de valeur côté client utilise `useSyncExternalStore` avec un instantané serveur explicite.
- Correction du document HTML personnalisé : `useServerDocumentContext` fournit désormais les attributs et les nœuds nécessaires aux styles, polices et scripts. Cette adaptation est requise par [Expo Router SDK 58](https://docs.expo.dev/router/migrate/sdk-57-to-58/#update-custom-root-html-components).
- Conservation du SDK 58 et alignement des versions attendues par Expo. Le lockfile installe Expo 58.0.17 et Expo Router 58.0.25.
- Préparation du client de développement, ajout de `expo-system-ui` pour la configuration de thème automatique et des profils EAS `development`, `preview` et `production`.
- Configuration publique `EXPO_PUBLIC_APP_ENV`, exemple de variables et exclusion des fichiers locaux d’environnement dans Git.
- Version Node 22.22.1 dans `.nvmrc`, scripts documentés et workflow GitHub de contrôle TypeScript, lint et export web.

**Vérifications effectuées**

| Vérification locale | Résultat |
| --- | --- |
| `npm ci --no-audit --no-fund` avec le lockfile final | Installation réussie. |
| `npm run check` | TypeScript et ESLint réussis ; aucun avertissement ESLint accepté. |
| `npm run check:deps` | Versions des dépendances conformes au SDK. |
| `npm run doctor` | 20 contrôles sur 20 réussis. |
| `npm run export:web` | Bundles client et serveur produits dans `dist/`, polices incluses. |
| Export Android vers un répertoire temporaire | Bundle JavaScript/Hermes et assets produits. |
| Rendu serveur du hook de valeur côté client | Valeur serveur conservée au rendu serveur ; variante native conforme. |
| Serveur de production local : `/`, `/two`, `/modal` | Réponses HTML 200 et présence des scripts client. |
| Route inexistante | Réponse HTML 404. |
| Scripts référencés par les pages | Huit fichiers JavaScript distincts répondent en 200. |
| Cohérence du manifeste et du lockfile | Nom, version, dépendances et contraintes Node identiques. |

Les contrôles HTTP confirment la présence et la disponibilité des scripts après la correction de `+html.tsx`. Les interactions dans un navigateur et sur téléphone restent à valider. Le workflow GitHub est configuré ; sa première exécution distante suivra la publication des changements.

**Dépendances à suivre**

Le dernier `npm audit` du 23 octobre 2026 signale **4 entrées de sévérité élevée**, liées à une seule alerte sur `node-forge` 1.4.0, transitivement utilisé par l’outillage Expo de signature. Il ne remonte aucune alerte modérée ou critique.

L’avis [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) ne propose pas encore de version corrigée. La correction forcée suggérée par npm rétrograderait Expo vers le SDK 44 ; elle est incompatible avec ce socle. Les corrections compatibles ont été appliquées. Revoir cette dépendance avant la distribution du pilote.

L’alerte antérieure sur `braces` a été [retirée par la base d’avis le 23 octobre 2026](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) et ne figure plus dans l’audit final.

ESLint 9.39.5 est conservé pour respecter les plages de compatibilité des plugins React 7.37.5 et Import 2.32.0 installés avec la configuration Expo. Cette branche est [en fin de maintenance](https://eslint.org/version-support/) ; le passage à ESLint 10 devra accompagner des versions compatibles de ces plugins.

**Validation Android restante**

Le bundle Android compile. Aucun appareil ou émulateur Android n’était disponible pour vérifier visuellement les écrans et la navigation ; aucun APK ou binaire iOS n’a été produit.

Le rattachement du projet à EAS, les identifiants natifs et les credentials de signature seront configurés lors du premier build, suivant les commandes du [README](../README.md). Après installation, vérifier le chargement des polices, les deux onglets, la modale, le retour arrière et les thèmes clair/sombre.

La prochaine étape du plan porte sur la préparation et la vérification des données du répertoire.
