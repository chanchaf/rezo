/**
 * Petit backend "opérations privilégiées" pour REZO.
 *
 * Les données partagées de l'app (rencontres, comptes, profils, chat) vivent
 * désormais dans Firestore, lu/écrit DIRECTEMENT par le client (voir
 * src/lib/storagePolyfill.js + src/lib/firebase.js) — ce serveur n'est donc
 * plus un proxy générique de stockage.
 *
 * Ce qu'il reste : les opérations qui doivent rester côté serveur parce
 * qu'elles touchent un secret ou une logique qu'on ne veut pas exposer au
 * client (voir README.md, section "Renforcer la confiance" / "Créer
 * l'habitude de revenir") :
 * - Notifications push (Web Push / VAPID — la clé privée ne doit jamais
 *   quitter le serveur) ;
 * - Génération/vérification du code de vérification téléphone ;
 * - Résumé hebdomadaire planifié (cron, doit tourner en continu).
 *
 * Ces routes lisent/écrivent la MÊME collection Firestore que le client
 * (via server/firebaseClient.js), donc les données restent cohérentes des
 * deux côtés.
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import cron from 'node-cron';
import { kvGet, kvSet, kvDelete } from './firebaseClient.js';
import { sendWeeklyDigest } from './weeklyDigest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8787;
const VAPID_FILE = path.join(__dirname, 'vapid.json');

// --- Notifications push (Web Push / VAPID) -------------------------------
// Les clés VAPID identifient CE serveur auprès des services push des
// navigateurs (Chrome/Firefox/etc.) — aucun compte tiers requis (contrairement
// à Firebase Cloud Messaging). Générées une fois puis persistées sur disque ;
// `vapid.json` est un secret (clé privée) et ne doit jamais être commité.
function loadOrCreateVapidKeys() {
  try {
    return JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
  } catch (err) {
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), 'utf-8');
    console.log('Nouvelles clés VAPID générées dans server/vapid.json');
    return keys;
  }
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails('mailto:contact@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// Envoie une notification push à toutes les souscriptions d'un utilisateur identifié par son EMAIL
// (clé stable), et retire automatiquement les souscriptions expirées/révoquées (404/410).
async function sendPushToEmail(email, payload) {
  const subsRaw = await kvGet('push-subscriptions');
  const subsByEmail = subsRaw ? JSON.parse(subsRaw) : {};
  const subs = subsByEmail[email] || [];
  if (subs.length === 0) return { sent: 0 };

  const stillValid = [];
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      stillValid.push(sub);
      sent += 1;
    } catch (err) {
      if (err.statusCode !== 404 && err.statusCode !== 410) stillValid.push(sub);
    }
  }
  subsByEmail[email] = stillValid;
  await kvSet('push-subscriptions', JSON.stringify(subsByEmail));
  return { sent };
}

// Les rencontres stockent des NOMS affichés (pas des e-mails). On retrouve le(s) compte(s)
// correspondant à un nom via le registre `accounts` (déjà dans Firestore, voir App.jsx).
async function findEmailsByName(name) {
  const accountsRaw = await kvGet('accounts');
  const accounts = accountsRaw ? JSON.parse(accountsRaw) : {};
  return Object.entries(accounts)
    .filter(([, acc]) => acc.name === name)
    .map(([email]) => email);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// --- Vérification de numéro de téléphone (badge "Vérifié") -----------------
// Voir la note en tête de src/lib/verify.js : pas de fournisseur SMS branché,
// le code est renvoyé directement au client ("devCode") au lieu d'être envoyé
// par SMS. Le reste du flux (génération, expiration, vérification) est réel.

function generateVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

app.post('/api/verify/request', async (req, res) => {
  const { email, phone } = req.body || {};
  if (!email || !phone) return res.status(400).json({ error: 'email et phone requis' });
  const code = generateVerifyCode();
  await kvSet(
    `phone-verify:${email}`,
    JSON.stringify({ code, phone, expiresAt: Date.now() + 10 * 60 * 1000 }) // 10 minutes
  );
  res.json({ ok: true, devCode: code });
});

app.post('/api/verify/confirm', async (req, res) => {
  const { email, phone, code } = req.body || {};
  if (!email || !phone || !code) return res.status(400).json({ error: 'email, phone et code requis' });
  const raw = await kvGet(`phone-verify:${email}`);
  const pending = raw ? JSON.parse(raw) : null;
  if (!pending || pending.phone !== phone) {
    return res.status(400).json({ error: 'Aucune demande de vérification en cours pour ce numéro.' });
  }
  if (Date.now() > pending.expiresAt) {
    await kvDelete(`phone-verify:${email}`).catch(() => {});
    return res.status(400).json({ error: 'Code expiré, redemande-en un.' });
  }
  if (pending.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Code incorrect.' });
  }

  await kvDelete(`phone-verify:${email}`).catch(() => {});

  const accountsRaw = await kvGet('accounts');
  const accounts = accountsRaw ? JSON.parse(accountsRaw) : {};
  const account = accounts[email] || {};
  accounts[email] = { ...account, phone, phoneVerified: true };
  await kvSet('accounts', JSON.stringify(accounts));

  if (account.name) {
    const verifiedRaw = await kvGet('verified-map');
    const verifiedMap = verifiedRaw ? JSON.parse(verifiedRaw) : {};
    verifiedMap[account.name] = true;
    await kvSet('verified-map', JSON.stringify(verifiedMap));
  }

  res.json({ ok: true });
});

// --- Routes push -----------------------------------------------------------

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', async (req, res) => {
  const { email, subscription } = req.body || {};
  if (!email || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'email et subscription requis' });
  }
  const subsRaw = await kvGet('push-subscriptions');
  const subsByEmail = subsRaw ? JSON.parse(subsRaw) : {};
  const existing = subsByEmail[email] || [];
  const alreadyThere = existing.some((s) => s.endpoint === subscription.endpoint);
  subsByEmail[email] = alreadyThere ? existing : [...existing, subscription];
  await kvSet('push-subscriptions', JSON.stringify(subsByEmail));
  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const { email, endpoint } = req.body || {};
  if (!email || !endpoint) return res.status(400).json({ error: 'email et endpoint requis' });
  const subsRaw = await kvGet('push-subscriptions');
  const subsByEmail = subsRaw ? JSON.parse(subsRaw) : {};
  subsByEmail[email] = (subsByEmail[email] || []).filter((s) => s.endpoint !== endpoint);
  await kvSet('push-subscriptions', JSON.stringify(subsByEmail));
  res.json({ ok: true });
});

// Déclenché par le client juste après une action pertinente (nouvelle demande, demande
// acceptée, arrivée signalée) — voir App.jsx. Best-effort : ne bloque jamais l'action côté client.
app.post('/api/push/notify-by-name', async (req, res) => {
  const { toName, title, body, url } = req.body || {};
  if (!toName || !title) return res.status(400).json({ error: 'toName et title requis' });
  const emails = await findEmailsByName(toName);
  let sent = 0;
  for (const email of emails) {
    const result = await sendPushToEmail(email, { title, body: body || '', url: url || '/' });
    sent += result.sent;
  }
  res.json({ ok: true, sent, recipients: emails.length });
});

// Déclenchement manuel du résumé hebdo, utile pour tester sans attendre dimanche 18h
// (voir aussi `npm run digest`).
app.post('/api/push/send-weekly-digest', async (req, res) => {
  const result = await sendWeeklyDigest({ kvGet, kvSet }, webpush);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`REZO backend (push/verify/digest) listening on http://localhost:${PORT}`);
});

// --- Résumé hebdomadaire planifié -------------------------------------------
// Tous les dimanches à 18h, heure du serveur (moment classique de
// planification de la semaine à venir). Ajuster le fuseau si le serveur est
// déployé ailleurs que dans le fuseau cible.
cron.schedule('0 18 * * 0', async () => {
  console.log('Envoi du résumé hebdomadaire planifié…');
  const result = await sendWeeklyDigest({ kvGet, kvSet }, webpush);
  console.log('Résumé hebdomadaire :', result);
});
