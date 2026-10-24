**Check — Plan de développement proposé**

Version du 24 octobre 2026.

Cadrage de l’étape 1 : [cahier des besoins, permissions et priorités du pilote](./CADRAGE_PILOTE.md). Choix confirmés par le porteur du projet : public mixte assureurs/particuliers ; connexion par e-mail et mot de passe ainsi que téléphone et SMS ; paiement et activation automatiques dès le pilote ; Mobile Money et carte bancaire comme moyens souhaités. Les tarifs et durées restent à définir.

Check aide ses abonnés à rechercher un prix de référence, examiner un devis, comparer des offres de fournisseurs, puis commander des produits et se faire livrer. Le catalogue couvre progressivement plusieurs familles de produits et de services ; le lancement porte sur l’automobile.

Le premier résultat attendu est un parcours complet : un abonné recherche une pièce, consulte une référence vérifiée, saisit le prix de son devis et comprend l’écart constaté.

**Point de départ et hypothèses**

- Projet local : `/home/skai/Bureau/labo-dev/mecano/`. Le nom Expo est Check et l’identifiant npm est `check`.
- Socle existant : Expo SDK 58, React Native, TypeScript et Expo Router ; les écrans sont encore ceux du template.
- Les deux erreurs TypeScript initiales sont corrigées dans `src/components/Themed.tsx`. ESLint est configuré et le code est organisé sous `src/` ; voir le [bilan de stabilisation](./STABILISATION_EXPO.md).
- Le PDF fourni contient 869 pages. Son guide annonce 24 grandes familles et 13 732 articles ; 415 articles sont annoncés dans la grande famille d’entretien, réparation et maintenance des véhicules.
- Le guide présente des prix de produits hors taxes et les colonnes PM, LI et LS. Il décrit un usage pour l’évaluation de dépenses publiques : les résultats de Check afficheront la source et le contexte de comparaison.
- Hypothèse de lancement à confirmer lors du cadrage : Togo, français, FCFA/XOF, avec Android comme premier appareil de validation et une compatibilité iOS préparée dans Expo.
- Architecture proposée : application Expo, PostgreSQL/Supabase pour les données et les comptes, et une administration web reliée aux mêmes règles d’accès. Ce choix de backend est une proposition technique.

**Livraisons successives**

| Livraison | Valeur attendue | Étapes |
| --- | --- | --- |
| Pilote de consultation | Un abonné trouve un prix vérifié et compare son devis ; un administrateur entretient le catalogue. | 1 à 10 |
| Pilote de commande | Des fournisseurs publient des offres fiables ; un client commande et reçoit son produit. | 11 à 13 |
| Extension | Les assureurs disposent de fonctions d’équipe plus complètes et de nouvelles familles sont activées. | 14 |

**1. Fixer les règles du premier pilote**

Travaux :

- Décrire les utilisateurs : particulier abonné, collaborateur d’un assureur, fournisseur, opérateur de livraison et administrateur. Les permissions peuvent se cumuler pour une même personne.
- Définir les droits individuels et les droits accordés par une organisation, avec une durée d’accès explicite.
- Formaliser le public mixte assureurs/particuliers et les deux modes de connexion retenus ; préciser la zone, les formules et les fonctions comprises dans l’abonnement.
- Définir le premier périmètre automobile : pièces et consommables utiles au pilote ; identifier séparément les prestations et les autres articles présents dans le chapitre.
- Écrire les règles de comparaison : même article ou correspondance validée, même qualité, même unité, même devise et même base HT/TTC.
- Fixer le vocabulaire des résultats : dans la fourchette, au-dessus de la fourchette, en dessous de la fourchette, ou comparaison impossible. Un dépassement indique un écart à examiner.
- Décider comment présenter l’abonnement sur chaque canal de distribution. Le paiement d’un accès numérique et celui d’un produit physique suivent des parcours distincts.

Livrable : cahier des besoins court, tableau des permissions et liste priorisée des fonctions.

Validation : les règles permettent d’expliquer un exemple de recherche, de comparaison et de droit d’accès sans ambiguïté.

**2. Stabiliser le socle Expo**

État au 23 octobre 2026 : corrections, organisation du code et contrôles locaux réalisés ; validation interactive sur téléphone Android encore à effectuer. Le [bilan technique](./STABILISATION_EXPO.md) détaille les résultats et les dépendances à suivre.

Travaux :

- Corriger les deux types du template qui bloquent TypeScript et configurer ESLint.
- Ajouter les commandes de vérification et un contrôle automatique des changements.
- Organiser les routes dans `src/app/`, conformément aux consignes du projet ; déplacer les routes actuelles et adapter les alias ensemble.
- Structurer les composants, fonctions métier, accès aux données et types en dehors des routes.
- Préparer la configuration par environnement, un exemple de variables publiques et les paramètres de développement.
- Vérifier les modules contre la documentation correspondant au SDK 58 et installer les dépendances compatibles avec Expo.
- Préparer un build de développement et documenter les commandes de lancement.

Livrable : base de projet propre, reproductible et prête pour les écrans Check.

Validation : TypeScript et lint passent ; l’application démarre sur un téléphone Android et la navigation fonctionne.

**3. Préparer les données du répertoire**

État au 23 octobre 2026 : extraction et préparation réalisées. Les 419 lignes automobiles correspondent à 415 numéros distincts ; 85 lignes sont signalées pour revue. Le [rapport de préparation](./PREPARATION_DONNEES.md) explique les écarts, les contrôles et les données restant à valider avant publication.

Travaux :

- Conserver une copie source identifiée par son empreinte, son édition, sa provenance et sa date de réception.
- Relever les 24 grandes familles et les familles détaillées ; conserver leurs codes et leurs libellés d’origine.
- Examiner d’abord un échantillon proposé de 30 à 50 articles automobiles répartis entre batteries, filtres, amortisseurs, huiles et pneus.
- Extraire ensuite le chapitre automobile : pages physiques PDF 491 à 512, avec les tableaux aux pages 492 à 512. Les pages imprimées correspondantes sont 361 à 382.
- Conserver pour chaque ligne le numéro d’article, la famille, la désignation brute, l’unité, PM, LI, LS, la page PDF et la page imprimée.
- Nettoyer les espaces dans les montants, les retours à la ligne et les unités ; conserver la version brute pour chaque transformation.
- Vérifier les doublons, valeurs absentes, montants impossibles, relations entre LI/PM/LS et articles mal classés.
- Mettre les lignes douteuses en attente de revue. Les carburants présentent notamment des prix moyens supérieurs aux deux bornes sur la page PDF 492 ; ces valeurs doivent être vérifiées à la source.
- Documenter les informations manquantes : modèle, motorisation, année, référence constructeur, qualité ou date de validité. Compléter uniquement avec des informations vérifiées.

Livrable : jeu de données structuré, dictionnaire des champs et rapport d’anomalies.

Validation : les 415 articles annoncés sont rapprochés des lignes extraites ; chaque écart est expliqué. Chaque ligne publiée a une source vérifiable. Le fichier PDF n’est pas chargé dans l’application à chaque recherche.

**4. Concevoir les parcours et les maquettes**

Orientation demandée par le porteur du projet : proposer librement une première direction visuelle, puis ajuster les maquettes au ressenti.

Travaux :

- Dessiner les parcours inscription → accès abonné → recherche → fiche → comparaison → résultat.
- Préparer les écrans : accueil, catalogue, recherche et filtres, fiche article, saisie de devis, résultat, historique, compte et abonnement.
- Afficher sur la fiche la désignation, l’unité, la fourchette, le prix moyen, la source, l’édition et la base fiscale.
- Afficher les informations automobiles disponibles et l’état de vérification de la compatibilité avec un véhicule.
- Concevoir les états de chargement, résultat vide, erreur réseau et accès expiré ; définir les actions de reprise.
- Préparer une direction visuelle Check, lisible sur de petits écrans et accessible.

Livrable : maquettes et navigation consultables sur téléphone.

Validation : un utilisateur pilote comprend comment retrouver une pièce et lire le résultat d’une comparaison.

**5. Modéliser une base extensible à toutes les familles**

Travaux :

- Créer une hiérarchie générique de catégories avec un parent, un code et un statut d’activation. L’automobile est le domaine actif du pilote.
- Séparer le produit du catalogue, l’entrée du répertoire et le prix de référence associé à une édition.
- Prévoir une correspondance revue entre une entrée du répertoire et un produit précis ; plusieurs offres peuvent correspondre au même produit.
- Ajouter les caractéristiques automobiles sans les imposer aux meubles, équipements ou autres familles.
- Conserver les unités et conditionnements ainsi que les éventuelles conversions validées.
- Versionner les prix et garder les corrections traçables ; une nouvelle édition du répertoire conserve l’historique des éditions précédentes.
- Prévoir les comptes, organisations, adhésions, droits d’abonnement, devis, lignes de devis et favoris.
- Documenter les modèles futurs des fournisseurs, offres, stocks, commandes et livraisons ; les créer au moment où ces fonctions seront développées.
- Utiliser des montants exacts, une devise explicite, des contraintes de validité et des index adaptés aux recherches.

Livrable : schéma des données, dictionnaire et migrations reproductibles pour les fonctions du pilote.

Validation : le même modèle représente une pièce automobile et un produit d’une autre famille avec leur unité et leur historique de référence.

**6. Mettre en place les comptes et préparer les abonnements**

Travaux :

- Connecter Google Authentication ; prévoir la création du profil, la reprise de session et la déconnexion.
- Reporter l’e-mail/mot de passe et le téléphone/code SMS jusqu’à la configuration du prestataire OTP et des règles de rattachement.
- Mettre en place les organisations et l’appartenance des utilisateurs pour accueillir les premiers assureurs.
- Faire attribuer les droits de fournisseur, assureur et administrateur par un processus contrôlé.
- Vérifier côté serveur l’appartenance à une organisation et le droit d’abonnement actif lors de l’accès aux données protégées.
- Reporter l’abonnement, le paiement et l’activation automatiques : l’outil de paiement, les tarifs, les durées et le canal de distribution ne sont pas encore définis. Les moyens souhaités restent Mobile Money et carte bancaire.
- Activer l’accès après confirmation vérifiée côté serveur ; gérer expiration, renouvellement et révocation. Le mode de renouvellement et les formules professionnelles restent à fixer.
- Traiter les paiements échoués, répétés ou retardés sans double activation ni accès indu ; distinguer ce paiement de celui des futurs produits physiques.
- Prévoir les cas sans abonnement, abonnement expiré, renouvellement échoué et changement d’organisation.
- Protéger les données par des règles d’accès en base. Les clés privilégiées et la validation des paiements restent côté serveur.

Livrable intermédiaire : comptes Google et sessions opérationnels, sans accès commercial activé. Les abonnements seront traités dans une sous-étape ultérieure.

Validation intermédiaire : un utilisateur crée son compte avec Google, retrouve sa session et peut se déconnecter. Aucun paiement ou abonnement simulé n’accorde d’accès.

**7. Créer l’administration du catalogue et publier les données validées**

Le socle Supabase est installé et l’import de référence est chargé en préparation. Il reste à construire l’interface de revue, puis à créer les produits et prix publiables après validation éditoriale.

Travaux :

- Prévoir une interface web pour administrer les catégories, articles, correspondances et éditions de prix.
- Importer les données en zone de préparation, afficher les anomalies et permettre leur revue.
- Séparer les statuts à vérifier, approuvé, publié et retiré, avec auteur et date de décision.
- Journaliser les modifications et préserver le texte source lors des corrections.
- Publier uniquement les références validées et permettre de revenir à l’édition précédente si nécessaire.
- Prévoir un signalement d’erreur depuis l’application et son traitement administratif.

Livrable : administration utilisable et premier catalogue automobile publié.

Validation : l’administrateur peut importer, vérifier, corriger et publier ; rejouer le même import ne crée pas de doublons.

**8. Développer la recherche et les fiches automobiles**

Travaux :

- Relier les écrans mobiles aux données publiées.
- Rechercher par désignation, référence et mots usuels ; gérer les accents, synonymes vérifiés et variantes de saisie.
- Filtrer par catégorie, marque et véhicule lorsque ces informations sont disponibles.
- Paginer côté serveur et mesurer les recherches sur le volume réel de données.
- Afficher sur chaque fiche les informations de référence et leur provenance ; signaler ce qui reste inconnu.
- Ajouter les favoris et un historique personnel utile.
- Définir les règles de cache : date visible et revalidation du droit d’accès ; une donnée mémorisée peut être ancienne.

Livrable : catalogue automobile consultable et recherchable.

Validation : une liste de recherches réelles retrouve les articles attendus ; les erreurs réseau sont distinguées d’une absence de résultat.

**9. Développer la comparaison de devis, avec un premier usage assureur**

État au 24 octobre 2026 : espace assureur bleu préparé localement pour ouvrir des dossiers de sinistre, ajouter plusieurs devis et leurs lignes, comparer les prix à des références compatibles, recommander une offre partenaire moins chère quand son coût livré est inférieur, consigner une décision et une note, attribuer un dossier, consulter l’historique et imprimer un rapport PDF. Les paiements de l’abonnement et de la commande restent hors périmètre. Le code passe le contrôle TypeScript et ESLint ; la migration `20261024112829_insurer_quote_workflow.sql` n’est pas encore appliquée à Supabase.

Travaux :

- Permettre de saisir manuellement une ou plusieurs lignes : article, quantité, unité, prix unitaire, base HT/TTC et caractéristiques pertinentes.
- Demander une confirmation de correspondance lorsque l’article du devis est imprécis.
- Comparer uniquement les données compatibles ; afficher une raison lorsque la comparaison est impossible.
- Calculer l’écart au prix moyen et à la limite supérieure, par ligne et sur les seules lignes comparables.
- Présenter séparément les pièces, prestations et frais de livraison.
- Conserver la version du répertoire et les données utilisées au moment de la comparaison.
- Pour les assureurs pilotes, rattacher un dossier à une organisation, ajouter un commentaire et produire un récapitulatif exportable.

Livrable : comparaison reproductible et dossier consultable par les personnes autorisées.

Validation : les résultats sont corrects sur des cas en dessous, dans et au-dessus de la fourchette, ainsi que sur des devis avec unités différentes, taxe inconnue ou article absent. Une conversion fiscale n’est réalisée qu’avec les informations nécessaires.

**10. Distribuer et valider le pilote de consultation**

Travaux :

- Préparer un environnement de recette et une version installable indépendante du serveur de développement.
- Inviter un petit groupe proposé de particuliers et de collaborateurs d’assureurs, après accord sur les participants.
- Faire exécuter des scénarios de recherche, comparaison, abonnement expiré, erreur réseau et signalement d’article.
- Tester sur les appareils ciblés, y compris avec une connexion lente.
- Vérifier la traçabilité des prix, la protection des dossiers et la restauration des données.
- Mesurer la réussite des recherches, le temps pour vérifier un devis, les articles introuvables et les erreurs signalées.
- Classer les retours, corriger les blocages puis décider l’ouverture commerciale de cette version.

Livrable : pilote de consultation fiable et bilan d’usage.

Validation : un abonné accomplit le parcours inscription, paiement, accès, recherche et comparaison sans assistance ; les retours critiques du pilote sont traités. Le paiement et l’activation automatiques sont opérationnels sur les canaux retenus.

**11. Intégrer les fournisseurs et leurs offres**

État au 24 octobre 2026 : parcours fournisseur préparé localement. L’espace bleu permet de déposer une demande, consulter son statut, gérer les offres associées aux produits publiés, préciser prix, qualité, stock, zone et frais/délais de livraison, puis suspendre une offre ou la renvoyer en vérification. Une administration dédiée approuve les entreprises et examine chaque offre ; les offres approuvées apparaissent sur la page publique et peuvent être proposées dans le résultat de comparaison lorsqu’elles satisfont les critères. Les notes de revue restent privées.

La migration `20261024050258_supplier_marketplace.sql` est appliquée sur le projet Supabase `check-app` (version distante `20261024050258`). Les trois tables fournisseur ont le RLS activé. Les invitations d’équipe et les permissions détaillées attendent la matrice des rôles. Les commandes et leurs paiements restent dans les étapes 12 et 13 ; aucune solution de paiement n’est simulée.

Travaux :

- Finaliser les conventions : informations fournies, fréquence de mise à jour, zones desservies, engagements de préparation et procédure de retour.
- Créer les comptes fournisseurs et leurs équipes autorisées.
- Prévoir un premier chargement par formulaire ou fichier structuré ; ajouter une synchronisation API lorsque le partenaire dispose d’une intégration adaptée.
- Rattacher les références fournisseurs aux produits validés : marque, référence, qualité, conditionnement et compatibilité.
- Stocker séparément le prix proposé, sa base fiscale, la quantité disponible, sa dernière vérification et sa durée de validité.
- Afficher les offres comparables sur les fiches et demander une reconfirmation lorsqu’une offre ou un stock est trop ancien.
- Après une comparaison au-dessus de la fourchette, proposer une offre partenaire moins chère seulement si le produit, la qualité, l’unité et la base fiscale sont comparables et si le prix et le stock sont encore valides. Afficher le fournisseur, la date de mise à jour, le stock, la zone et les frais/délais de livraison ; comparer le coût total. Sans offre vérifiée réellement moins chère, ne rien recommander.
- Garder distincts le prix de référence du répertoire (PM/LI/LS) et le prix commercial proposé par un fournisseur ; aucune disponibilité ou remise n’est déduite du prix de référence.

Livrable : offres fournisseurs visibles, datées et administrables.

Validation : une offre validée peut être retrouvée et comparée ; une offre périmée ou un stock inconnu déclenche une vérification avant commande.

**12. Développer les commandes et le paiement des produits**

Travaux :

- Pour le premier pilote de commerce, proposer une commande auprès d’un fournisseur à la fois.
- Afficher avant confirmation les produits, quantités, taxes applicables, frais de livraison, délai annoncé et total.
- Faire confirmer le stock et réserver la quantité pendant une durée définie.
- Protéger la réservation contre deux commandes simultanées du même stock.
- Conserver dans la commande une copie des désignations, prix, taxes et conditions acceptées.
- Choisir les moyens de paiement selon les partenaires et le canal de vente ; vérifier séparément les règles du parcours d’abonnement numérique.
- Confirmer le paiement côté serveur et traiter plusieurs fois le même retour de paiement sans créer de double commande ni de double attribution.
- Gérer les états en attente, confirmé, échoué, expiré et remboursé, ainsi que la libération du stock et le rapprochement administratif.
- Faire accepter au client toute modification de prix ou de produit avant de poursuivre.

Livrable : commande traçable de la réservation jusqu’à la préparation.

Validation : les scénarios de stock épuisé, paiement refusé, réponse répétée du prestataire et abandon de commande n’entraînent ni survente ni double facturation.

**13. Mettre en place la livraison et le suivi après commande**

Travaux :

- Définir la zone pilote, les partenaires, les frais et les délais annoncés.
- Recueillir l’adresse, le contact et les indications de livraison nécessaires.
- Prévoir une affectation manuelle par l’opérateur au démarrage, avec un accès limité aux informations de la livraison.
- Suivre les étapes préparation, collecte, en cours de livraison, livré, échec et retour.
- Enregistrer une preuve de remise adaptée au service retenu et notifier le client des changements utiles.
- Définir les procédures de produit incompatible, commande incomplète, annulation, retour et remboursement.

Livrable : parcours complet recherche → commande → livraison → traitement d’un incident.

Validation : une livraison réelle de bout en bout et les scénarios d’échec prévus sont correctement suivis avec les partenaires du pilote.

**14. Étendre les usages assureurs et les familles actives**

Travaux :

- Développer les invitations de collaborateurs, rôles d’équipe, circuits de revue et rapports selon les retours des assureurs pilotes.
- Construire des indicateurs à partir des comparaisons enregistrées, en distinguant les écarts constatés des économies effectivement réalisées.
- Étudier la lecture automatique de devis lorsque la saisie manuelle et les règles de comparaison sont stabilisées.
- Choisir la famille suivante d’après la demande, la qualité des références et les fournisseurs disponibles.
- Reprendre le cycle extraction → contrôle → validation → publication → pilote pour cette famille.
- Ajouter ses attributs et unités, puis activer sa navigation et ses offres.

Livrable : une nouvelle famille utilisable dans le même produit et des fonctions professionnelles guidées par l’usage.

Validation : l’ajout d’une catégorie et de ses références ne demande pas de réécrire le fonctionnement du catalogue automobile.

**Ordre des premiers travaux concrets**

1. Écrire les règles et le périmètre du premier pilote.
2. Corriger le socle TypeScript et configurer lint.
3. Extraire et vérifier l’échantillon automobile, puis établir le rapport d’anomalies.
4. Produire les maquettes du parcours principal et le modèle des données.
5. Mettre en place les comptes, l’administration et la publication contrôlée des premiers articles.
6. Livrer recherche → fiche → comparaison avec les droits d’abonnement, puis tester avec les premiers utilisateurs.

Les maquettes et les écrans peuvent avancer avec le jeu d’essai validé pendant la préparation de la base. L’intégration des offres commerciales commence une fois les correspondances produits et la mise à jour du stock définies.

**Points à trancher au cadrage**

- Participants du public mixte retenu et personnes qui vérifieront les articles.
- Tarifs, durée, renouvellement et facturation des accès individuels ou d’organisation, indiqués comme restant à définir par le porteur du projet.
- Prestataires d’authentification et récupération d’accès pour les deux modes retenus : e-mail/mot de passe et téléphone/SMS.
- Canaux de distribution et solutions pour le paiement automatique, avec Mobile Money et carte bancaire comme moyens souhaités.
- Fournisseurs prêts à partager des références précises, un stock et des mises à jour régulières.
- Zone de livraison, partenaires et responsabilités de traitement des retours.
- Validation du backend proposé et des environnements à créer.

**Références de travail**

- Répertoire fourni : `/home/skai/Téléchargements/Repertoire_des_prix_2026.01.pdf` ; guide aux pages physiques PDF 4 et 5 ; chapitre automobile aux pages 491 à 512. Les règles du document sont une source métier à interpréter dans leur contexte.
- [Documentation Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).
- [Documentation Expo pour les agents](https://docs.expo.dev/llms.txt).
- [Supabase avec Expo et React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native).
- [Contrôle d’accès PostgreSQL dans Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Recherche textuelle PostgreSQL dans Supabase](https://supabase.com/docs/guides/database/full-text-search).
- [Journal officiel Supabase](https://supabase.com/changelog).
