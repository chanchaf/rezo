/**
 * Polyfill de window.storage pour le développement local hors de Claude.ai.
 *
 * L'app REZO a été prototypée comme un artefact Claude, où `window.storage`
 * est fourni nativement par la plateforme et synchronise les données entre
 * TOUS les utilisateurs qui ouvrent l'artefact (stockage "shared: true").
 *
 * Ce polyfill réimplémente la même API (get/set/delete/list, avec le même
 * comportement — get sur une clé absente lève une erreur), mais avec deux
 * backends différents selon le paramètre `shared` :
 *
 * - `shared: false` (données propres à CET appareil : session, préférences
 *   locales) → `localStorage`, comme avant. Ça reste correct : ces valeurs
 *   ne représentent pas des données à synchroniser entre appareils, juste un
 *   cache local (le profil complet, lui, est aussi dupliqué dans le registre
 *   partagé `accounts` — voir App.jsx — pour être restauré à la connexion).
 *
 * - `shared: true` (rencontres, comptes, profils, chat…) → **Firestore**
 *   directement depuis le client (voir `src/lib/firebase.js`), dans une
 *   collection `kv` où chaque document = une clé (même forme que l'ancien
 *   backend Express, juste un hébergeur différent). Géré par Firebase, donc
 *   synchronisé entre TOUS les appareils sans rien déployer soi-même.
 *
 * Le petit serveur Express (`server/index.js`) reste utile pour les
 * opérations qui doivent rester côté serveur (notifications push, code de
 * vérification téléphone, résumé hebdomadaire planifié) — voir README.md.
 * Il lit/écrit dans la MÊME collection Firestore via `server/firebaseClient.js`.
 */

import { db, authReady } from './firebase.js';
import { doc, getDoc, setDoc, deleteDoc, collection, query, orderBy, startAt, endAt, getDocs, documentId } from 'firebase/firestore';

const NAMESPACE = 'rezo:data';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(NAMESPACE) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(NAMESPACE, JSON.stringify(data));
}

async function firestoreGet(key) {
  await authReady;
  const snap = await getDoc(doc(db, 'kv', key));
  if (!snap.exists()) {
    throw new Error(`Key not found: ${key}`);
  }
  return snap.data().value;
}

async function firestoreSet(key, value) {
  await authReady;
  await setDoc(doc(db, 'kv', key), { value });
}

async function firestoreDelete(key) {
  await authReady;
  await deleteDoc(doc(db, 'kv', key));
}

async function firestoreList(prefix) {
  await authReady;
  const col = collection(db, 'kv');
  const q = prefix
    ? query(col, orderBy(documentId()), startAt(prefix), endAt(prefix + ''))
    : query(col);
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}

export function installStoragePolyfill() {
  if (typeof window === 'undefined') return;
  if (window.storage) return; // déjà fourni par l'environnement (ex: artefact Claude)

  window.storage = {
    async get(key, shared = false) {
      if (shared) {
        const value = await firestoreGet(key);
        return { key, value, shared };
      }
      const data = readAll();
      if (!data.personal || !(key in data.personal)) {
        throw new Error(`Key not found: ${key}`);
      }
      return { key, value: data.personal[key], shared };
    },

    async set(key, value, shared = false) {
      if (shared) {
        await firestoreSet(key, value);
        return { key, value, shared };
      }
      const data = readAll();
      if (!data.personal) data.personal = {};
      data.personal[key] = value;
      writeAll(data);
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      if (shared) {
        await firestoreDelete(key);
        return { key, deleted: true, shared };
      }
      const data = readAll();
      if (data.personal) delete data.personal[key];
      writeAll(data);
      return { key, deleted: true, shared };
    },

    async list(prefix = '', shared = false) {
      if (shared) {
        const keys = await firestoreList(prefix);
        return { keys, prefix, shared };
      }
      const data = readAll();
      const keys = data.personal ? Object.keys(data.personal).filter((k) => k.startsWith(prefix)) : [];
      return { keys, prefix, shared };
    },
  };
}
