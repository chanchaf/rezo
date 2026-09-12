/**
 * Petits interrupteurs de fonctionnalités partagés entre l'app mobile (App.jsx) et l'écran de
 * connexion web (WebAuth.jsx) — un seul endroit à modifier plutôt que deux déclarations dupliquées
 * qu'on risquerait de faire diverger (l'un passé à true, l'autre oublié à false).
 */

// Authentification par téléphone (SMS/WhatsApp) : nécessite le plan payant Firebase Blaze pour
// l'envoi réel de SMS, pas encore activé — voir README.md. Tout le code du flux téléphone reste en
// place des deux côtés, juste caché tant que ce flag est à false ; repasser à true le réactive
// immédiatement sur mobile ET web, sans rien reconstruire.
export const PHONE_AUTH_ENABLED = false;
