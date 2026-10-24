# Préparation du répertoire

Ce traitement produit des données de préparation et leur provenance. Les prix sont extraits uniquement pour le chapitre automobile. La hiérarchie des familles est relevée dans tout le document.

## Installation

Prérequis : Python 3.10 ou plus récent, Poppler (`pdftotext`) et les dépendances Python épinglées. Depuis la racine du projet :

```bash
python3 -m venv .venv-data
. .venv-data/bin/activate
python -m pip install -r scripts/reference/requirements.txt
pdftotext -v
```

Sur Debian/Ubuntu, `pdftotext` est fourni par le paquet `poppler-utils`.

## Extraction

```bash
python scripts/reference/extract.py --pdf data/sources/repertoire-des-prix-2026-01.pdf
```

Pour la première exécution, `--pdf` peut désigner le fichier reçu dans un autre dossier. Le traitement conserve une copie dans `data/sources/`, dont le SHA-256 est vérifié. Ce PDF de 22 Mo est ignoré par Git. Les sorties sont écrites dans `data/reference/2026-01/`.

Options :

- `--pdf` : chemin du PDF fourni, obligatoire.
- `--profile` : profil de source ; par défaut `scripts/reference/profiles/togo-2026-01.json`.
- `--output` : dossier des données produites ; utile pour rejouer l'extraction dans un dossier temporaire.
- `--source-copy` : destination de la copie locale du PDF ; un fichier existant d'empreinte différente est refusé.

Le profil décrit cette source précise : édition lue sur la couverture, empreinte, pagination, compteurs et sélection des 40 articles. Un fichier dont l'empreinte diffère est refusé. Pour une autre édition, créer un nouveau profil et revoir les pages, la structure des tableaux, les compteurs et l'échantillon avant de générer les données.

## Traitement

1. Vérifier le SHA-256, la taille et les 869 pages du fichier reçu.
2. Lire les 24 groupes et leurs effectifs déclarés dans le guide ; rapprocher leur somme de 13 732.
3. Indexer les familles détaillées et leurs occurrences, en conservant les numéros, codes, libellés et pages source.
4. Détecter les tableaux automobiles et les six colonnes par leur géométrie avec pdfplumber. Les limites verticales des cellules de numéros permettent de récupérer les désignations sur plusieurs lignes.
5. Conserver les cellules brutes, la page, le rectangle, la position de la ligne et les sous-rubriques de véhicule. Les sous-rubriques continuent sur la page suivante tant qu'une nouvelle rubrique ne les remplace pas.
6. Normaliser les espaces, les montants entiers et la casse des unités connues. Les typos restent dans les désignations. Aucune conversion de montant ou de conditionnement n'est effectuée.
7. Comparer indépendamment les 419 lignes, leurs numéros et les trois montants avec le texte produit par Poppler. Une divergence interrompt le traitement.
8. Produire les signaux de revue, les deux CSV, l'échantillon et le manifeste d'empreintes.

Les règles de revue sont des filtres prudents pour cette source. Elles ne remplacent ni une vérification technique automobile ni une décision de publication. Toute ligne conserve `review.published: false` ; même `ready_for_review` demande une revue éditoriale. Les cas suspects conservent `needs_review`.

## Rejouer sans toucher aux sorties existantes

```bash
python scripts/reference/extract.py \
  --pdf data/sources/repertoire-des-prix-2026-01.pdf \
  --output /tmp/check-reference-replay \
  --source-copy data/sources/repertoire-des-prix-2026-01.pdf
diff -qr data/reference/2026-01 /tmp/check-reference-replay
```

Le manifeste contient les versions d'outils et les empreintes du script, du profil et des fichiers produits. La comparaison octet par octet est reproductible avec les mêmes versions d'outils. Le dernier contrôle a utilisé pdfplumber 0.11.9 et Poppler 26.01.0.

Voir le [bilan des données](../../docs/PREPARATION_DONNEES.md) et le [dictionnaire](../../docs/DICTIONNAIRE_REFERENCE.md).
