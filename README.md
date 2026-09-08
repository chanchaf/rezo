# RÉZO — Rencontres par activité, groupées, en temps réel

MVP d'une app qui permet d'organiser et de rejoindre des rencontres humaines
groupées par activité (sport, culture, musique, jeux, bien-être, food...) dans
une zone géographique, avec validation par l'organisateur, chat de groupe,
avis, et suivi de trajet privé le jour J.

Ce projet a été prototypé comme **artefact Claude** (React exécuté dans
Claude.ai) puis exporté ici en projet **Vite + React** standard pour
poursuivre le développement dans VS Code et le publier sur GitHub.

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvre ensuite [http://localhost:5173](http://localhost:5173).

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
- `src/main.jsx` / `src/index.css` / `index.html` — bootstrap standard Vite.

## ⚠️ À propos du stockage des données (lire avant de déployer)

Dans l'artefact Claude d'origine, `window.storage` est une API fournie
nativement par la plateforme : elle persiste les données côté serveur et les
synchronise en temps quasi réel entre **tous les utilisateurs** qui ouvrent
l'artefact (mode `shared: true`) ou juste pour l'utilisateur courant (mode
`shared: false`, ex. le pseudo, le sexe, l'avatar).

Ce projet ne dépend d'aucun backend spécifique à Claude : `src/App.jsx`
utilise uniquement `window.storage.get/set/delete/list`, une API très simple.
Pour que l'app tourne hors de Claude.ai, `src/lib/storagePolyfill.js`
réimplémente cette même API **avec `localStorage`** — donc :

- ✅ L'app fonctionne immédiatement en local, sans rien configurer.
- ❌ `localStorage` est propre à un seul navigateur. Deux personnes sur deux
  téléphones différents **ne verront pas les mêmes rencontres**. Ce n'est
  utile que pour développer et tester l'UI en solo (ou dans plusieurs onglets
  du même navigateur, qui partagent le même `localStorage`).

**Pour une vraie mise en production multi-utilisateurs**, il faut remplacer
le contenu de `storagePolyfill.js` par un vrai backend partagé, en gardant
exactement la même signature (`get(key, shared)`, `set(key, value, shared)`,
`delete(key, shared)`, `list(prefix, shared)`) — rien d'autre à changer dans
`App.jsx`. Options recommandées par ordre de simplicité :

1. **Firebase Realtime Database ou Firestore** — le plus rapide à brancher,
   gère le temps réel nativement (proche de l'expérience actuelle avec le
   sondage toutes les 5s, en mieux).
2. **Supabase** (Postgres + Realtime) — bon compromis si vous voulez du SQL
   et de l'auth réelle en plus.
3. **API custom** (Node/Express, etc.) — plus de travail, mais total contrôle.

Dans tous les cas, `shared: true` doit correspondre à une table/collection
commune à tous les utilisateurs, et `shared: false` à des données propres à
l'utilisateur connecté (ce qui suppose d'ajouter une vraie authentification,
voir plus bas).

## Fonctionnalités actuelles

- Rencontres groupées par activité, avec filtres (type, zone, mes rencontres,
  passées) façon Glovo/Tinder
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

1. **Backend réel** (voir section stockage ci-dessus) — priorité n°1 avant
   tout déploiement public.
2. **Authentification réelle** (téléphone/email/OAuth) pour remplacer le
   pseudo déclaratif actuel, notamment vu les données sensibles (sexe).
3. **Découper `App.jsx`** en plusieurs fichiers : `components/MeetupCard.jsx`,
   `components/CreateModal.jsx`, `hooks/useMeetups.js`, `lib/geo.js`, etc.
   Le fichier actuel est monolithique par héritage du format "artefact".
4. **Vraie carte** (Mapbox/Google Maps SDK) si le lien externe actuel devient
   limitant.
5. **Notifications push** réelles (actuellement de simples toasts in-app).
6. **Modération humaine** des signalements, CGU, conformité RGPD.
7. Tests (Vitest + React Testing Library) — aucun test n'existe à ce stade.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [lucide-react](https://lucide.dev/) pour les icônes
- CSS-in-JS via balise `<style>` inline dans le composant (pas de framework
  CSS externe) — cohérent avec la contrainte "un seul fichier" de l'artefact
  d'origine, mais à faire évoluer vers des modules CSS ou Tailwind si le
  projet grossit.
