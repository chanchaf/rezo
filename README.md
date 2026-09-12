# REZO — Rencontres par activité, groupées, en temps réel

MVP d'une app qui permet d'organiser et de rejoindre des rencontres humaines
groupées par activité (sport, culture, musique, jeux, bien-être, food...) dans
une zone géographique, avec validation par l'organisateur, chat de groupe,
avis, et suivi de trajet privé le jour J.

Ce projet a été prototypé comme **artefact Claude** (React exécuté dans
Claude.ai) puis exporté ici en projet **Vite + React** standard pour
poursuivre le développement dans VS Code et le publier sur GitHub.

## Démarrage rapide

```bash
cp .env.example .env.local   # renseigner la config Firebase du projet (voir plus bas)
npm install
npm run dev    # lance l'app (Vite, :5173) ET le backend push/verify/digest (:8787) ensemble
npm run seed   # optionnel : amorce le flux avec ~15 rencontres de démarrage
```

Ouvre ensuite [http://localhost:5173](http://localhost:5173). `npm run dev`
lance les deux services en parallèle (voir section suivante) ; pour les
lancer séparément, `npm run dev:client` (Vite seul) et `npm run server`
(backend seul) restent disponibles. Sans `.env.local`, l'app démarre quand
même grâce à des valeurs Firebase par défaut codées en dur (config du projet
de développement) — pratique pour tester vite, mais chacun devrait avoir son
propre projet Firebase en pointant `.env.local` dessus dès que plusieurs
personnes travaillent dessus.

```bash
npm run build      # build de production dans dist/
npm run preview    # prévisualiser le build de production
```

## Architecture actuelle

- `src/App.jsx` — l'app entière (un seul composant `RezoApp` + quelques
  sous-composants `Avatar`, `StarDisplay`, `StarPicker`, `CreateModal`).
  C'est un fichier volumineux (~2500 lignes) hérité du prototype artefact ;
  voir "Prochaines étapes" ci-dessous pour le découpage recommandé.
- `src/lib/storagePolyfill.js` — **le point le plus important à comprendre
  avant de continuer le développement.** Voir la section suivante.
- `src/lib/firebase.js` / `server/firebaseClient.js` — initialisation
  Firebase côté client et côté serveur (même config, deux endroits car deux
  runtimes différents).
- `server/index.js` — backend "opérations privilégiées" : notifications
  push, vérification téléphone, résumé hebdomadaire (voir ci-dessous).
- `server/weeklyDigest.js` — logique du résumé hebdomadaire (voir "Créer
  l'habitude de revenir" plus bas).
- `src/lib/push.js` / `public/sw.js` — abonnement et réception des
  notifications push côté client.
- `src/lib/verify.js` — vérification de numéro de téléphone (badge
  "Vérifié") côté client, réutilisé tel quel par la landing page web.
- `src/Landing.jsx` / `src/WebAuth.jsx` / `src/lib/device.js` /
  `src/lib/webAuth.js` — landing page web et son écran de connexion dédié,
  totalement isolés de `App.jsx` (voir section dédiée ci-dessous).
- `src/main.jsx` / `src/index.css` / `index.html` — bootstrap standard Vite,
  et depuis peu le point d'entrée qui choisit entre l'app mobile et la
  landing page web (voir section dédiée ci-dessous).

## Landing page web (visiteurs desktop non connectés)

`App.jsx` — le composant de l'app mobile — reste **strictement intact** :
contrainte produit explicite, aucune ligne n'y a été touchée pour ajouter ce
qui suit. Toute la logique d'aiguillage vit dans `src/main.jsx`, le seul
point d'entrée modifié :

- **Visiteur sur mobile** (détecté par user-agent, voir `src/lib/device.js`
  — volontairement pas par largeur de fenêtre, pour qu'une fenêtre desktop
  redimensionnée en étroit reste sur le web) **OU déjà connecté** (n'importe
  quel appareil, via la même session `localStorage` que l'app lit
  normalement) → l'app mobile existante. En dessous de 768px de large,
  rendu strictement inchangé ; au-dessus (visiteur connecté sur desktop),
  l'app bascule vers une mise en page desktop dédiée — voir "App connectée
  sur grand écran" ci-dessous — qui a remplacé l'ancien cadre "smartphone".
- **Visiteur desktop non connecté** → `src/Landing.jsx` (page marketing :
  header, hero avec captures d'écran réelles de l'app — voir
  `public/landing/*.png`, capturées via Playwright, pas le composant React
  lui-même — comment ça marche, cas d'usage, confiance/sécurité, carrousel,
  FAQ, footer), puis `src/WebAuth.jsx` si iel choisit de se connecter/s'inscrire.

**Pourquoi `src/lib/webAuth.js` duplique une partie de `App.jsx` plutôt que
de la réutiliser :** `hashPassword`, le registre `accounts`, et les clés
localStorage écrites à la connexion existent déjà dans `App.jsx`, mais n'en
sont pas exportés — et la contrainte "aucune modification à `App.jsx`"
interdit d'ajouter ne serait-ce qu'un `export`. `webAuth.js` réimplémente
donc cette petite partie (même algorithme de hash, même forme de compte)
pour qu'un compte créé/connecté depuis le web soit repris correctement par
`App.jsx` — le point de handoff est un simple `window.location.reload()`
après avoir posé la session dans localStorage : App.jsx la lit à son
montage exactement comme pour un retour de visite normal, sans aucun code
partagé entre les deux. ⚠️ Les deux copies doivent rester équivalentes si la
logique change d'un côté (voir le commentaire en tête de `webAuth.js`).

La classe `rezo-mode-app`, posée sur `<body>` par `main.jsx` pendant le rendu
(pas un effet, pour éviter tout flash) plutôt qu'un sélecteur `:has()`
(support navigateur plus incertain), sert à cibler l'app mobile depuis
`index.css` sans jamais affecter la landing/l'écran de connexion web, qui
doivent rester plein écran.

## App connectée sur grand écran (≥768px)

En dessous de 768px, aucune des règles ci-dessous ne s'applique : c'est le
rendu mobile actuel, à l'identique (vérifié par un test automatisé qui
compare le CSS calculé — `display:flex`, hauteur de nav 64px, disposition
en ligne — entre avant et après ce travail, sur un vrai user-agent mobile).
Au-dessus de 768px, `App.jsx` bascule vers une mise en page desktop, gérée
entièrement par des `@media (min-width: 768px)` dans son propre `<style>` :

- **Plus de cadre "smartphone"** (`src/index.css`) : l'app occupe toute la
  largeur utile, centrée, avec un maximum de 1400px.
- **Barre de navigation du bas → sidebar fixe à gauche** : `.rezo-app`
  passe de `display:flex` (colonne) à `display:grid` avec
  `grid-template-areas: "nav header" "nav scroll"` — la nav (mêmes boutons,
  mêmes handlers, aucun changement de comportement) est simplement
  réassignée à la zone "nav" et restylée en colonne plutôt que ligne. La
  grille assure nativement que la sidebar reste visible pendant que le
  contenu défile dans sa propre zone.
- **Grille multi-colonnes** : `.rezo-grid` était déjà en
  `display:grid; grid-template-columns: repeat(auto-fill, minmax(...))` —
  il suffisait de ne plus contraindre son conteneur à ~380px de large pour
  qu'elle affiche 2-3 cartes par ligne automatiquement.
- **Page de profil en deux colonnes** : `.profile-page-body` regroupe
  désormais ses enfants dans deux wrappers `.profile-left-col` /
  `.profile-right-col` (aucun style par défaut, donc invisibles/sans effet
  en dessous de 768px) qui deviennent les deux colonnes d'une grille
  35fr/65fr au-dessus. ⚠️ Utiliser `fr` et pas `%` pour ces colonnes : des
  colonnes en `%` qui totalisent 100% ignorent `column-gap` (la gouttière
  s'ajoute par-dessus et déborde silencieusement, caché par
  `overflow:hidden` sur `.rezo-app`) — piège CSS Grid classique rencontré et
  corrigé pendant ce travail.
- **Effets de survol** : ajoutés sous
  `@media (min-width: 768px) and (hover: hover) and (pointer: fine)` plutôt
  que juste `min-width`, pour ne jamais se déclencher sur un écran tactile
  large (grande tablette, etc.).

Après connexion/inscription, un compte fraîchement créé depuis le web
atterrit sur le flux normal de l'app plutôt que sur la modale "Ton profil"
immédiatement (contrairement au flux mobile qui l'ouvre tout de suite) — dès
qu'iel touche l'onglet Profil ou tente de créer/rejoindre une rencontre, la
même modale de complétion de profil (100% inchangée) s'ouvre normalement.
Léger compromis d'UX (un tap de plus) accepté en échange de l'isolation
totale demandée.

## À propos du stockage des données

Dans l'artefact Claude d'origine, `window.storage` est une API fournie
nativement par la plateforme : elle persiste les données côté serveur et les
synchronise en temps quasi réel entre **tous les utilisateurs** qui ouvrent
l'artefact (mode `shared: true`) ou juste pour l'utilisateur courant (mode
`shared: false`, ex. le pseudo, le sexe, l'avatar).

Ce projet ne dépend d'aucun backend spécifique à Claude : `src/App.jsx`
utilise uniquement `window.storage.get/set/delete/list`, une API très simple.
`src/lib/storagePolyfill.js` réimplémente cette même API avec **deux
backends différents** selon `shared` :

- **`shared: false`** (données propres à cet appareil : session, cache local
  du profil) → `localStorage`, comme avant.
- **`shared: true`** (rencontres, comptes, profils, chat) → **Firestore**,
  lu/écrit **directement depuis le client** (pas de serveur à faire tourner
  pour ça). Chaque clé devient un document dans la collection `kv`
  (`{ value: ... }`), même forme que l'ancien backend Express — juste un
  hébergeur différent. Résultat : **les rencontres, comptes et chats sont
  réellement visibles entre appareils différents**, géré par Firebase, sans
  rien déployer soi-même.

Le petit serveur Express (`server/index.js`, lancé par `npm run server` /
`npm run dev`) n'est donc plus nécessaire pour l'usage de base de l'app
(créer un compte, une rencontre, discuter) — seulement pour les
fonctionnalités qui doivent rester côté serveur : notifications push,
vérification téléphone, résumé hebdomadaire planifié (voir "Créer l'habitude
de revenir" plus bas). Il lit/écrit dans la MÊME collection Firestore via
`server/firebaseClient.js`.

### Configurer Firebase

1. Créer un projet sur la [Console Firebase](https://console.firebase.google.com)
   et y activer **Firestore Database** (mode test, ou avec les règles
   ci-dessous).
2. Récupérer la config web (Paramètres du projet → Général → Vos
   applications → Config SDK) et la coller dans `.env.local`
   (voir `.env.example`).
3. **Activer Authentication → Sign-in method → Anonymous.** ⚠️ Étape
   obligatoire, sans quoi toute lecture/écriture échoue avec
   `auth/configuration-not-found` (Authentication jamais activé pour le
   projet) ou `permission-denied` (activé mais le fournisseur Anonymous ne
   l'est pas) — voir le point 4 ci-dessous, les règles exigent désormais une
   session authentifiée.
4. Dans Firestore Database → Règles :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

   `request.auth != null` est satisfait par l'authentification **anonyme**
   Firebase (voir `authReady` dans `src/lib/firebase.js`, appelée
   automatiquement au démarrage, invisible pour l'utilisateur) — un verrou
   technique contre les robots/scripts externes qui liraient/écriraient
   directement sans passer par l'app, pas une vraie identité utilisateur
   (voir "Compte et profil" pour la vraie authentification téléphone/e-mail,
   entièrement indépendante). Les données elles-mêmes restent lisibles/
   modifiables par n'importe quel utilisateur authentifié anonymement — pas
   de règles par-utilisateur avant une vraie mise en production.

   ⚠️ Tout appel Firestore doit `await authReady` avant de lire/écrire (voir
   `storagePolyfill.js` et `server/firebaseClient.js`) — y compris
   `src/lib/webAuth.js`, qui appelle Firestore directement (sans passer par
   le polyfill) et l'oubliait initialement : la connexion/inscription web
   pouvait alors se figer silencieusement (ni succès ni message d'erreur) en
   cas de course entre l'écriture du compte et la fin de l'authentification
   anonyme. Corrigé en ajoutant le même `await authReady` dans
   `loadAccounts`/`saveAccounts` de `webAuth.js`.

Sans `.env.local`, l'app utilise une config Firebase par défaut codée en dur
(le projet de développement d'origine) — pratique pour un premier essai,
mais à remplacer par votre propre projet dès que vous continuez ce travail.

## Compte et profil

Avant de pouvoir créer/rejoindre une rencontre, discuter, inviter ou noter,
l'utilisateur doit :

1. **S'authentifier**, via deux écrans dédiés — **Connexion** et **Créez
   votre compte** — reprenant la même palette claire que le reste de l'app
   (fond blanc `#FFFFFF`, champs gris très clair `#F5F5F7`/`#F0F2F5`, accent
   bleu `#1877F2` déjà utilisé pour le bouton "+" et les éléments actifs de
   la barre de navigation), identiques en structure sur mobile (`App.jsx`,
   classe `.modal-auth-dark` — nom conservé mais valeurs désormais claires,
   voir son commentaire) et sur web (`WebAuth.jsx`, mêmes classes
   `.webauth-*` dupliquées avec les mêmes couleurs — contrainte d'isolation
   totale entre les deux fichiers, voir plus haut). Une première version
   reprenait un thème sombre/turquoise inspiré d'une maquette de référence
   externe, remplacé depuis pour rester cohérent visuellement avec le reste
   de l'app :
   - **Connexion** : e-mail + mot de passe, lien "Mot de passe oublié ?",
     puis Google/Facebook en repli.
   - **Créez votre compte** : nom + prénom (obligatoires), e-mail, mot de
     passe (règle affichée : au moins 8 caractères, 1 lettre, 1 chiffre) +
     confirmation, numéro de téléphone (visible mais facultatif et non
     vérifié tant que `PHONE_AUTH_ENABLED` est à `false`, voir plus bas),
     case à cocher obligatoire (conditions générales + politique de
     confidentialité, liens cliquables) et case optionnelle (e-mails
     marketing), puis Google/Facebook en repli.

   Portes d'entrée disponibles derrière ces deux écrans :
   - **Téléphone** (méthode principale à terme) : préfixe pays (drapeau,
     présélectionné via géolocalisation IP) + numéro, puis code reçu par SMS
     ou WhatsApp. Réutilise le flux de vérification déjà en place pour le
     badge "Vérifié" (voir plus bas) — le numéro complet sert lui-même
     d'identifiant de compte. ⚠️ Aucun fournisseur SMS/WhatsApp réel n'est
     branché : le code est affiché directement à l'écran ("code de
     démonstration"), comme pour la vérification de téléphone dans
     "Modifier le profil".

     🔒 **Retiré temporairement de l'écran de connexion/inscription**
     (mobile et web) derrière `PHONE_AUTH_ENABLED = false` dans
     `src/lib/config.js` — un seul flag partagé, importé à la fois par
     `App.jsx` et `WebAuth.jsx`, pour ne jamais l'oublier activé d'un côté
     et pas l'autre. L'envoi réel de SMS nécessiterait le plan payant
     Firebase Blaze, pas encore activé. Tout le code (champ pays/téléphone,
     `requestPhoneAuthCode`/`confirmPhoneAuthCode`,
     `submitPhoneRequest`/`submitPhoneConfirm`) reste intact — repasser ce
     seul flag à `true` réactive le téléphone des deux côtés, sans rien
     reconstruire. En attendant, l'écran ne propose que Google/Facebook/
     e-mail.
   - **E-mail + mot de passe** : entièrement réel dans les limites d'un
     prototype — mot de passe haché côté client via
     `crypto.subtle.digest('SHA-256', …)` avant stockage dans le registre
     partagé `accounts` (`window.storage`, `shared: true`) (voir
     `hashPassword`/`isPasswordStrongEnough` dans `App.jsx`). Chaque compte
     stocke aussi `name`/`lastName`/`phone`/`acceptedMarketing`, capturés dès
     l'inscription plutôt qu'à l'étape suivante de complétion de profil.
   - **Google / Facebook** : vraie connexion via `signInWithPopup` (Firebase
     Auth), voir `handleOAuthLogin` dans `App.jsx` et `WebAuth.jsx` (web,
     via `syncOAuthAccount` dans `src/lib/webAuth.js`). L'e-mail renvoyé par
     le fournisseur sert de clé dans le même registre partagé `accounts` que
     la connexion e-mail/mot de passe : un compte Google/Facebook et un
     compte e-mail avec la même adresse sont donc unifiés. Si un compte
     existe déjà pour cet e-mail avec un profil complet (nom, genre,
     activités), connexion directe à l'app ; sinon, le compte est créé
     (prérempli avec le nom et la photo du fournisseur) et enchaîne sur
     l'écran de complétion de profil déjà existant. Erreurs gérées avec des
     messages clairs (popup bloquée par le navigateur, adresse déjà liée à un
     autre mode de connexion, domaine non autorisé, fournisseur pas encore
     activé côté Firebase…) — une fermeture volontaire de la popup par
     l'utilisateur n'affiche rien.

     ⚠️ **Configuration manuelle requise côté Firebase** (impossible à faire
     depuis ce dépôt) : dans la console Firebase → Authentication → Sign-in
     method, activer les fournisseurs **Google** et **Facebook**. Google
     fonctionne dès l'activation (Firebase gère son propre client OAuth).
     Facebook nécessite en plus une vraie application Meta for Developers
     (developers.facebook.com) avec son App ID + App Secret collés dans la
     console Firebase, et l'URI de redirection OAuth
     `https://<project-id>.firebaseapp.com/__/auth/handler` ajoutée dans les
     paramètres de l'app Facebook. Sans cette configuration, le clic échoue
     proprement avec le message "Ce mode de connexion n'est pas encore
     activé côté Firebase" plutôt qu'un crash. Penser aussi à ajouter
     `rezomeet.com` (et tout autre domaine de déploiement) aux "Authorized
     domains" de Firebase Authentication.

     Idem pour "Mot de passe oublié ?" et les liens légaux (reCAPTCHA,
     politique de confidentialité, conditions d'utilisation) : aucune vraie
     page/flux derrière pour l'instant.
2. **Remplir son profil** : prénom, nom, sexe, pays (présélectionné via
   géolocalisation IP, repli sur le Maroc), ville, activités préférées, photo
   optionnelle. Cette étape est obligatoire et s'enchaîne automatiquement
   après l'inscription ou la connexion.

   Seul le **prénom** est affiché publiquement (cartes, avatars, chat) — le
   nom de famille reste une donnée de profil privée, sauf si l'utilisateur
   coche explicitement "Afficher mon nom publiquement". Dans ce cas, il est
   ajouté au registre partagé `public-lastnames` (prénom → nom), consulté
   uniquement pour compléter la ligne "Organisé par …" des cartes. La ville
   suit exactement la même logique via `public-cities` (bascule "Afficher ma
   ville" dans Paramètres → Confidentialité).

**Page de profil** : l'onglet "Profil" de la barre du bas ouvre une vraie page
(pas une modale) — couverture, photo circulaire, badge "Vérifié" (numéro
confirmé), note moyenne d'organisateur, ville/pays, trois statistiques
cliquables (rencontres organisées/terminées, note moyenne — toutes calculées
uniquement sur des rencontres **clôturées**, jamais sur une simple
inscription), bio, tags d'activités colorés, badges/succès débloqués selon
l'historique réel, et un aperçu de l'historique qui renvoie vers "Mes
sorties". L'icône ⚙️ en haut à droite ouvre les Paramètres (modifier le
profil, notifications, confidentialité, déconnexion) — modifier le profil
reste le seul endroit où nom/prénom/photo/couverture/ville/sexe/activités/bio
sont édités.

Les comptes sont `shared: true`, donc stockés dans Firestore et bien
synchronisés entre appareils (voir "À propos du stockage des données"
ci-dessus) — se connecter depuis un autre appareil avec le même e-mail/mot
de passe restaure le profil complet.

⚠️ Le hachage du mot de passe reste fait **côté client** (`crypto.subtle`)
avant envoi au serveur : ça évite de stocker le mot de passe en clair, mais ce
n'est pas une vraie authentification serveur (pas de limitation du
brute-force, pas de reset de mot de passe, pas de session/token signé). C'est
un prototype d'écran d'auth ; **avant toute mise en production**, le
remplacer par une vraie authentification serveur (Firebase Auth, Supabase
Auth, NextAuth, etc.) qui hache et vérifie les mots de passe côté serveur.

## Langue et RTL

Sélecteur de langue (drapeau + code, ex: 🇫🇷 FR) discret en haut de l'écran de
connexion, et dans Profil → Paramètres → Langue une fois connecté. Trois
langues : **Français** (référence), **Anglais**, **Arabe** (RTL).

- **Détection** : langue du navigateur au premier lancement (repli français
  si non supportée) — voir `detectBrowserLanguage()` dans `src/lib/i18n.js`.
- **Persistance** : par appareil (`rezo-language`) tant qu'aucun compte n'est
  connecté ; synchronisée dans le compte (`accounts[id].language`) dès la
  connexion, pour retrouver la même langue sur tous ses appareils — voir
  `setLanguage()` dans `App.jsx`.
- **RTL réel, pas juste des mots inversés** : l'attribut `dir="rtl"` posé sur
  `.rezo-app` inverse nativement le texte, la ponctuation et l'ordre des
  listes, et les conteneurs `flex-direction: row` (utilisés partout dans
  l'app) suivent aussi l'axe d'écriture — donc l'essentiel de la mise en page
  s'inverse sans code supplémentaire. Les endroits câblés en position/marge
  physique (`left`/`right`, icônes de navigation "retour") ont des overrides
  `[dir="rtl"]` dédiés, regroupés en bas du bloc `<style>` de `App.jsx`.
- **Ce qui n'est jamais traduit** : le contenu créé par les utilisateurs
  (titres de rencontre, notes, messages de chat, avis) — uniquement
  l'interface elle-même (boutons, libellés, toasts, catégories d'activité,
  sexe, type de rencontre...).
- **Couverture actuelle** : très large (navigation, authentification,
  cartes de rencontre, création/édition, page de profil, paramètres, les 5
  fenêtres de confirmation, chat, suivi de trajet) mais pas exhaustive à
  100 % — quelques recoins secondaires restent en français par défaut :
  les modèles de démarrage rapide ("Foot ce soir"...), le sélecteur de
  position de test (outil de dev), et le texte du message d'invitation
  partagé. Dictionnaire dans `src/lib/i18n.js` (clé → FR/EN/AR) ;
  `translate()` retombe sur le français si une clé manque dans une langue.

## Adresses géolocalisées (autocomplétion + tri par distance)

À la création d'une rencontre, les champs **Zone géographique** et **Lieu
précis** proposent une autocomplétion façon barre de recherche Google Maps :
dès 3 caractères tapés, une liste de suggestions (icône pin + nom + ville)
se met à jour au fil de la frappe, débounce 450 ms — voir `useGeoSuggest` et
`toGeoSuggestion` dans `App.jsx`. Sélectionner une suggestion remplit le
champ **et** capture ses coordonnées GPS exactes en arrière-plan, sans que
l'organisateur ait besoin d'activer sa propre position ni d'être
physiquement sur les lieux au moment de la création (utile pour planifier à
l'avance un lieu où l'on ne se trouve pas encore).

- **Service utilisé : Nominatim (OpenStreetMap)**, gratuit et sans clé API —
  cohérent avec le choix déjà fait pour "Voir sur la carte" (lien Google
  Maps sans clé). Alternative envisagée : Google Places Autocomplete, plus
  riche mais nécessitant un compte Google Cloud avec facturation active ;
  écarté pour rester sans configuration côté serveur. L'attribution "©
  contributeurs OpenStreetMap" affichée sous la liste de suggestions est une
  exigence de leur politique d'usage, à ne pas retirer.
- **Priorité des coordonnées** à la création : lieu précis choisi via
  autocomplétion (le plus fin) > zone choisie via autocomplétion > case
  "épingler ma position actuelle" (dépend d'être sur place) > aucune,
  laissant la rencontre en texte libre non géolocalisé comme avant.
- **Tri par distance réelle** : une fois "📍 Activités proches de moi"
  activé, chaque rencontre géolocalisée affiche sa distance réelle
  (`formatDistance`, ex. "850 m" / "1.2 km") et le flux se trie par distance
  croissante au sein de chaque groupe d'activité (`byDistanceThenDate`) — les
  rencontres sans coordonnées précises restent visibles, triées après, par
  ville puis date comme aujourd'hui. Ce n'est pas un mécanisme nouveau : il
  existait déjà pour le lien "Voir sur la carte" et "Mon trajet" ; l'ajout
  ici est la source de données (des coordonnées fiables dès la création) qui
  lui manquait, pas le calcul de distance lui-même.

## Éviter la "ville fantôme" (flux vide au lancement)

Un flux vide est le pire ennemi de la rétention sur ce type d'app. Trois
mesures pour ne jamais montrer un mur sans solution :

1. **Templates "un tap"** : quand aucune rencontre ne correspond du tout
   (nouvelle ville, nouvelle activité...), l'état vide propose 2-3 idées
   pré-remplies (titre, activité, heure suggérée, note) — un tap ouvre le
   formulaire de création déjà rempli, il ne reste qu'à préciser le lieu.
   Voir `QUICK_TEMPLATES` dans `App.jsx`.
2. **Contenu de démarrage (seed)** : `npm run seed` publie ~15 rencontres
   réalistes (variées en activité et en ville) directement dans Firestore,
   comme amorce au lancement dans une nouvelle ville — n'a pas besoin que
   `npm run server` tourne. Script idempotent (rejouable sans dupliquer),
   voir `server/seed.js`. ⚠️ Ce sont des rencontres factices
   (host "Équipe REZO", pas un vrai compte) : à remplacer par de vraies
   rencontres organisées par de vraies personnes de l'équipe avant un vrai
   lancement.
3. **Repli automatique** : si la zone/le rayon filtré ne donne rien mais que
   des rencontres existent ailleurs (même activité/âge/audience), l'app ne
   montre jamais un mur — elle affiche directement les plus proches avec un
   bandeau explicite ("Rien à 'Maarif' pour l'instant — voici les 3
   rencontres les plus proches"). Le rayon de recherche et la géolocalisation
   (bouton "Activer ma position") sont actifs pour calculer de vraies
   distances ; sans position, le repli se base sur la date la plus proche.

## Créer l'habitude de revenir

1. **Notifications push réelles** (Web Push standard, clés VAPID — pas de
   service tiers type Firebase/OneSignal requis) : fonctionnent même app
   fermée. Déclenchées automatiquement sur les moments déjà en place dans
   l'app :
   - une nouvelle demande de participation → notifie l'organisateur ;
   - une demande acceptée → notifie la personne qui a demandé ;
   - une arrivée signalée sur place → notifie les autres participants.

   Activables depuis "Ton profil" → "Notifications push" (nécessite un
   geste utilisateur explicite, requis par les navigateurs). Architecture :
   `public/sw.js` (service worker) + `src/lib/push.js` (abonnement côté
   client) + routes `/api/push/*` dans `server/index.js` (envoi côté
   serveur, clé privée VAPID jamais exposée au client).

   ⚠️ Un abonnement push est lié à un **appareil/navigateur**, pas à un
   compte — la mise en correspondance "nom affiché → compte → abonnements"
   se fait via le registre `accounts` déjà existant. Si plusieurs comptes
   partagent le même pseudo, tous seront notifiés (limite acceptable pour
   ce stade du projet, à garder en tête).

2. **Streak / badge mensuel** : dès que tu organises ou rejoins 3 rencontres
   dans le mois civil en cours, un badge se débloque (carte dans le profil +
   pastille sur l'onglet Profil + toast de célébration, une seule fois par
   mois). Purement calculé côté client à partir des rencontres existantes,
   aucune donnée supplémentaire à stocker.

3. **Résumé hebdomadaire** : chaque dimanche à 18h (heure du serveur), une
   notification push résume les nouvelles rencontres de la semaine ("Cette
   semaine : 12 nouvelles rencontres · Sport ×5 · Musique ×3…") à tous les
   abonnés. Voir `server/weeklyDigest.js`. Pour tester sans attendre
   dimanche : `npm run digest`.

   ⚠️ Ce résumé est **global**, pas personnalisé "près de toi" : le serveur
   ne connaît la position d'aucun utilisateur (`rezo-coords` reste
   volontairement local, jamais envoyé au backend — voir "À propos du
   stockage des données"). Une vraie version géolocalisée demanderait de
   partager la position des utilisateurs avec le serveur : un choix de
   confidentialité à trancher en équipe, pas à ajouter en silence.

## Renforcer la confiance dès la première ouverture

1. **Notes visibles dès la liste** : la note moyenne de l'organisateur
   s'affiche désormais en pastille (★ note) directement à côté du titre de
   chaque carte, pas seulement en petit texte dans les détails — la preuve
   sociale doit se voir en un coup d'œil.

2. **Badge "Vérifié"** (numéro de téléphone confirmé) : depuis "Ton profil",
   renseigner un numéro puis le vérifier par code à 6 chiffres. Le badge
   (icône bouclier + "Vérifié") apparaît alors sur toutes les rencontres que
   la personne organise, particulièrement important pour les rencontres
   100% Femmes/Hommes. Voir `server/index.js` (routes `/api/verify/*`) et
   `src/lib/verify.js`.

   ⚠️ **Aucun fournisseur SMS n'est branché** (Twilio etc. demanderait un
   compte tiers) : le code est généré et vérifié côté serveur (le flux est
   réel), mais faute d'envoi SMS, le serveur renvoie le code directement au
   client au lieu de l'envoyer par SMS — affiché clairement comme "code de
   démo". Avant une vraie mise en production, brancher un vrai fournisseur
   SMS côté serveur et retirer `devCode` de la réponse API.

3. **"Déjà rencontré" / amis en commun** : si l'organisateur d'une rencontre
   a déjà partagé une rencontre passée avec toi, un bandeau "Organisé par
   quelqu'un que tu as déjà rencontré" remplace le message générique ; sinon,
   si des participants de la rencontre font partie de ton historique commun,
   "X amis en commun parmi les participants" s'affiche. Calculé entièrement
   côté client à partir de l'historique des rencontres déjà stocké, aucune
   donnée supplémentaire nécessaire.

## Centre de notifications (cloche du bandeau)

Icône cloche dans le bandeau du haut, alignée avec "REZO" et le sous-titre —
badge rouge avec le nombre de notifications non lues, tap pour ouvrir un
panneau déroulant listant l'historique récent (jusqu'à 50 par personne).
Ouvrir le panneau marque tout comme lu (pas de marquage notification par
notification).

Chaque notification amène là où l'action correspondante peut être
effectuée — pas systématiquement le chat (voir `openNotificationTarget`) :
- "Nouvelle demande" / "Demande acceptée" / "Quelqu'un est arrivé" →
  `revealMeetup()` réinitialise les filtres du flux "Découvrir" qui
  pourraient la masquer (activité, zone, rayon, tranche d'âge, "Mes
  sorties"), fait défiler jusqu'à sa carte (`#meetup-card-{id}`) et
  l'entoure brièvement d'un halo — la boîte "demandes en attente" ou
  "Déjà sur place" y est déjà visible sans repliement.
- "Nouveau message" (uniquement celle-ci) → ouvre directement le chat de la
  rencontre.
- "La rencontre a démarré" (l'organisateur clique "Démarrer", voir le
  cycle de vie plus haut) — envoyée à tous les participants acceptés (pas
  les demandeurs en attente), sauf à qui vient de démarrer. Même
  redirection que les autres : révèle la carte, où le bouton trajet privé
  ("Mon trajet" → "Je pars") est déjà accessible en un tap, sans chercher.
- "Nouvel abonné" (quelqu'un suit un organisateur, voir "Suivre un
  organisateur" ci-dessous) → ouvre le **profil de la personne qui vient de
  s'abonner**. Regroupement anti-spam (`notifyNewFollow`) : au-delà de 3
  nouveaux abonnés en moins de 24h (fenêtre glissante), les entrées
  individuelles sont remplacées par une seule notification groupée dont le
  compteur continue de grossir tant que d'autres abonnements arrivent dans
  la même fenêtre — cliquable vers son propre profil (jamais la liste des
  abonnés, cohérente avec la règle de confidentialité déjà posée).

- **Registre partagé** `notifications` = `{ [destinataire]: [entrée, ...] }`,
  même convention que `follows`/`public-profiles` (voir `NOTIFICATIONS_KEY`,
  `addNotification` dans `App.jsx`).
- **Point d'entrée unique** `notifyUser(toName, {...})` : envoie le push
  navigateur existant (`notifyByName`, best effort) **et** ajoute l'entrée à
  l'historique persistant — les deux anciens appels directs à `notifyByName`
  (nouvelle demande, demande acceptée, arrivée signalée, nouvelle rencontre
  d'un abonnement) passent maintenant par ce point d'entrée unique, plus un
  nouveau déclencheur ajouté pour les messages de chat (qui n'envoyait
  auparavant aucune notification du tout).
- **Distinct du badge de chat par carte** (compteur de messages non lus
  local à chaque rencontre, déjà existant) : la cloche agrège tous les
  événements de toutes les rencontres en un seul endroit, les deux badges
  coexistent indépendamment sur une même carte.
- ⚠️ Bug de z-index rencontré et corrigé pendant ce travail : le panneau
  (enfant de `.rezo-header`) se retrouvait recouvert par la barre de
  recherche sticky dès qu'elle défilait dessous, les deux ayant le même
  z-index dans deux contextes d'empilement différents — corrigé en
  augmentant le z-index de `.rezo-header` (1 → 11) pour qu'il reste
  au-dessus de tout ce qui peut défiler sous lui, sans dépasser
  `.profile-page` (12) qui doit pouvoir le couvrir entièrement.

## Couche sociale : fidélité et liens réels

Trois fonctionnalités qui récompensent la fidélité et les liens déjà vécus
plutôt qu'un système d'amis déclaratif classique — cohérent avec l'esprit
"rencontres réelles" du concept RÉZO.

1. **Suivre un organisateur** : bouton "Suivre" sur le profil public d'un
   organisateur (accessible en tapant son nom depuis n'importe quelle carte,
   voir `.card-host-link`), à côté de sa note. Le nombre d'abonnés est
   affiché ("X abonnés") mais **jamais la liste des abonnés** — volontaire,
   pour éviter une dérive de popularité et garder le focus sur la qualité des
   rencontres plutôt que sur le nombre d'abonnés. Quand un organisateur suivi
   publie une nouvelle rencontre, chaque abonné reçoit une notification push
   (voir `notifyByName` dans `handleCreate`) et la rencontre remonte dans la
   section "De tes abonnements" de l'accueil, distincte de "Recommandé pour
   toi" (basée sur les activités préférées). Stocké dans le registre partagé
   `follows` (nom de l'abonné → liste des noms suivis).

2. **Rencontres récurrentes** : à la création, option "Répéter"
   (hebdomadaire / toutes les 2 semaines / mensuelle), avec fin "jusqu'à
   nouvel ordre" ou à une date précise. Chaque occurrence est un document de
   rencontre indépendant partageant un `seriesId` commun (voir
   `generateSeriesOccurrences`) — génération par lots de **12 occurrences**
   (`SERIES_OCCURRENCE_CAP`) : à la création, puis un effet dédié
   (`extendingSeriesRef` / l'effet "Prolongation automatique des séries")
   surveille chaque série de l'organisateur connecté et génère un nouveau lot
   dès qu'il ne reste plus que 2 occurrences futures — jusqu'à sa date de fin
   si "jusqu'à une date précise" a été choisi, sinon indéfiniment tant que la
   série n'a pas été arrêtée. Comme pour la clôture à 30 min, c'est déclenché
   côté client de l'organisateur (pas de vrai cron serveur dans ce
   prototype) : la prolongation n'a lieu que lorsque l'organisateur rouvre
   l'app, avec un garde-fou (`seriesStopped`, `seriesIndex` déjà à jour) pour
   éviter les doublons entre onglets/appareils. Le flux n'affiche que la
   prochaine occurrence à venir de chaque série (les occurrences passées
   restent visibles dans l'historique). Un participant qui rejoint choisit
   "juste cette fois" ou "toutes les prochaines occurrences" ; dans ce
   second cas, l'acceptation de l'organisateur sur la demande initiale
   l'inscrit automatiquement à toutes les occurrences futures de la série,
   y compris celles générées par une prolongation ultérieure (liste
   persistée dans `seriesSubscribers` sur chaque occurrence — voir la
   cascade dans `respondToRequest`), sans revalidation à chaque fois — il
   peut toujours se désister d'une occurrence précise sans quitter la série.
   L'organisateur peut modifier une occurrence isolément (édition normale, ne
   touche pas les autres) ou arrêter toute la série (supprime les occurrences
   futures non closes, marque le reste `seriesStopped` pour bloquer toute
   prolongation future, garde l'historique passé intact).

3. **Cercle proche** : construit **automatiquement**, sans ajout manuel —
   toute personne avec qui l'utilisateur a terminé au moins une rencontre
   ensemble (côté hôte ou participant) entre dans son cercle (voir
   `closeCircle`, calculé côté client à partir de l'historique des rencontres
   clôturées). Effet dans le flux : priorité de tri légère (jamais un filtre)
   pour les rencontres où un membre du cercle est déjà inscrit, avec la
   mention "Avec {nom}, que tu as déjà rencontré·e". Page dédiée "Mon
   cercle" (accessible depuis le profil) listant chaque personne rencontrée
   avec le nombre de rencontres partagées, la date de la dernière fois, et un
   raccourci vers son profil public (et donc ses prochaines rencontres/le
   suivi si besoin).

## Fonctionnalités actuelles

- Création de compte (e-mail + mot de passe) puis profil obligatoire (voir
  section "Compte et profil" ci-dessus)
- Rencontres groupées par activité (18 catégories), avec filtres (type,
  tranche d'âge, zone, rayon géolocalisé, mes rencontres, passées) façon
  Glovo/Tinder — jamais de flux vide sans solution (voir section dédiée
  ci-dessus)
- Recommandations personnalisées selon les activités préférées du profil
- Inscription **sur demande**, validée par l'organisateur (pas d'accès direct)
- Rencontres 100% Femmes / 100% Hommes / Mixte, avec formulaire adapté au sexe
  déclaré
- Chat de groupe par rencontre, réservé aux membres acceptés
- Invitation d'amis (message à partager ou ajout direct par prénom)
- Avis en étoiles : note de l'organisateur (cumulée sur toutes ses
  rencontres) + satisfaction de chaque rencontre passée
- Signalement avec masquage automatique au-delà d'un seuil
- Photo de profil (compressée côté client, pas d'upload de fichier binaire)
- Lieu précis + lien "Voir sur la carte" (Google Maps, sans clé API)
- Suivi de trajet **privé** le jour J : chaque membre lance son propre trajet,
  l'app détecte son arrivée et prévient le groupe (sans jamais partager de
  position en continu entre membres)
- Suivi d'organisateur, rencontres récurrentes et cercle proche construit sur
  l'historique réel (voir section "Couche sociale" ci-dessus)

## Prochaines étapes recommandées

1. **Vraies règles de sécurité Firestore par utilisateur** — les règles
   actuelles exigent une session authentifiée (`request.auth != null`,
   voir "Configurer Firebase" ci-dessus) mais restent ouvertes à quiconque
   passe par ce verrou anonyme : n'importe quel utilisateur authentifié peut
   lire/modifier les données de n'importe qui d'autre. Acceptable pour
   prototyper, pas pour un vrai lancement.
2. **Authentification réelle** (Firebase Auth avec de vraies identités, pas
   seulement anonyme) pour remplacer l'écran de compte maison actuel (voir
   "Compte et profil" ci-dessus), notamment vu les données sensibles
   (sexe) — permettrait aussi d'écrire des règles Firestore qui vérifient
   l'identité de l'appelant (`request.auth.uid`) plutôt qu'un simple verrou
   anonyme partagé par tout le monde.
3. **Déployer le petit serveur `server/`** (push/verify/digest) quelque part
   d'accessible publiquement (Render, Fly.io, Railway…) pour que ces
   fonctionnalités marchent aussi hors du poste de développement — permettrait
   aussi d'y déplacer la prolongation automatique des séries récurrentes
   (actuellement déclenchée côté client de l'organisateur, voir "Couche
   sociale" ci-dessus) en vrai cron serveur, pour qu'une série continue même
   si l'organisateur n'a pas rouvert l'app depuis longtemps.
4. **Découper `App.jsx`** en plusieurs fichiers : `components/MeetupCard.jsx`,
   `components/CreateModal.jsx`, `hooks/useMeetups.js`, `lib/geo.js`, etc.
   Le fichier actuel est monolithique par héritage du format "artefact".
5. **Vraie carte** (Mapbox/Google Maps SDK) si le lien externe actuel devient
   limitant.
6. **Vrai fournisseur SMS** (Twilio etc.) pour la vérification téléphone
   (actuellement le code s'affiche dans l'app, voir "Renforcer la confiance").
7. **Modération humaine** des signalements, CGU, conformité RGPD.
8. Tests (Vitest + React Testing Library) — aucun test n'existe à ce stade.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [Firebase](https://firebase.google.com/) (Firestore) pour le stockage
  partagé des données
- [lucide-react](https://lucide.dev/) pour les icônes
- [Express](https://expressjs.com/) pour le petit backend "opérations
  privilégiées" (`server/` : push, vérification téléphone, résumé hebdo)
- CSS-in-JS via balise `<style>` inline dans le composant (pas de framework
  CSS externe) — cohérent avec la contrainte "un seul fichier" de l'artefact
  d'origine, mais à faire évoluer vers des modules CSS ou Tailwind si le
  projet grossit.
