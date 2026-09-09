/**
 * Initialisation Firebase côté client.
 *
 * Config lue depuis les variables d'environnement `VITE_FIREBASE_*` (voir
 * `.env.example` → copier en `.env.local`, ignoré par git). Un jeu de
 * valeurs par défaut est conservé en secours pour que l'app reste
 * utilisable telle quelle sans configuration supplémentaire.
 *
 * Cette config (apiKey compris) N'EST PAS un secret : c'est la config web
 * publique standard de Firebase, destinée à être embarquée dans le bundle
 * client (voir la doc Firebase officielle). La sécurité réelle des données
 * est assurée par les règles Firestore (Firebase Console → Firestore
 * Database → Règles), pas par le secret de cette config.
 *
 * ⚠️ Pour ce prototype, les règles doivent autoriser lecture/écriture (mode
 * test ou règles ouvertes) — voir README.md, section Firestore. C'est le
 * même niveau de confiance que l'ancien backend Express (aucune
 * authentification par utilisateur sur les données) : pas une régression,
 * juste un changement d'hébergement. Avant une vraie mise en production,
 * écrire de vraies règles Firestore restrictives.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB1biHofOEhBBPNWAb4lA3fzM1gvd9pgJk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'rezo-app-24974.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'rezo-app-24974',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'rezo-app-24974.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '387546155051',
  appId: env.VITE_FIREBASE_APP_ID || '1:387546155051:web:721434b54869cececb426e',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
