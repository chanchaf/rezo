/**
 * Notifications push (Web Push standard, clés VAPID — voir server/index.js).
 * Fonctionnent même app/onglet fermé, sans dépendre d'un service tiers
 * (Firebase, OneSignal…) : juste le service worker `public/sw.js` + le
 * backend partagé.
 */

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8787';

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  return navigator.serviceWorker.register('/sw.js');
}

// Retourne l'abonnement push existant, ou null si l'utilisateur n'est pas abonné sur cet appareil.
export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    return null;
  }
}

// Demande la permission navigateur + crée l'abonnement push + l'enregistre côté serveur pour cet
// e-mail. Doit être appelé depuis un geste utilisateur explicite (clic sur un bouton), les
// navigateurs refusent la demande de permission sinon.
export async function subscribeToPush(email) {
  if (!isPushSupported()) {
    throw new Error('Les notifications push ne sont pas supportées par ce navigateur.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission refusée.');
  }
  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const keyRes = await fetch(`${API_URL}/api/push/vapid-public-key`);
  if (!keyRes.ok) throw new Error('Impossible de récupérer la clé VAPID du serveur.');
  const { publicKey } = await keyRes.json();

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const res = await fetch(`${API_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, subscription }),
  });
  if (!res.ok) throw new Error('Échec de l’enregistrement de l’abonnement côté serveur.');
  return subscription;
}

export async function unsubscribeFromPush(email) {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;
  try {
    await fetch(`${API_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, endpoint: subscription.endpoint }),
    });
  } catch (err) {
    // best effort
  }
  await subscription.unsubscribe();
}

// Best-effort, fire-and-forget : notifie `toName` (nom affiché) sans jamais bloquer ni faire
// échouer l'action de l'appelant si le serveur est injoignable ou si la personne n'a pas
// d'abonnement actif.
export function notifyByName(toName, title, body, url) {
  fetch(`${API_URL}/api/push/notify-by-name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toName, title, body, url }),
  }).catch(() => {});
}
