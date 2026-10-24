# Check - Préparation des données du répertoire

Étape 3 réalisée le 23 octobre 2026. Les fichiers sont préparés pour les maquettes puis l'import en administration ; aucune référence n'est publiée à ce stade.

## Livrables

| Fichier | Contenu |
| --- | --- |
| `data/reference/2026-01/manifest.json` | Source, édition, SHA-256, versions d'outils et empreintes des sorties. |
| `data/reference/2026-01/taxonomy.json` | 24 grandes familles et 578 familles détaillées, dont 57 dans le chapitre automobile. |
| `data/reference/2026-01/automotive.json` et `.csv` | 419 lignes automobiles avec prix, unité, famille, contexte et provenance. |
| `data/reference/2026-01/automotive.sample.json` et `.csv` | 40 articles : huit batteries, huit filtres, huit amortisseurs, huit huiles et huit pneus. |
| `data/reference/2026-01/review-queue.json` | 85 lignes portant au moins un signal à revoir. |
| `data/reference/2026-01/quality-report.json` | Compteurs et contrôles de cohérence. |
| `data/reference/2026-01/raw/` | Cellules avant normalisation, en-têtes et extraits de pages source. |
| `data/reference/reviews/togo-2026-01-visual-review.json` | Journal du contrôle visuel de transcription de l'échantillon. |
| `scripts/reference/` | Extracteur, dépendance Python épinglée, profil de cette source et commandes de reproduction. |

La copie intégrale du PDF est conservée localement dans `data/sources/` et ignorée par Git. Elle n'est importée dans aucun écran. Le [dictionnaire](./DICTIONNAIRE_REFERENCE.md) décrit les champs et les règles de normalisation.

## Identité de la source

- Fichier transmis par le porteur du projet : `Repertoire_des_prix_2026.01.pdf`.
- Couverture : « VERSION 2026 - 01 », République togolaise, ministère des Finances et du Budget.
- 869 pages ; 22 766 101 octets.
- SHA-256 : `5e49ab8ebc74c4bc26485949730d4435f4f3d564d3f7673bf37200456c63d416`.
- Guide : pages PDF 4 et 5. Chapitre automobile : pages PDF 491-512 ; données aux pages 492-512, imprimées 362-382.
- Le guide donne les prix des produits hors taxes. La devise XOF est une normalisation du FCFA mentionné page PDF 87 dans le contexte togolais. Aucun taux de TVA n'est appliqué.

La source est celle fournie dans la conversation. La provenance du téléchargement d'origine et la période de validité des prix restent à confirmer. Les métadonnées de création et de modification du PDF sont conservées dans le manifeste ; elles ne sont pas utilisées comme dates de validité.

## Méthode et contrôles

L'index des familles est extrait dans tout le document. Les prix sont extraits dans le seul chapitre automobile. Chaque ligne conserve son numéro imprimé, son identifiant de provenance distinct, les six cellules brutes, les valeurs normalisées, le tableau, la page et le rectangle source.

La lecture par géométrie des cellules récupère les désignations sur plusieurs lignes. Les sous-rubriques de véhicule d'« Autres entretiens » sont conservées, y compris lorsqu'elles se poursuivent sur la page suivante. Par exemple, les articles 6194-6198 reprennent le contexte « TOYOTA PRADO D4D » commencé page PDF 508 ; l'article 6278 conserve « HILUX 2018 », commencé page PDF 510.

Les 419 lignes sont rapprochées d'une seconde extraction indépendante avec Poppler : ordre des numéros, pages et suffixes numériques correspondant aux trois montants. Résultat : **419 triplets de prix concordants, aucune divergence**. Les six champs attendus sont présents sur chaque ligne ; aucun montant nul ou négatif n'a été relevé.

Les 40 articles de l'échantillon ont été comparés visuellement aux tableaux rendus, sur 11 pages source : désignation, unité, PM, LI, LS et contexte lorsqu'il existe. Aucune divergence de transcription n'a été relevée. Les anomalies présentes dans le document restent présentes dans les données et signalées pour revue.

Une seconde exécution depuis la copie conservée du PDF produit les mêmes fichiers octet par octet. Les 34 empreintes de sorties du manifeste, celles du script, du profil et du PDF copié sont vérifiées. Les décomptes JSON/CSV, les identifiants et les 40 entrées du journal de revue concordent. Les contrôles TypeScript et ESLint du projet passent après l'ajout de ces fichiers.

## Rapprochement des 415 articles annoncés

Le guide annonce 415 articles automobiles. Les numéros 5900 à 6314 sont tous présents, soit **415 numéros distincts**, mais le document contient **419 lignes** :

| Numéro source | Occurrences | Page PDF | Lignes concernées |
| --- | --- | --- | --- |
| 6128 | 2 | 504 | Pompe à eau RAV 4 ; roue libre de la courroie de distribution. |
| 6133 | 3 | 505 | Raccord rapide métallique ; raccord rapide plastique ; ventilateur moteur Hilux. |
| 6167 | 2 | 508 | Biellette CHERY ; filtre à huile CHRYSLER. |

Ces réutilisations expliquent les quatre lignes supplémentaires. Chaque ligne possède une clé de provenance propre ; les numéros source ne sont ni renumérotés ni fusionnés.

## Signaux de revue

Les filtres signalent **85 lignes distinctes**. Certaines ont plusieurs signaux ; les effectifs ci-dessous ne s'additionnent donc pas pour obtenir 85.

| Signal | Lignes | Traitement |
| --- | --- | --- |
| Prix moyen hors de LI/LS | 4 | Revoir les carburants à la source. |
| Numéro source réutilisé | 7 | Conserver les lignes et distinguer leurs identités de provenance. |
| Désignation avec jeu/paire/ensemble et unité pièce/unité | 39 | Confirmer le conditionnement avant toute comparaison. |
| Famille source apparemment discordante | 14 | Revoir le classement ; conserver celui du PDF en attendant. |
| Rattachement au périmètre automobile à revoir | 13 | Coussins, enrouleurs, projecteurs et colle en bâtons restent dans la préparation. |
| Grades d'huile contenant « SW » | 3 | Conserver le texte ; ne pas remplacer automatiquement par « 5W ». |
| Même marque et dimension explicites de pneu | 4 | Correspondances possibles à examiner sans fusion. |
| Dimension de pneu incomplète | 2 | Clarifier les désignations 6214 et 6219. |
| Prestation potentielle / base fiscale à préciser | 1 | « Pré-vidange » : nature et base HT/TTC à confirmer. |

Les quatre carburants de la page PDF 492 portent les valeurs suivantes, dans l'ordre PM / LI / LS :

| Numéro | Désignation | PM | LI | LS |
| --- | --- | --- | --- | --- |
| 5900 | Gaz oïl | 750 | 695 | 695 |
| 5901 | Super sans plomb | 725 | 680 | 680 |
| 5902 | Mélange 2 temps | 811 | 769 | 769 |
| 5903 | Pétrole lampant | 1 040 | 650 | 650 |

Les pneus Michelin 195/65 R15 (6099 et 6123) et 225/70 R17 (6105 et 6124) présentent des désignations proches avec des prix différents. La gamme, les indices et les autres caractéristiques ne sont pas suffisamment précisés pour décider qu'il s'agit de doublons exacts.

## Points relevés dans la hiérarchie

- La rubrique « 0553 - Autres entretiens » n'a pas de code de famille imprimé. `code_raw` reste `null` ; un identifiant local distinct assure son rattachement.
- L'ordre 0518 est réutilisé pour les codes 614490 et 614491 dans l'automobile. Les ordres 0201 et 0573 sont aussi réutilisés dans d'autres chapitres. Les codes et ordres bruts sont tous conservés.
- Les intitulés du guide et des chapitres présentent quelques variantes de vocabulaire et de pluriel. Les deux versions restent disponibles.
- Les numéros imprimés changent de séquence entre certains chapitres ; les liens de provenance utilisent toujours les pages physiques du PDF.

## État de préparation et informations à compléter

Les 334 lignes sans signal automatique ont l'état `ready_for_review`. Les 85 autres ont l'état `needs_review`. **Toutes conservent `published: false`.** Ces états décrivent la préparation éditoriale et ne certifient pas l'actualité du prix ou la correspondance avec une pièce précise.

Les références constructeur, marques, modèles, années, motorisations, dimensions et qualités ne sont pas encore systématiquement structurés. Les informations qui apparaissent dans une désignation ou une rubrique sont conservées en texte. Une mention comme « Original » reste une mention source. La compatibilité avec un véhicule, le stock fournisseur et la période de validité des prix ne sont pas validés par cette extraction.

La préparation est prête pour les maquettes et l'import en zone de revue. La publication dépendra de la vérification des références et des règles d'accès prévues dans les étapes suivantes.

## Suite

Pour l'étape 4, le porteur du projet souhaite une proposition visuelle libre, puis des ajustements au ressenti. La première proposition couvrira l'accueil, la recherche, la fiche article et la comparaison, avec des prix et états issus de cet échantillon. Les cas douteux devront rester visibles comme tels dans les maquettes.

Voir les [commandes de reproduction](../scripts/reference/README.md), le [dictionnaire](./DICTIONNAIRE_REFERENCE.md) et le [plan](./PLAN_DEVELOPPEMENT.md).
