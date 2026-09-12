/**
 * Accès Firestore côté serveur, pour les opérations qui doivent rester
 * privilégiées (notifications push, vérification téléphone, résumé
 * hebdomadaire) — voir server/index.js.
 *
 * Utilise le SDK client Firebase (pas firebase-admin) : aucune clé de compte
 * de service n'est nécessaire, seulement la même config web publique que le
 * client (`.env.local`, voir src/lib/firebase.js). C'est cohérent avec le
 * niveau de confiance actuel du prototype (règles Firestore ouvertes en
 * lecture/écriture — voir README.md) ; pour une vraie mise en production,
 * migrer vers firebase-admin avec une clé de compte de service et des règles
 * Firestore restrictives.
 */

import { config as loadEnv } from 'dotenv';
import { initializeApp } from 'firebase/app';

loadEnv({ path: '.env.local' }); // même fichier que Vite (voir .env.example)
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyB1biHofOEhBBPNWAb4lA3fzM1gvd9pgJk',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'rezo-app-24974.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'rezo-app-24974',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'rezo-app-24974.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '387546155051',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:387546155051:web:721434b54869cececb426e',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const auth = getAuth(app);

// Mêmes règles Firestore que le client (request.auth != null) — ce serveur utilise le SDK client
// (pas firebase-admin, voir le commentaire en tête de fichier), donc il lui faut lui aussi une
// session, anonyme comme côté navigateur (voir src/lib/firebase.js). Un seul sign-in, réutilisé par
// tous les appels kv* de ce process (npm run seed, npm run server) — pas un sign-in par appel.
const authReady = signInAnonymously(auth);

export async function kvGet(key) {
  await authReady;
  const snap = await getDoc(doc(db, 'kv', key));
  return snap.exists() ? snap.data().value : undefined;
}

export async function kvSet(key, value) {
  await authReady;
  await setDoc(doc(db, 'kv', key), { value });
}

export async function kvDelete(key) {
  await authReady;
  await deleteDoc(doc(db, 'kv', key));
}
