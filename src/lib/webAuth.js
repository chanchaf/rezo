/**
 * Authentification pour la landing page web (voir Landing.jsx / WebAuth.jsx).
 *
 * ⚠️ Duplique volontairement une petite partie de la logique déjà présente dans App.jsx
 * (hashPassword, le registre `accounts`, les clés localStorage écrites à la connexion) au lieu de
 * l'importer depuis App.jsx. Contrainte explicite du produit : l'app mobile existante (App.jsx) ne
 * doit subir AUCUNE modification, pas même l'ajout d'un `export` sur une fonction déjà présente —
 * donc pas de source commune possible sans y toucher. Les deux copies doivent rester équivalentes
 * (même algorithme de hash, même forme de compte, mêmes clés) pour qu'un compte créé ou connecté
 * ici soit repris correctement par App.jsx au rechargement (voir handoff() ci-dessous).
 */
import { db, auth, authReady } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';

const ACCOUNTS_KEY = 'accounts';

export const DIAL_CODES = [
  { country: 'Maroc', flag: '🇲🇦', code: '+212' },
  { country: 'France', flag: '🇫🇷', code: '+33' },
  { country: 'Espagne', flag: '🇪🇸', code: '+34' },
  { country: 'Belgique', flag: '🇧🇪', code: '+32' },
  { country: 'Algérie', flag: '🇩🇿', code: '+213' },
  { country: 'Tunisie', flag: '🇹🇳', code: '+216' },
  { country: 'Canada', flag: '🇨🇦', code: '+1' },
  { country: 'Suisse', flag: '🇨🇭', code: '+41' },
];

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

// Même règle que App.jsx (voir isPasswordStrongEnough dans App.jsx) : au moins 8 caractères, au
// moins une lettre et un chiffre — dupliquée ici pour la même raison que le reste du fichier.
export function isPasswordStrongEnough(password) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password || '');
}

// Miroir Firebase Auth réel, utilisé UNIQUEMENT pour la vérification d'e-mail (sendEmailVerification/
// emailVerified n'existent que sur un vrai utilisateur Firebase Auth, jamais sur la session anonyme
// technique déjà en place — voir authReady). Dupliqué depuis App.jsx (voir syncFirebaseEmailAuth) —
// contrainte d'isolation totale entre les deux fichiers. Le mot de passe reste géré par notre propre
// registre `accounts` (hash SHA-256) : ce miroir ne sert jamais à l'authentification elle-même. App.jsx
// relit l'état de vérification à son montage après le rechargement (session Firebase Auth persistée),
// donc pas besoin de renvoyer emailVerified ici.
async function syncFirebaseEmailAuth(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
    } catch (err2) {
      // Rôle purement accessoire : une erreur ici ne doit jamais bloquer la vraie connexion/
      // inscription, qui repose sur le registre `accounts` fait maison.
    }
  }
}

export async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function loadAccounts() {
  try {
    await authReady;
    const snap = await getDoc(doc(db, 'kv', ACCOUNTS_KEY));
    if (!snap.exists()) return {};
    return JSON.parse(snap.data().value || '{}');
  } catch (err) {
    return {};
  }
}

export async function saveAccounts(accounts) {
  await authReady;
  await setDoc(doc(db, 'kv', ACCOUNTS_KEY), { value: JSON.stringify(accounts) });
}

// Écrit dans localStorage exactement les mêmes clés que App.jsx lit à son montage (voir son effet
// `window.storage.get('rezo-email'|'rezo-username'|...)`), pour qu'un rechargement de page bascule
// naturellement dans l'app déjà connectée — sans dupliquer l'UI ni l'état de App.jsx lui-même.
const NAMESPACE = 'rezo:data';

function readPersonal() {
  try {
    const raw = localStorage.getItem(NAMESPACE);
    return raw ? JSON.parse(raw).personal || {} : {};
  } catch (err) {
    return {};
  }
}

function writePersonal(personal) {
  localStorage.setItem(NAMESPACE, JSON.stringify({ personal }));
}

export function getStoredSessionEmail() {
  return readPersonal()['rezo-email'] || null;
}

// Même clé/format que App.jsx (`rezo-language`, localStorage non partagé) : un choix de langue
// fait sur la landing page avant connexion doit se retrouver dans l'app juste après le handoff.
export function getStoredLanguage() {
  return readPersonal()['rezo-language'] || null;
}

export function setStoredLanguage(code) {
  const personal = readPersonal();
  personal['rezo-language'] = code;
  writePersonal(personal);
}

export function applySessionToLocalStorage(identifier, account, extra = {}) {
  const personal = readPersonal();
  personal['rezo-email'] = identifier;
  if (extra.phone) personal['rezo-phone'] = extra.phone;
  if (extra.phoneVerified) personal['rezo-phone-verified'] = 'true';
  if (account?.name) personal['rezo-username'] = account.name;
  if (account?.lastName) personal['rezo-lastname'] = account.lastName;
  personal['rezo-country'] = account?.country || 'Maroc';
  if (account?.city) personal['rezo-city'] = account.city;
  personal['rezo-show-lastname'] = account?.showLastNamePublicly ? 'true' : 'false';
  personal['rezo-show-city'] = account?.showCityPublicly ? 'true' : 'false';
  if (account?.cover) personal['rezo-cover'] = account.cover;
  if (account?.bio) personal['rezo-bio'] = account.bio;
  if (account?.gender) personal['rezo-gender'] = account.gender;
  if (account?.preferences?.length) personal['rezo-preferences'] = JSON.stringify(account.preferences);
  if (account?.avatar) personal['rezo-avatar'] = account.avatar;
  if (account?.language) personal['rezo-language'] = account.language;
  writePersonal(personal);
}

// `profile` reprend les champs capturés dès l'inscription côté App.jsx (voir submitSignup) :
// firstName/lastName obligatoires, phone facultatif (visible mais non vérifié tant que
// PHONE_AUTH_ENABLED est à false), acceptedMarketing pour la case optionnelle.
export async function createEmailAccount(email, password, language, profile = {}) {
  const trimmed = email.trim().toLowerCase();
  const firstName = (profile.firstName || '').trim();
  const lastName = (profile.lastName || '').trim();
  if (!firstName || !lastName) throw new Error('Renseigne ton nom et ton prénom.');
  if (!isValidEmail(trimmed)) throw new Error('Adresse e-mail invalide.');
  if (!isPasswordStrongEnough(password)) {
    throw new Error('Au moins 8 caractères, incluant 1 lettre et 1 chiffre.');
  }
  const accounts = await loadAccounts();
  if (accounts[trimmed]) throw new Error('Un compte existe déjà avec cette adresse.');
  const passwordHash = await hashPassword(password);
  accounts[trimmed] = {
    passwordHash,
    createdAt: new Date().toISOString(),
    language,
    name: firstName,
    lastName,
    phone: profile.phone || null,
    acceptedMarketing: !!profile.acceptedMarketing,
  };
  await saveAccounts(accounts);
  applySessionToLocalStorage(trimmed, accounts[trimmed]);
  // Envoie le vrai e-mail de vérification Firebase. Attendu (contrairement à App.jsx où l'équivalent
  // ne bloque pas l'UI) : ici la page se recharge juste après (voir finishAuth() dans WebAuth.jsx),
  // et App.jsx doit trouver la session Firebase Auth déjà établie à son montage pour afficher le bon
  // état de vérification dès le premier chargement.
  await syncFirebaseEmailAuth(trimmed, password);
  return trimmed;
}

export async function loginEmailAccount(email, password) {
  const trimmed = email.trim().toLowerCase();
  const accounts = await loadAccounts();
  const account = accounts[trimmed];
  if (!account) throw new Error('Aucun compte avec cette adresse.');
  const passwordHash = await hashPassword(password);
  if (passwordHash !== account.passwordHash) throw new Error('Mot de passe incorrect.');
  applySessionToLocalStorage(trimmed, account);
  // Rétablit/crée la session Firebase Auth miroir pour que App.jsx puisse lire le vrai emailVerified
  // à son montage après le rechargement — migre au passage un compte créé avant cette fonctionnalité.
  await syncFirebaseEmailAuth(trimmed, password);
  return trimmed;
}

// Connexion Google/Facebook (voir WebAuth.jsx, signInWithPopup) : même registre partagé `accounts`
// que la connexion e-mail/mot de passe, clé = e-mail fourni par le fournisseur — un compte Google et
// un compte e-mail avec la même adresse sont donc unifiés. `oauthUser` est le `result.user` renvoyé
// par signInWithPopup ({ uid, email, displayName, photoURL }).
export async function syncOAuthAccount(providerName, oauthUser, language) {
  const email = (oauthUser.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error(`${providerName} n'a pas partagé d'adresse e-mail — utilise l'inscription par e-mail à la place.`);
  }
  const accounts = await loadAccounts();
  let account = accounts[email];
  if (!account) {
    const [guessFirst, ...guessRest] = (oauthUser.displayName || '').trim().split(/\s+/);
    account = {
      provider: providerName.toLowerCase(),
      uid: oauthUser.uid,
      createdAt: new Date().toISOString(),
      language,
      name: guessFirst || '',
      lastName: guessRest.join(' '),
      avatar: oauthUser.photoURL || null,
    };
    accounts[email] = account;
    await saveAccounts(accounts);
  }
  applySessionToLocalStorage(email, account, { phone: account.phone, phoneVerified: account.phoneVerified });
  return email;
}

export async function completePhoneLogin(fullPhone) {
  const accounts = await loadAccounts();
  const account = accounts[fullPhone] || {};
  applySessionToLocalStorage(fullPhone, account, { phone: fullPhone, phoneVerified: true });
  return fullPhone;
}
