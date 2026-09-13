import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { installStoragePolyfill } from './lib/storagePolyfill.js';
import App from './App.jsx';
import Landing from './Landing.jsx';
import WebAuth from './WebAuth.jsx';
import LegalPage, { legalPageForPath } from './LegalPage.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import { isMobileUserAgent } from './lib/device.js';
import { getStoredSessionEmail, getStoredLanguage, setStoredLanguage, loadAccounts } from './lib/webAuth.js';
import { translate, detectBrowserLanguage, dirForLanguage } from './lib/i18n.js';
import './index.css';

installStoragePolyfill();

/**
 * Racine de l'app — SEUL fichier modifié pour ajouter la landing page web (voir consigne produit :
 * App.jsx, le composant principal de l'app mobile existante, ne doit subir AUCUNE modification, ni
 * dans son code, ni dans son apparence, ni dans son comportement).
 *
 * Séparation stricte : un visiteur sur mobile, OU déjà connecté (quel que soit l'appareil), voit
 * l'app existante telle quelle. Seul un visiteur desktop/web NON connecté voit la nouvelle landing
 * page (Landing.jsx) puis, s'il choisit de se connecter/s'inscrire, l'écran dédié WebAuth.jsx — qui
 * gère sa propre authentification de façon totalement isolée (voir lib/webAuth.js) et se contente
 * ensuite de recharger la page : App.jsx reprend la main normalement, via le même mécanisme de
 * session (localStorage) qu'un retour de visite habituel, sans qu'aucune ligne de App.jsx n'ait été
 * touchée pour permettre ce nouvel accès.
 */
function Root() {
  const [isMobile] = useState(() => isMobileUserAgent());
  const [loggedIn] = useState(() => !!getStoredSessionEmail());
  const [webView, setWebView] = useState('landing'); // 'landing' | 'auth' — web uniquement
  const [authMode, setAuthMode] = useState('signup');
  const [language, setLanguageState] = useState(() => getStoredLanguage() || detectBrowserLanguage());
  // /admin (voir AdminDashboard.jsx) : pas de collection users/{uid} dans cette app, donc pas de
  // vraie règle Firestore possible pour restreindre l'accès aux seuls admins (voir le commentaire en
  // tête d'AdminDashboard.jsx) — gardé côté client uniquement, sur un champ isAdmin: true dans
  // kv/accounts[email]. 'pending' tant que la vérification (async, un appel Firestore) n'a pas
  // répondu ; ne montre jamais rien tant que ce n'est pas tranché, pour ne donner aucun indice.
  const isAdminPath = window.location.pathname === '/admin';
  const [adminStatus, setAdminStatus] = useState('pending'); // 'pending' | 'granted' | 'denied'

  useEffect(() => {
    if (!isAdminPath) return;
    const email = getStoredSessionEmail();
    if (!email) {
      setAdminStatus('denied');
      return;
    }
    loadAccounts()
      .then((accounts) => setAdminStatus(accounts[email]?.isAdmin ? 'granted' : 'denied'))
      .catch(() => setAdminStatus('denied'));
  }, [isAdminPath]);

  useEffect(() => {
    // Refus silencieux : remet l'URL à "/" sans jamais afficher de page "accès refusé" — aucun
    // indice que /admin existe pour qui n'y a pas droit.
    if (isAdminPath && adminStatus === 'denied') {
      window.history.replaceState(null, '', '/');
    }
  }, [isAdminPath, adminStatus]);

  // Wrapper local (avant authentification, donc pas de compte à synchroniser — voir la version
  // équivalente dans App.jsx pour un utilisateur déjà connecté) : persiste le choix pour qu'il
  // survive au handoff vers App.jsx après connexion (voir applySessionToLocalStorage/getStoredLanguage).
  const setLanguage = useCallback((code) => {
    setLanguageState(code);
    setStoredLanguage(code);
  }, []);

  const t = useCallback((key, vars) => translate(language, key, vars), [language]);
  const dir = dirForLanguage(language);

  const showApp = isMobile || loggedIn;

  // Pages légales (CGU, confidentialité) : accessibles à tout le monde par leur URL propre, sur
  // mobile comme sur desktop, connecté ou non — donc vérifiées AVANT showApp, qui sinon renverrait
  // toujours l'app mobile normale pour ces deux mêmes cas de figure (voir legalPageForPath).
  const legalPage = legalPageForPath(window.location.pathname);

  // Le cadre "smartphone" en desktop (voir index.css) ne doit s'appliquer qu'à l'app mobile
  // existante, jamais à la landing/l'écran de connexion web qui doivent rester plein écran — posé
  // en dehors de React (classe sur <body>) car un sélecteur CSS seul ne peut pas cibler un ancêtre
  // selon ce que contient son enfant. Fait pendant le rendu (pas un effet) pour éviter tout flash.
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('rezo-mode-app', showApp && !legalPage && !(isAdminPath && adminStatus !== 'denied'));
  }

  if (isAdminPath && adminStatus !== 'denied') {
    // 'pending' -> rien à l'écran tant que la vérification n'a pas répondu ; 'granted' -> tableau de bord.
    return adminStatus === 'granted' ? <AdminDashboard /> : null;
  }

  if (legalPage) {
    return <LegalPage page={legalPage} />;
  }

  if (showApp) {
    return <App />;
  }

  if (webView === 'auth') {
    return (
      <WebAuth
        language={language}
        setLanguage={setLanguage}
        dir={dir}
        t={t}
        initialMode={authMode}
        onBack={() => setWebView('landing')}
        onAuthenticated={() => window.location.reload()}
      />
    );
  }

  return (
    <Landing
      language={language}
      setLanguage={setLanguage}
      dir={dir}
      t={t}
      onGoAuth={(mode) => {
        setAuthMode(mode);
        setWebView('auth');
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
