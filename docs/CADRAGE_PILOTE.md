**Check — Cadrage du premier pilote**

Version du 23 octobre 2026. Étape 1 du [plan de développement](./PLAN_DEVELOPPEMENT.md).

Ce document rassemble le cahier des besoins, les droits des utilisateurs et les fonctions prioritaires. Les décisions confirmées ci-dessous viennent du porteur du projet ; les règles détaillées constituent une proposition de fonctionnement pour préparer le développement.

**1. Objectif et résultat attendu**

Check aide ses abonnés à vérifier le prix d’un produit et à comprendre les écarts dans un devis. Le lancement concerne les pièces et consommables automobiles ; les autres familles seront ajoutées progressivement. Les assureurs et les particuliers participent au premier pilote.

Le parcours à livrer est : créer son compte → souscrire et payer → obtenir automatiquement l’accès → rechercher un article → consulter sa référence → comparer un devis → conserver le résultat.

Le catalogue et les prix de référence préparent aussi les futurs parcours de comparaison des offres fournisseurs, de commande et de livraison.

**2. Décisions confirmées**

| Sujet | Décision du porteur du projet |
| --- | --- |
| Nom | Check. |
| Couverture | Plusieurs familles à terme, lancement automobile. |
| Public du premier pilote | Groupe mixte : assureurs et particuliers. |
| Connexion au démarrage | Google Authentication uniquement. La connexion par téléphone et code SMS est reportée jusqu'à la configuration du prestataire OTP. |
| Accès au service pour la première version | Abonnement et paiement temporairement hors périmètre ; la connexion Google et le catalogue de préparation sont implémentés en premier. |
| Moyens de paiement souhaités | Mobile Money et carte bancaire ; intégration à définir ultérieurement. |
| Tarifs et durée | Restent à définir, pour les particuliers comme pour les assureurs. |
| Approvisionnement futur | Conventions avec des fournisseurs pour obtenir prix et disponibilités. |
| Commerce futur | Commande de produits et livraison. |
| Première source de prix | Répertoire fourni, version 2026-01. |
| Après un devis au-dessus de la référence | Le porteur souhaite que Check puisse proposer une offre partenaire réellement moins chère, sous réserve d’une correspondance fiable et d’un prix/stock à jour ; cette fonction dépend de l’intégration des fournisseurs (étape 11). |

Les réponses du 23 octobre remplacent la proposition initiale d’une activation manuelle des abonnements pendant le pilote.

**3. Périmètre proposé pour le pilote**

Le pilote couvre la consultation de références automobiles vérifiées, la comparaison de devis et les premiers dossiers d’assureurs. La langue proposée est le français, le pays de référence le Togo et la devise le FCFA/XOF. Android est proposé comme premier appareil de validation ; les canaux de distribution et l’ouverture iOS restent à préciser.

Les catégories de départ à examiner sont les batteries, filtres, huiles et liquides, amortisseurs, courroies, freinage et pneus. La sélection finale dépendra des références suffisamment précises et des besoins des participants. Les prestations et les conditionnements restent identifiés pour permettre une comparaison cohérente.

| Fonctions | Livraison prévue |
| --- | --- |
| Comptes, deux modes de connexion et récupération d’accès | Pilote de consultation. |
| Abonnement, paiement et activation automatiques | Pilote de consultation. |
| Recherche, fiches de référence et comparaison de devis | Pilote de consultation. |
| Historique personnel, premiers dossiers d’assureurs et récapitulatif exportable | Pilote de consultation. |
| Administration des références et traitement des signalements | Pilote de consultation. |
| Offres fournisseurs, stock, commande, paiement des produits et livraison | Livraison suivante, étapes 11 à 13 du plan. |
| Lecture automatique de devis, rapports d’équipe avancés et autres familles | Extensions guidées par les retours du pilote. |

**4. Utilisateurs et contexte d’accès**

Un particulier utilise un compte personnel et conserve ses propres comparaisons.

Un collaborateur d’assureur travaille dans une organisation à laquelle l’administration l’a rattaché. Ses dossiers ont un auteur et une organisation. La fonction de responsable d’organisation est attribuée explicitement ; la sélection d’un profil lors de l’inscription ne donne pas ce droit.

Une personne peut disposer d’un contexte personnel et d’un contexte professionnel. Elle choisit le contexte avant de créer un dossier ; les droits et le propriétaire du dossier restent explicites.

Un administrateur gère les références, les comptes autorisés, les organisations et les incidents de paiement. Les accès au contenu des devis suivent les règles du tableau ci-dessous.

Les fournisseurs et opérateurs de livraison disposeront de droits sur leurs offres ou leurs livraisons lorsque ces fonctions seront développées. Ces fonctions ne leur accordent pas automatiquement un abonnement de consultation.

**5. Tableau des permissions proposé**

Dans le tableau, « personnel » désigne les données appartenant au compte. « Auteur » désigne les dossiers professionnels créés par le collaborateur. « Organisation » désigne les dossiers de la seule organisation dont l’utilisateur est responsable.

Pour une nouvelle consultation ou comparaison, les colonnes Abonné, Collaborateur et Responsable supposent un droit de consultation actif. Dans le contexte professionnel, l’appartenance à l’organisation doit aussi être active. Le mode de facturation des accès professionnels reste à définir.

| Action | Visiteur | Compte sans accès actif | Abonné personnel | Collaborateur assureur | Responsable assureur | Administrateur |
| --- | --- | --- | --- | --- | --- | --- |
| Voir la présentation et les offres d’abonnement | Oui | Oui | Oui | Oui | Oui | Oui |
| S’inscrire, se connecter et récupérer l’accès | Oui | Oui | Oui | Oui | Oui | Oui |
| Gérer son profil et ses identifiants vérifiés | Connexion requise | Personnel | Personnel | Personnel | Personnel | Personnel |
| Souscrire ou renouveler un accès | Connexion requise | Personnel | Personnel | Selon l’offre professionnelle | Selon l’offre professionnelle | Supervision et support |
| Consulter les prix et rechercher de nouvelles références | Non | Non | Oui | Oui | Oui | Catalogue, y compris références en préparation |
| Créer une nouvelle comparaison | Non | Non | Personnel | Auteur, dans son organisation | Dans son organisation | Selon un éventuel droit de consultation distinct |
| Lire un historique existant | Non | Personnel | Personnel | Auteur | Organisation | Pas d’accès au contenu par défaut |
| Exporter un résultat existant | Non | Personnel | Personnel | Auteur | Organisation | Pas d’accès au contenu par défaut |
| Supprimer ou archiver un dossier | Non | Personnel | Personnel | Archivage de ses dossiers professionnels | Archivage dans son organisation | Gestion des métadonnées et du support |
| Signaler une référence incorrecte | Non | Depuis un résultat existant | Oui | Oui | Oui | Traitement |
| Modifier ou publier des références | Non | Non | Non | Non | Non | Oui, avec historique |
| Attribuer une organisation ou une fonction professionnelle | Non | Non | Non | Non | Demande à l’administration pendant le pilote | Oui, avec historique |
| Voir les paiements | Non | Les siens | Les siens | Paiements personnels éventuels | Ceux de son organisation selon l’offre | Suivi et rapprochement |
| Modifier les états de paiement et d’accès | Non | Non | Non | Non | Non | Événements vérifiés et opérations de support tracées |

Un accès expiré permet de relire ses résultats déjà enregistrés ; une nouvelle recherche de prix ou une nouvelle évaluation exige un accès actif. Un collaborateur dont l’appartenance est retirée perd l’accès aux dossiers de l’organisation, même s’il les a créés. Les règles de conservation des dossiers professionnels seront précisées avant le pilote.

Les règles d’accès seront appliquées côté serveur. Le changement d’écran, de contexte ou de rôle affiché dans l’application ne suffit pas à accorder une permission.

**6. Règles des comptes et abonnements**

- Les deux moyens de connexion donnent accès à une même identité de compte lorsqu’ils y ont été rattachés et vérifiés. Le rattachement d’un second identifiant exige une preuve de maîtrise et n’entraîne pas de fusion automatique avec un autre compte.
- Un numéro ou une adresse non vérifié ne permet pas de récupérer l’abonnement d’un autre utilisateur.
- Les informations de souscription indiquent le bénéficiaire, la formule, le prix, la devise, la durée et les conditions de renouvellement avant la confirmation du paiement.
- Le paiement commence dans un état en attente. L’accès est activé après confirmation vérifiée côté serveur, pour la bonne formule et le bon bénéficiaire.
- Le retour à un écran « paiement réussi » ou une capture de paiement ne suffit pas à activer l’accès.
- La répétition d’un même événement de paiement ne prolonge pas plusieurs fois l’abonnement et ne crée pas de second accès.
- Un paiement échoué ou abandonné laisse la souscription inactive. Une confirmation retardée est rapprochée automatiquement, puis l’utilisateur retrouve son état d’accès réel.
- Les dates de début et de fin déterminent la période d’accès ; l’expiration est appliquée automatiquement. Les effets d’un remboursement ou d’une révocation sont traités à partir d’un événement vérifié.
- Le paiement et l’activation automatiques ne fixent pas le mode de renouvellement : renouvellement à la demande ou prélèvement récurrent restent à choisir.
- La facturation professionnelle par utilisateur, par organisation ou avec un nombre d’accès reste à définir. Les dossiers professionnels gardent leur appartenance à l’organisation quel que soit ce choix.

Mobile Money et carte bancaire sont les moyens souhaités. Le choix du prestataire et du parcours doit tenir compte du pays et de la distribution web, Android ou iOS. Les règles actuelles de Google Play et de l’App Store encadrent les achats de services numériques et prévoient des conditions et exceptions selon les canaux. Le parcours d’abonnement sera arrêté sur cette base ; l’achat futur de produits physiques aura son propre parcours de paiement.

**7. Références et règles de comparaison**

Les règles proposées ci-dessous définissent la lecture d’un résultat de Check. Les chiffres du répertoire restent accompagnés de leur source et de leur contexte d’usage.

1. Chaque référence publiée conserve son article, sa famille, son unité, son prix moyen PM, sa limite inférieure LI, sa limite supérieure LS, sa devise, sa base fiscale, son édition et sa page source.
2. Une donnée incohérente ou une correspondance non vérifiée reste en attente de revue ; elle ne produit pas de classement de prix.
3. L’article du devis doit correspondre à l’article de référence sur les caractéristiques nécessaires : marque, référence, qualité, dimensions ou spécifications, et caractéristiques du véhicule lorsque pertinentes. Une information inconnue reste explicitement inconnue.
4. Les prix sont ramenés à une même unité uniquement lorsqu’une conversion est vérifiée. Un prix de paire et un prix de pièce ne sont pas comparés directement.
5. Les prix sont comparés sur la même base HT ou TTC. Un taux de taxe et son applicabilité doivent être connus pour effectuer une conversion ; aucun taux n’est supposé par défaut.
6. Les pièces, prestations et frais de livraison conservent des lignes distinctes. Un prix global sans ventilation peut rester non comparable.
7. Pour une référence validée et comparable : prix inférieur à LI → « En dessous de la fourchette » ; prix compris entre LI et LS incluses → « Dans la fourchette » ; prix supérieur à LS → « Au-dessus de la fourchette ».
8. Lorsque l’identification, l’unité, la base fiscale ou la qualité de la référence est insuffisante, le résultat est « Comparaison impossible » avec la raison et l’information à compléter.
9. Les écarts au PM et à la LS peuvent être affichés en montant et en pourcentage lorsque le dénominateur est valide. Un total de devis porte sur les seules lignes comparables et indique les autres lignes.
10. Le résultat conserve une copie des données utilisées et l’édition de référence. Une nouvelle édition entraîne une nouvelle évaluation datée lorsqu’elle est demandée.

Le libellé « Au-dessus de la fourchette » décrit un écart par rapport à la référence choisie. Le guide du répertoire porte sur l’appréciation de dépenses publiques ; Check affichera cette provenance et le contexte de comparaison. Les règles de plafonnement décrites dans le document ne sont pas transformées en conclusion automatique sur une transaction privée.

**8. Parcours de référence**

**Particulier.** Il s’inscrit par e-mail ou téléphone, vérifie son identifiant, choisit une formule et effectue son paiement. Après confirmation serveur, il recherche un article, vérifie son identification et saisit le prix du devis. Il consulte le résultat, puis retrouve ce dossier dans son historique.

**Assureur.** Le collaborateur est rattaché à l’organisation par l’administration. Une fois son droit de consultation actif selon l’offre souscrite, il crée un dossier professionnel, saisit les lignes du devis et conserve le résultat. Le responsable de cette organisation peut consulter ce dossier ; un utilisateur d’une autre organisation en est exclu.

**Accès expiré.** L’utilisateur consulte ses anciens résultats et les informations de renouvellement. Une nouvelle recherche ou comparaison attend la confirmation d’un nouveau droit actif. L’historique ne récupère pas silencieusement de nouveaux prix.

**Paiement répété ou retardé.** Un même paiement ne produit qu’une activation. En cas de confirmation retardée, le compte affiche l’attente puis se met à jour après rapprochement serveur, sans demander un second paiement à l’utilisateur pour le même achat déjà confirmé.

**9. Exemple de comparaison pour valider la compréhension**

Exemple fictif, pour une pièce identique, une unité, une qualité et une base HT identiques : LI = 8 000 FCFA, PM = 10 000 FCFA, LS = 12 000 FCFA. Le devis propose 30 000 FCFA HT pour une pièce.

Le résultat est « Au-dessus de la fourchette ». L’écart au prix moyen vaut 20 000 FCFA, soit 200 % du PM. L’écart à la limite supérieure vaut 18 000 FCFA, soit 150 % de la LS. Le résultat cite la référence et les hypothèses de correspondance utilisées.

Avec cette même référence, 12 000 FCFA est dans la fourchette. Si le devis est TTC avec une taxe inconnue ou porte sur un jeu de pièces dont le contenu est inconnu, la comparaison est impossible jusqu’à clarification.

**10. Fonctions priorisées**

P0 désigne une condition de lancement du pilote. P1 désigne une amélioration après fonctionnement du parcours principal. Les critères ci-dessous préparent la recette ; leur rédaction ne signifie pas que les fonctions sont déjà développées.

| ID | Priorité | Besoin | Critère de réception |
| --- | --- | --- | --- |
| F01 | P0 | S’inscrire et se connecter par e-mail et mot de passe | Vérification d’e-mail et récupération d’accès opérationnelles. |
| F02 | P0 | S’inscrire et se connecter par téléphone et SMS | Code valide, expiré ou incorrect traité ; renvoi encadré. |
| F03 | P0 | Rattacher les deux identifiants à un compte | Identifiants vérifiés ; abonnement et historique conservés sur la même identité. |
| F04 | P0 | Souscrire et payer avec activation automatique | Confirmation serveur, bénéficiaire, formule et période cohérents ; échec et répétition correctement traités. |
| F05 | P0 | Appliquer les droits et l’expiration | Nouvelle consultation refusée sans droit actif ; historique existant accessible selon son propriétaire. |
| F06 | P0 | Distinguer les comptes personnels et professionnels | Organisation et auteur identifiés ; accès d’une autre organisation refusé. |
| F07 | P0 | Préparer et publier les références | Lignes revues, anomalies en attente et provenance conservée. |
| F08 | P0 | Rechercher les articles automobiles | Recherches du pilote réussies avec filtres disponibles et résultats paginés. |
| F09 | P0 | Lire une fiche article fiable | Unité, qualité connue, fourchette, source, édition et base fiscale visibles. |
| F10 | P0 | Saisir et comparer un devis | Plusieurs lignes possibles ; classement et calculs respectent les règles de comparaison. |
| F11 | P0 | Conserver et exporter le résultat | Copie des données utilisées, auteur, contexte et date conservés. |
| F12 | P0 | Administrer les comptes et références | Actions autorisées et modifications tracées ; contenu des dossiers protégé. |
| F13 | P0 | Reprendre après erreur et signaler une anomalie | Une panne réseau est distinguée d’un résultat vide ; signalement accessible et traitable. |
| F14 | P1 | Accéder rapidement aux articles utiles | Favoris et recherches récentes. |
| F15 | P1 | Améliorer la recherche à partir des retours | Synonymes vérifiés et termes introuvables pris en compte. |
| F16 | Livraison suivante | Recevoir une offre partenaire moins chère après comparaison, puis acheter | Offre réellement moins chère sur le coût total, article/unité/qualité/base compatibles, prix et stock à jour ; commande, paiement et livraison suivis. |
| F17 | Extensions | Étendre les usages professionnels et le catalogue | Retours du pilote exploités pour les équipes, la lecture de devis et les autres familles. |

**11. Critères de réussite du pilote**

- Un particulier et un collaborateur d’assureur accomplissent le parcours inscription, paiement, accès, recherche et comparaison.
- Les deux modes de connexion fonctionnent et peuvent être rattachés à une même identité vérifiée.
- Les paiements autorisés sur les canaux retenus déclenchent l’accès automatiquement ; les cas échoués, répétés et retardés sont traités.
- Chaque référence consultable et chaque résultat exporté conserve une provenance vérifiable.
- Les cas de comparaison dans la fourchette, au-dessus, en dessous et impossible sont compréhensibles et corrects.
- Les droits sont respectés entre comptes et entre organisations, y compris après expiration ou retrait d’un collaborateur.
- Les recherches introuvables, erreurs de données et difficultés d’usage sont relevées pour préparer la livraison suivante.

Le nombre de participants, la durée d’observation et les objectifs chiffrés de réussite seront fixés avec les personnes retenues. Aucun assureur ou fournisseur n’est considéré comme engagé sur la seule base de ce cadrage.

**12. Décisions encore ouvertes et prochaines actions**

| Décision | État | Moment nécessaire |
| --- | --- | --- |
| Tarif, durée et renouvellement de l’offre particulière | Le porteur du projet indique que cela reste à définir. | Avant paramétrage commercial et paiements réels. |
| Facturation des assureurs et nombre d’accès | À définir : utilisateur, organisation ou autre formule. | Avant paramétrage de l’offre professionnelle. |
| Prestataires de paiement et parcours par canal | Moyens souhaités confirmés : Mobile Money et carte. Choix d’intégration ouvert. | Avant intégration du paiement. |
| Prestataire SMS et envoi des e-mails | Deux modes de connexion confirmés ; prestataires à sélectionner. | Avant intégration de l’authentification et envois réels. |
| Distribution web, Android et iOS | Proposition : Android comme premier appareil de validation. | Avant choix définitif du parcours d’achat numérique. |
| Pays, langue et devise | Propositions : Togo, français, FCFA/XOF. | Avant publication du catalogue pilote. |
| Participants et références prioritaires | Public mixte confirmé ; personnes et articles précis à sélectionner. | Avant échantillon et recette du pilote. |
| Gestion des dossiers professionnels | Conservation, archivage et règles d’export à préciser avec les assureurs pilotes. | Avant utilisation de dossiers réels. |

La prochaine étape technique est la stabilisation du projet Expo, étape 2 du plan. La préparation des données et des maquettes pourra ensuite s’appuyer sur ce cadrage. Les décisions ouvertes sur les tarifs et prestataires peuvent avancer pendant ces travaux ; elles doivent être réglées avant leur intégration commerciale.

**Sources et traçabilité**

- Besoins et réponses du porteur du projet dans la conversation, dont les choix du 23 octobre 2026 : public mixte, deux modes de connexion, paiement et activation automatiques, Mobile Money et carte, tarifs et durée à définir.
- [Plan de développement](./PLAN_DEVELOPPEMENT.md).
- Répertoire fourni : `/home/skai/Téléchargements/Repertoire_des_prix_2026.01.pdf` ; guide aux pages physiques PDF 4 et 5. Les indications du document constituent une source métier, dont le contexte est conservé.
- [Paiements et abonnements sur Google Play](https://support.google.com/googleplay/android-developer/answer/9858738?hl=fr), consulté le 23 octobre 2026.
- [App Store Review Guidelines, section 3.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), consulté le 23 octobre 2026.
- [Achats intégrés dans Expo](https://docs.expo.dev/guides/in-app-purchases/), consulté le 23 octobre 2026.
