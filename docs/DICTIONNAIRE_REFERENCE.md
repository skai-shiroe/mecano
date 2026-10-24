# Dictionnaire des données de référence

Édition source 2026-01. Ce format décrit les fichiers de préparation de l'étape 3 ; le modèle de base sera conçu à l'étape 5.

## Source et manifeste

`data/reference/2026-01/manifest.json` relie les sorties à un seul PDF.

| Champ | Type et règle |
| --- | --- |
| `source_id` | Identifiant d'édition stable, `togo-reference-prices-2026-01`. |
| `edition` / `edition_label_on_cover` | Édition normalisée et libellé lu sur la couverture. Une édition ne constitue pas une date de validité commerciale. |
| `sha256` / `byte_size` / `page_count` | Empreinte SHA-256, octets et nombre de pages de la source intégrale. |
| `received_on` / `provenance` | Réception enregistrée et origine de transmission ; aucun téléchargement officiel n'a été vérifié. |
| `pdf_metadata` | Métadonnées internes du PDF, conservées comme informations source. |
| `reference_valid_from` / `reference_valid_until` | `null` : période de validité non vérifiée. |
| `currency` | `XOF`, normalisation du FCFA dans le contexte togolais. Le sigle FCFA apparaît page PDF 87 ; la couverture donne le pays. Le code ISO n'est pas imprimé dans les tableaux automobiles. |
| `product_tax_basis` / `tax_basis_pdf_page` | `HT`, selon le guide page PDF 5 pour les produits. La base des prestations potentielles reste à vérifier. |
| `coverage` | Index des familles de tout le document ; prix automobiles uniquement ; publication désactivée. |
| `extractor` | Version pdfplumber/Poppler et empreintes du script et du profil utilisés. |
| `artifacts[]` | Chemin relatif, empreinte et taille de chaque sortie de l'extraction. |

## Hiérarchie des familles

`taxonomy.json` contient `groups` et `families`. Les libellés du guide et des en-têtes de chapitre sont conservés séparément lorsqu'ils diffèrent.

| Champ | Type et règle |
| --- | --- |
| `groups[].id` / `number` | Identifiant local et numéro du groupe dans le guide ; `group-23` désigne le chapitre automobile. |
| `label_raw` / `label` | Libellé du guide, puis sa version avec espaces regroupés. |
| `chapter_label_raw` | En-tête de chapitre tel qu'extrait du document. |
| `declared_items` | Effectif annoncé par le guide, sans certification du nombre de lignes des autres chapitres. |
| `first_pdf_page` / `last_pdf_page` / `printed_start` | Pages physiques de la section et numéro imprimé de début ; conserver ces deux numérotations. |
| `scope` | `pilot_candidate` pour l'automobile ; `inactive` pour les autres groupes. |
| `families[].id` | Identifiant local formé du groupe, de l'ordre et du code source. Il est toujours utilisé avec `source_id`. |
| `group_id` | Parent dans la hiérarchie. |
| `ordinal_raw` | Numéro d'ordre source sous forme de chaîne pour préserver les zéros. Il peut être réutilisé par erreur dans le PDF. |
| `code_raw` | Code imprimé sous forme de chaîne ; `null` pour « 0553 - Autres entretiens ». Aucun code source n'est inventé. |
| `label` / `label_variants` | Libellé normalisé et variantes rencontrées. |
| `source_pages[]` | Occurrences de l'en-tête avec page PDF et numéro imprimé. |
| `published` | Toujours `false` à ce stade. |

Les en-têtes complets, sauts de ligne et positions dans le texte restent dans `raw/taxonomy-headings.jsonl`.

## Articles automobiles

`automotive.json` est un tableau de 419 lignes. Le numéro imprimé ne sert pas de clé unique.

| Champ | Type et règle |
| --- | --- |
| `id` | Identifiant stable de provenance : édition, page physique, tableau et position de ligne. Deux lignes portant le même numéro gardent des identifiants distincts. |
| `source_id` | Édition de référence du manifeste. |
| `source_item_number` | Numéro source normalisé en chaîne, sans séparateurs de milliers. Les doublons restent présents. |
| `group_id` / `family_id` | Rattachement à la hiérarchie source ; le classement n'est pas corrigé automatiquement. |
| `designation` | Texte de désignation avec espaces et retours à la ligne regroupés. Orthographe, références partielles et autres erreurs source restent présentes. |
| `unit_raw` / `unit` | Unité source et clé normalisée ; tableau de correspondance ci-dessous. Aucun prix n'est recalculé. |
| `kind` | `product` par défaut pour ce chapitre ; `service_candidate` pour « Pré-vidange », dont la nature doit être confirmée. |
| `prices.pm` / `li` / `ls` | Entiers monétaires exacts en XOF ; PM = prix moyen, LI = limite inférieure, LS = limite supérieure. Aucun calcul flottant ou taux fiscal supposé. |
| `prices.currency` / `tax_basis` | `XOF` ; base `HT` pour les produits et `unknown` pour la prestation potentielle repérée. |
| `source.pdf_page` / `printed_page` | Page physique à partir de 1 et numéro imprimé. L'automobile utilise les pages PDF 492-512, imprimées 362-382. |
| `source.table_index` / `row_index` | Positions à partir de 1 dans l'extraction de la page ; la position de ligne compte les articles, sans les en-têtes. |
| `source.bbox` | Rectangle `[x0, top, x1, bottom]` en points PDF, origine en haut à gauche. Sert à retrouver la ligne visuellement. |
| `source.section` | Sous-rubrique source et sa page d'origine, ou `null`. `kind` distingue contexte de véhicule et regroupement de produits. La rubrique peut commencer sur la page précédente. |
| `identification.manufacturer_reference` | `null` : référence constructeur structurée non extraite. Des fragments présents dans la désignation sont conservés dans son texte. |
| `identification.fitment_verified` | `false` : aucun texte du répertoire ne suffit à certifier la compatibilité avec un véhicule précis. |
| `identification.structured_attributes_extracted` | `false` : les marques, modèles, années, dimensions et grades ne sont pas encore structurés systématiquement. |
| `valid_from` / `valid_until` | `null` : date de validité non vérifiée. |
| `review.status` | `ready_for_review` si aucun signal automatique ; `needs_review` si au moins un signal. Les deux états attendent une revue éditoriale. |
| `review.codes[]` | Codes de signaux décrits dans `review-queue.json` et le rapport. |
| `review.published` | Toujours `false`. |

`raw/automotive.jsonl` conserve pour chaque `id` les six cellules avant normalisation (`number`, `designation`, `unit`, `pm`, `li`, `ls`), l'en-tête et la même localisation source. Ces cellules sont du texte extrait du PDF ; le PDF conservé reste la source visuelle.

## Normalisation des unités

| Variantes source | Clé |
| --- | --- |
| `Unité`, `unité`, `1 unité` | `unite` |
| `Pièce` | `piece` |
| `Ensemble` | `ensemble` |
| `JEU`, `1 JEU` | `jeu` |
| `paire`, `Paire`, `1 paire` | `paire` |
| `Litre`, `1l` | `litre` |
| `5l`, `5litres` | `5_litres` |
| `Bidon de 5L` | `bidon_5_litres` |
| `0.5litres` | `0_5_litre` |
| `1kg` | `kilogramme` |
| `Boîte` | `boite` |

Une paire, un jeu et un ensemble conservent des clés distinctes. Une référence au litre et une référence au bidon de 5 litres gardent chacune le prix de leur conditionnement source. Une future comparaison demandera une correspondance et une conversion explicitement validées.

## Fichiers de revue

- `automotive.csv` : toutes les lignes, avec libellé de famille et contexte de véhicule ; séparateur point-virgule, UTF-8 avec BOM et en-têtes français.
- `automotive.sample.json` / `.csv` : 40 articles répartis dans cinq groupes de huit. Les signaux de revue sont conservés dans l'échantillon.
- `review-queue.json` : une entrée par ligne signalée, avec raisons et localisation.
- `quality-report.json` : compteurs, rapprochement des numéros, signaux par code et contrôle indépendant des prix.
- `data/reference/reviews/togo-2026-01-visual-review.json` : journal du contrôle de transcription sur les 40 articles. Ce contrôle ne valide pas la qualité du produit, son stock, sa compatibilité ou le prix courant.

Les imports futurs utiliseront les fichiers JSON comme format d'échange typé. Les CSV servent à la lecture et à la revue ; leur ouverture dans un tableur peut modifier les zéros des codes si les colonnes ne sont pas importées comme texte.
