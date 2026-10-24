# Authentification Google

## État actuel

Google Authentication est activée sur le web uniquement. La connexion par SMS et les callbacks mobiles restent désactivés. Le catalogue et les prix de référence restent publics pendant le pilote ; un compte connecté ne peut modifier les prix que s’il possède le rôle d’administration correspondant dans Supabase.

## Parcours prévu

La première version de Check utilise Google Authentication avec Supabase Auth.

## Configuration Supabase

Dans le tableau de bord Supabase, activer le fournisseur **Google** et renseigner les identifiants OAuth Google. Utiliser comme callback du fournisseur Google :

```text
https://nhdwiuukewfofaexbxmi.supabase.co/auth/v1/callback
```

Ajouter ensuite les URL de redirection de l’application dans Supabase Auth. Pour le serveur web local habituel :

```text
http://localhost:8083/auth/callback
```

Le code web redirige vers l’origine actuellement ouverte, avec le chemin `/auth/callback`. Si le port local ou le nom d’hôte change, ajoute également l’URL exacte correspondante dans la liste d’autorisation. Pour accéder au site depuis un autre appareil du réseau, remplace `localhost` par l’adresse IP de l’ordinateur qui exécute Expo.

La **Site URL** Supabase doit être l’origine web du site (en local, `http://localhost:8083`; en production, le domaine web définitif). Le flux de connexion fournit explicitement son URL de retour, `.../auth/callback`.

Dans Google Cloud Console, ajouter l’origine JavaScript du site web (en local, `http://localhost:8083`, puis le domaine de production). L’URI de redirection autorisée du client Google reste uniquement le callback Supabase indiqué ci-dessus. Ce callback Google n’est pas l’URL `/auth/callback` de l’application.

## Configuration locale

`.env.local` contient uniquement l’URL Supabase et la clé publishable. Elle ne doit jamais contenir une clé `service_role`.

La connexion par téléphone et code SMS est volontairement désactivée. Elle sera ajoutée après le choix et la configuration du prestataire OTP. L’authentification mobile Expo Go reste reportée.

Les abonnements, le paiement Mobile Money et la carte bancaire sont également reportés. Aucun accès commercial n’est activé par cette première intégration.
