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
 * Les règles Firestore exigent `request.auth != null` — pas une identité
 * utilisateur réelle (voir la vraie connexion téléphone/e-mail dans
 * App.jsx, entièrement indépendante de ceci), juste un verrou technique
 * contre les robots/scripts externes qui liraient/écriraient directement
 * sans passer par l'app. D'où l'authentification anonyme Firebase
 * silencieuse ci-dessous (`authReady`) : aucun écran, aucun changement
 * d'interface, un identifiant technique stable par navigateur/appareil.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
export const auth = getAuth(firebaseApp);

// Résolu une fois qu'une session (anonyme ou restaurée) est active — à `await` avant tout appel
// Firestore (voir storagePolyfill.js) pour éviter une course où une lecture/écriture partirait
// avant que l'authentification anonyme soit établie et échouerait avec "permission-denied".
export const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject);
      }
    },
    reject
  );
});
