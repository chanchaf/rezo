/**
 * Détection "vrai mobile" (téléphone) vs desktop/web, pour la séparation stricte entre la landing
 * page marketing (desktop, visiteur non connecté) et l'app mobile existante (voir main.jsx).
 *
 * Volontairement basé sur le user-agent plutôt que la largeur de fenêtre : un visiteur qui
 * redimensionne son navigateur desktop en fenêtre étroite doit rester sur la landing page, pas
 * basculer vers l'app — l'app, elle, doit rester réservée aux vrais appareils mobiles.
 */
const MOBILE_UA_REGEX = /Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i;

export function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return MOBILE_UA_REGEX.test(navigator.userAgent || '');
}
