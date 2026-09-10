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
  "Vérifié") côté client.
- `src/main.jsx` / `src/index.css` / `index.html` — bootstrap standard Vite.

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
3. Dans Firestore Database → Règles, pour ce prototype (aucune authentification
   par utilisateur sur les données, comme l'ancien backend Express) :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

   ⚠️ Ces règles sont **ouvertes à tout le monde** — volontaire pour ce
   stade du projet, mais à remplacer par de vraies règles restreintes avant
   toute mise en production (typiquement couplées à une vraie authentification
   Firebase Auth plutôt que le système de comptes maison actuel — voir
   "Compte et profil").

Sans `.env.local`, l'app utilise une config Firebase par défaut codée en dur
(le projet de développement d'origine) — pratique pour un premier essai,
mais à remplacer par votre propre projet dès que vous continuez ce travail.

## Compte et profil

Avant de pouvoir créer/rejoindre une rencontre, discuter, inviter ou noter,
l'utilisateur doit :

1. **S'authentifier**, avec plusieurs portes d'entrée (écran en deux temps,
   façon Glovo) :
   - **Téléphone** (méthode principale) : préfixe pays (drapeau, présélectionné
     via géolocalisation IP) + numéro, puis code reçu par SMS ou WhatsApp.
     Réutilise le flux de vérification déjà en place pour le badge "Vérifié"
     (voir plus bas) — le numéro complet sert lui-même d'identifiant de
     compte. ⚠️ Aucun fournisseur SMS/WhatsApp réel n'est branché : le code
     est affiché directement à l'écran ("code de démonstration"), comme pour
     la vérification de téléphone dans "Modifier le profil".
   - **E-mail + mot de passe** : entièrement réel dans les limites d'un
     prototype — mot de passe haché côté client via
     `crypto.subtle.digest('SHA-256', …)` avant stockage dans le registre
     partagé `accounts` (`window.storage`, `shared: true`) (voir
     `hashPassword` dans `App.jsx`).
   - **Google / Facebook** : boutons présents (façon Glovo) mais non
     connectés — nécessiteraient de vraies applications OAuth (client ID
     Google, App ID + secret Facebook) qu'on ne peut pas improviser dans ce
     projet. Au clic, un message clair l'indique plutôt que de simuler une
     fausse connexion (voir `handleOAuthStub`). Idem pour "Mot de passe
     oublié ?" et les liens légaux (reCAPTCHA, politique de confidentialité,
     conditions d'utilisation) : aucune vraie page/flux derrière pour
     l'instant.
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

## Prochaines étapes recommandées

1. **Vraies règles de sécurité Firestore** — les règles actuelles sont
   ouvertes à tout le monde (voir "Configurer Firebase" ci-dessus), acceptable
   pour prototyper mais pas pour un vrai lancement.
2. **Authentification réelle** (Firebase Auth) pour remplacer l'écran de
   compte maison actuel (voir "Compte et profil" ci-dessus), notamment vu les
   données sensibles (sexe) — permettrait aussi d'écrire des règles Firestore
   qui vérifient l'identité de l'appelant plutôt que d'être grandes ouvertes.
3. **Déployer le petit serveur `server/`** (push/verify/digest) quelque part
   d'accessible publiquement (Render, Fly.io, Railway…) pour que ces
   fonctionnalités marchent aussi hors du poste de développement.
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
