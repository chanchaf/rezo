/**
 * Vérification de numéro de téléphone (badge "Vérifié").
 *
 * ⚠️ Aucun fournisseur SMS n'est branché ici (Twilio etc. demanderait un
 * compte tiers). Le code à 6 chiffres est généré et vérifié côté serveur
 * (donc le flux est réel), mais faute d'envoi SMS réel, le serveur renvoie
 * le code directement dans la réponse ("devCode") au lieu de l'envoyer par
 * SMS — l'app l'affiche clairement comme un code de démonstration. Avant
 * une vraie mise en production, brancher un vrai fournisseur SMS côté
 * serveur (voir server/index.js) et supprimer `devCode` de la réponse.
 */

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8787';

export async function requestPhoneCode(email, phone) {
  const res = await fetch(`${API_URL}/api/verify/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Impossible d’envoyer le code.');
  return data;
}

export async function confirmPhoneCode(email, phone, code) {
  const res = await fetch(`${API_URL}/api/verify/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Code incorrect.');
  return data;
}
