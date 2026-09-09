/**
 * Déclenche manuellement l'envoi du résumé hebdomadaire, sans attendre
 * dimanche 18h — utile pour tester. Le serveur (`npm run server`) doit
 * tourner : c'est lui qui détient les clés VAPID et les abonnements.
 *
 * Usage : npm run digest
 */
const API_URL = process.env.VITE_API_URL || 'http://localhost:8787';

const res = await fetch(`${API_URL}/api/push/send-weekly-digest`, { method: 'POST' });
const data = await res.json();
console.log(data);
