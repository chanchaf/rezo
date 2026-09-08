/**
 * Polyfill de window.storage pour le développement local hors de Claude.ai.
 *
 * L'app RÉZO a été prototypée comme un artefact Claude, où `window.storage`
 * est fourni nativement par la plateforme et synchronise les données entre
 * TOUS les utilisateurs qui ouvrent l'artefact (stockage "shared: true").
 *
 * En dehors de cet environnement, il n'existe pas de backend réel : ce
 * polyfill réimplémente la même API (get/set/delete/list, avec le même
 * comportement — get sur une clé absente lève une erreur) mais en la
 * stockant dans le localStorage du navigateur.
 *
 * ⚠️ LIMITE IMPORTANTE : localStorage est local à CE navigateur. Les données
 * "shared" ne seront donc visibles que dans les autres onglets du même
 * navigateur, PAS entre deux utilisateurs sur deux appareils différents.
 * C'est suffisant pour développer et tester l'UI en solo, mais pour une
 * vraie mise en production multi-utilisateurs (ce qui est tout l'intérêt de
 * cette app), il faut remplacer ce fichier par un vrai backend partagé :
 * Firebase Realtime Database / Firestore, Supabase, ou une API custom.
 * Le reste du code (App.jsx) n'a besoin d'aucune modification pour ça :
 * il suffit de garder la même signature get/set/delete/list.
 */

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

function scopeKey(shared) {
  return shared ? 'shared' : 'personal';
}

export function installStoragePolyfill() {
  if (typeof window === 'undefined') return;
  if (window.storage) return; // déjà fourni par l'environnement (ex: artefact Claude)

  window.storage = {
    async get(key, shared = false) {
      const data = readAll();
      const scope = scopeKey(shared);
      if (!data[scope] || !(key in data[scope])) {
        throw new Error(`Key not found: ${key}`);
      }
      return { key, value: data[scope][key], shared };
    },

    async set(key, value, shared = false) {
      const data = readAll();
      const scope = scopeKey(shared);
      if (!data[scope]) data[scope] = {};
      data[scope][key] = value;
      writeAll(data);
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      const data = readAll();
      const scope = scopeKey(shared);
      if (data[scope]) delete data[scope][key];
      writeAll(data);
      return { key, deleted: true, shared };
    },

    async list(prefix = '', shared = false) {
      const data = readAll();
      const scope = scopeKey(shared);
      const keys = data[scope] ? Object.keys(data[scope]).filter((k) => k.startsWith(prefix)) : [];
      return { keys, prefix, shared };
    },
  };
}
