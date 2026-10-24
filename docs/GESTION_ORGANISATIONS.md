# Gestion des organisations assureur

Les organisations assureur disposent d’un nom, d’un e-mail de contact, d’un téléphone, d’une ville et d’une couleur d’accent prédéfinie. Le bleu reste la palette par défaut.

Un responsable peut créer un lien d’invitation nominatif. Le lien expire au bout de sept jours, n’est conservé en base que sous forme hachée et ne peut être accepté que par le compte Google dont l’adresse correspond à l’invitation. Il peut être révoqué avant son utilisation. Pour le pilote, le responsable partage le lien manuellement : l’envoi automatique d’e-mails attend le choix et la configuration d’un service SMTP.

Les rôles existants restent `manager` et `member`. Un responsable peut désactiver ou réactiver l’accès d’un membre. La base protège le dernier responsable actif. Les permissions détaillées par dossier, la délégation de tâches et les changements de rôle sont à définir avec l’équipe avant leur implémentation.

La migration correspondante est `20261024113000_insurer_organization_settings_and_invitations.sql`; le durcissement de concurrence est dans `20261024114000_harden_insurer_membership_changes.sql`.


## Dossiers professionnels

Un dossier représente un sinistre et peut contenir plusieurs devis de concessionnaires. Chaque devis garde son fournisseur, sa référence, sa date et les lignes de pièces. Les lignes peuvent être associées à une référence du catalogue ; une comparaison conserve les prix et la source utilisés au moment du calcul.

Le responsable voit tous les dossiers de son organisation et peut attribuer un dossier à un membre actif. Un collaborateur voit les dossiers qu'il a créés et ceux qui lui sont attribués. Une décision (devis retenu et note) et les événements importants apparaissent dans l'historique. L'export web utilise la fonction d'impression du navigateur pour enregistrer un PDF.

Les paiements et les commandes entre assureur et concessionnaire restent hors périmètre. Tant que l'abonnement n'est pas configuré, les membres actifs des organisations assureur disposent d'un accès pilote au catalogue et aux dossiers ; les accès personnels restent soumis aux abonnements.

Le schéma applicatif est préparé dans `20261024112829_insurer_quote_workflow.sql`. L'application de cette migration distante attend encore une autorisation spécifique après la revue automatique.
