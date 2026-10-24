# Données de préparation Check

Le chapitre automobile est extrait en zone de préparation. Toutes les lignes attendent une décision de publication ; les lignes avec signaux de revue sont identifiées séparément.

```text
data/
  sources/                 Copie locale du PDF, ignorée par Git
  reference/
    2026-01/
      manifest.json        Provenance et empreintes
      taxonomy.json        24 groupes et 578 familles détaillées
      automotive.json      419 lignes normalisées
      automotive.csv       Les mêmes lignes pour revue dans un tableur
      automotive.sample.*  40 articles, huit par groupe de l'échantillon
      review-queue.json    85 lignes signalées
      quality-report.json  Compteurs et rapprochement
      raw/                 Cellules et extraits de texte source
    reviews/               Journal de contrôle visuel de transcription
```

Les données sont hors de `src/` et ne sont importées dans aucun écran. Le PDF reste un document source local. L'accès au catalogue publié et aux prix sera mis en place avec l'administration et les droits d'abonnement.

- [Bilan et anomalies](../docs/PREPARATION_DONNEES.md).
- [Dictionnaire des champs](../docs/DICTIONNAIRE_REFERENCE.md).
- [Commandes d'extraction](../scripts/reference/README.md).
