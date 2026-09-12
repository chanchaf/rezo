import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { installStoragePolyfill } from './lib/storagePolyfill.js';
import App from './App.jsx';
import Landing from './Landing.jsx';
import WebAuth from './WebAuth.jsx';
import { isMobileUserAgent } from './lib/device.js';
import { getStoredSessionEmail, getStoredLanguage, setStoredLanguage } from './lib/webAuth.js';
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

  const setLanguage = useCallback((code) => {
    setLanguageState(code);
    setStoredLanguage(code);
  }, []);

  const t = useCallback((key, vars) => translate(language, key, vars), [language]);
  const dir = dirForLanguage(language);

  const showApp = isMobile || loggedIn;

  // Le cadre "smartphone" en desktop (voir index.css) ne doit s'appliquer qu'à l'app mobile
  // existante, jamais à la landing/l'écran de connexion web qui doivent rester plein écran — posé
  // en dehors de React (classe sur <body>) car un sélecteur CSS seul ne peut pas cibler un ancêtre
  // selon ce que contient son enfant. Fait pendant le rendu (pas un effet) pour éviter tout flash.
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('rezo-mode-app', showApp);
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
