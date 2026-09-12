import React, { useState } from 'react';
import { requestPhoneCode, confirmPhoneCode } from './lib/verify.js';
import {
  createEmailAccount,
  loginEmailAccount,
  completePhoneLogin,
  syncOAuthAccount,
  isPasswordStrongEnough,
  DIAL_CODES,
} from './lib/webAuth.js';
import { auth } from './lib/firebase.js';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from 'firebase/auth';
import { LANGUAGES } from './lib/i18n.js';

// Messages clairs pour les codes d'erreur réels de signInWithPopup — dupliqué depuis App.jsx (voir
// OAUTH_ERROR_MESSAGES), même contrainte d'isolation totale que le reste de ce fichier.
const OAUTH_ERROR_MESSAGES = {
  'auth/popup-blocked': 'Le navigateur a bloqué la fenêtre de connexion. Autorise les pop-ups pour ce site puis réessaie.',
  'auth/account-exists-with-different-credential':
    'Un compte existe déjà avec cette adresse via un autre mode de connexion (e-mail ou un autre fournisseur).',
  'auth/network-request-failed': 'Connexion réseau impossible, réessaie.',
  'auth/unauthorized-domain': "Ce domaine n'est pas autorisé pour la connexion (configuration Firebase à compléter).",
  'auth/operation-not-allowed': "Ce mode de connexion n'est pas encore activé côté Firebase.",
};

function oauthErrorMessage(err) {
  return OAUTH_ERROR_MESSAGES[err?.code] || err?.message || 'Connexion impossible, réessaie.';
}

// Découpe un texte traduit contenant des jetons {clé} pour y injecter des éléments React (liens
// cliquables notamment). Dupliqué depuis App.jsx (voir interpolateNodes) — contrainte d'isolation
// totale entre les deux écrans : WebAuth.jsx ne doit rien importer de App.jsx.
function interpolateNodes(template, replacements) {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const match = part.match(/^\{(\w+)\}$/);
    if (match && replacements[match[1]] !== undefined) {
      return <React.Fragment key={i}>{replacements[match[1]]}</React.Fragment>;
    }
    return part;
  });
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

function LangSwitcher({ language, setLanguage }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  return (
    <div className="webauth-lang-wrap">
      <button type="button" className="webauth-lang-btn" onClick={() => setOpen((v) => !v)}>
        {current.flag} {current.code.toUpperCase()}
      </button>
      {open && (
        <div className="webauth-lang-menu">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`webauth-lang-item ${l.code === language ? 'active' : ''}`}
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Écran de connexion/inscription dédié au web (voir Landing.jsx et la contrainte d'isolation totale
// vis-à-vis de App.jsx dans main.jsx). Reprend la même structure à deux écrans dédiés que App.jsx
// (voir son modal-auth-dark) sans importer quoi que ce soit depuis ce fichier — une fois authentifié
// ici, la page se recharge et l'app existante (inchangée) reprend la main avec la session déjà posée
// dans localStorage (voir webAuth.js).
export default function WebAuth({ language, setLanguage, dir, t, initialMode = 'login', onBack, onAuthenticated }) {
  const [screen, setScreen] = useState('email'); // 'email' | 'phone-code' (phone-code inutilisé tant que PHONE_AUTH_ENABLED est à false)
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dialCode, setDialCode] = useState('+212');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneChannel, setPhoneChannel] = useState('sms');
  const [phoneCode, setPhoneCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const finishAuth = () => {
    // Rechargement complet plutôt qu'un simple callback d'état : App.jsx lit la session (email,
    // profil) depuis localStorage à son montage, exactement comme pour un retour de visite normal —
    // c'est le point de handoff vers l'app existante, non modifiée.
    onAuthenticated();
  };

  const submitLogin = async () => {
    if (!email.trim() || !password) {
      setError('Renseigne ton e-mail et ton mot de passe.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginEmailAccount(email, password);
      finishAuth();
    } catch (err) {
      setError(err.message || t('toast.saveError'));
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Renseigne ton nom et ton prénom.');
      return;
    }
    if (!isPasswordStrongEnough(password)) {
      setError(t('auth.passwordRule'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!acceptedTerms) {
      setError(t('auth.mustAcceptTerms'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Champ téléphone visible mais non fonctionnel tant que PHONE_AUTH_ENABLED est à false (voir
      // src/lib/config.js) : simple donnée de profil facultative, jamais vérifiée par SMS ici.
      const fullPhone = phoneNumber.trim() ? `${dialCode}${phoneNumber.trim()}` : null;
      await createEmailAccount(email, password, language, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: fullPhone,
        acceptedMarketing,
      });
      finishAuth();
    } catch (err) {
      setError(err.message || t('toast.saveError'));
    } finally {
      setBusy(false);
    }
  };

  const submitPhoneRequest = async (channel) => {
    const digits = phoneNumber.replace(/\s+/g, '');
    if (!digits) {
      setError(t('toast.enterPhoneNumber'));
      return;
    }
    const fullPhone = `${dialCode}${digits}`;
    setPhoneChannel(channel);
    setBusy(true);
    setError(null);
    try {
      const data = await requestPhoneCode(fullPhone, fullPhone);
      setDevCode(data.devCode || null);
      setPhoneCode('');
      setScreen('phone-code');
    } catch (err) {
      setError(err.message || t('toast.codeSendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitPhoneConfirm = async () => {
    if (!phoneCode.trim()) {
      setError(t('auth.enterCode'));
      return;
    }
    const digits = phoneNumber.replace(/\s+/g, '');
    const fullPhone = `${dialCode}${digits}`;
    setBusy(true);
    setError(null);
    try {
      await confirmPhoneCode(fullPhone, fullPhone, phoneCode.trim());
      await completePhoneLogin(fullPhone);
      finishAuth();
    } catch (err) {
      setError(err.message || t('toast.wrongCode'));
    } finally {
      setBusy(false);
    }
  };

  const handleOAuthLogin = async (providerName) => {
    setBusy(true);
    setError(null);
    try {
      const provider = providerName === 'Google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      if (providerName === 'Google') provider.setCustomParameters({ prompt: 'select_account' });
      const { user: oauthUser } = await signInWithPopup(auth, provider);
      await syncOAuthAccount(providerName, oauthUser, language);
      // Rechargement : App.jsx reprend la main avec la session déjà posée dans localStorage. Si le
      // profil (genre, activités...) n'est pas encore complet, App.jsx propose lui-même l'écran de
      // complétion dès la première action qui le requiert — même comportement qu'une inscription par
      // e-mail sur le web.
      finishAuth();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(oauthErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const legalPlaceholder = (label) => setError(t('toast.legalPlaceholder', { label }));

  const switchMode = () => {
    setMode((m) => (m === 'signup' ? 'login' : 'signup'));
    setError(null);
  };

  return (
    <div className="rezo-webauth" dir={dir}>
      <div className="webauth-card">
        {screen === 'email' && (
          <>
            <div className="webauth-lang-row">
              <LangSwitcher language={language} setLanguage={setLanguage} />
            </div>

            <div className="webauth-topbar">
              <button type="button" className="webauth-back" onClick={onBack} aria-label={t('auth.back')}>
                {dir === 'rtl' ? '→' : '←'}
              </button>
              <div className="webauth-title">{mode === 'signup' ? t('auth.signupTitle') : t('auth.loginTitle')}</div>
            </div>
            <div className="webauth-subtitle">
              {mode === 'signup' ? t('auth.signupSubtitle') : t('auth.loginSubtitle')}
            </div>

            {error && <div className="webauth-error" role="alert">{error}</div>}

            {mode === 'signup' && (
              <div className="webauth-field-row">
                <div className="field">
                  <label>{t('field.lastName')}</label>
                  <input autoFocus value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="El Amrani" />
                </div>
                <div className="field">
                  <label>{t('field.firstName')}</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Yassine" />
                </div>
              </div>
            )}

            <div className="field">
              <label>{t('auth.emailLabel')}</label>
              <div className="webauth-input-icon">
                <input
                  type="email"
                  autoFocus={mode === 'login'}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.com"
                  onKeyDown={(e) => e.key === 'Enter' && mode === 'login' && submitLogin()}
                />
                <span className="webauth-input-icon-glyph">✉</span>
              </div>
              {mode === 'signup' && <span className="webauth-field-hint">{t('auth.emailHelp')}</span>}
            </div>

            <div className="field">
              <label>{t('auth.passwordLabel')}</label>
              <div className="webauth-input-icon">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Au moins 8 caractères' : 'Ton mot de passe'}
                  onKeyDown={(e) => e.key === 'Enter' && mode === 'login' && submitLogin()}
                />
                <button
                  type="button"
                  className="webauth-input-icon-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {mode === 'signup' && <span className="webauth-field-hint">{t('auth.passwordRule')}</span>}
            </div>

            {mode === 'signup' && (
              <div className="field">
                <label>{t('auth.confirmPasswordLabel')}</label>
                <div className={`webauth-input-icon ${confirm && confirm !== password ? 'mismatch' : ''}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Retape ton mot de passe"
                    onKeyDown={(e) => e.key === 'Enter' && submitSignup()}
                  />
                </div>
                {confirm && confirm !== password && (
                  <span className="webauth-mismatch-hint">{t('auth.passwordMismatch')}</span>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div className="field">
                <label>{t('field.phoneOptional')}</label>
                <div className="webauth-phone-row">
                  <select
                    className="webauth-dial-select"
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                  >
                    {DIAL_CODES.map((d) => (
                      <option key={d.country} value={d.code}>{d.flag} {d.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="6 12 34 56 78"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <button type="button" className="webauth-forgot-link" onClick={() => legalPlaceholder(t('auth.forgotPassword'))}>
                {t('auth.forgotPassword')}
              </button>
            )}

            {mode === 'signup' && (
              <>
                <label className="webauth-checkbox-row">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                  <span>
                    {interpolateNodes(t('auth.termsCheckbox'), {
                      terms: (
                        <a href="/conditions-utilisation" target="_blank" rel="noopener" className="webauth-legal-link">
                          {t('auth.termsOfUse')}
                        </a>
                      ),
                      privacy: (
                        <a href="/politique-confidentialite" target="_blank" rel="noopener" className="webauth-legal-link">
                          {t('auth.privacyPolicy')}
                        </a>
                      ),
                    })}
                  </span>
                </label>
                <label className="webauth-checkbox-row">
                  <input type="checkbox" checked={acceptedMarketing} onChange={(e) => setAcceptedMarketing(e.target.checked)} />
                  <span>{t('auth.marketingCheckbox')}</span>
                </label>
              </>
            )}

            <button
              type="button"
              className="webauth-btn webauth-btn-primary"
              disabled={
                busy ||
                !email.trim() ||
                !password ||
                (mode === 'signup' && (!confirm || !firstName.trim() || !lastName.trim() || !acceptedTerms))
              }
              onClick={mode === 'signup' ? submitSignup : submitLogin}
            >
              {busy ? '…' : mode === 'signup' ? t('auth.signupSubmit') : t('auth.login')}
            </button>

            <div className="webauth-sep"><span>{t('auth.orWith')}</span></div>

            <button type="button" className="webauth-btn webauth-oauth-btn" disabled={busy} onClick={() => handleOAuthLogin('Google')}>
              <GoogleIcon /> {t('auth.continueGoogle')}
            </button>
            <button type="button" className="webauth-btn webauth-oauth-btn" disabled={busy} onClick={() => handleOAuthLogin('Facebook')}>
              <FacebookIcon /> {t('auth.continueFacebook')}
            </button>

            <button type="button" className="webauth-switch" onClick={switchMode}>
              {interpolateNodes(mode === 'signup' ? t('auth.hasAccount') : t('auth.noAccount'), {
                action: (
                  <span className="webauth-switch-link">
                    {mode === 'signup' ? t('auth.loginLink') : t('auth.createAccount')}
                  </span>
                ),
              })}
            </button>
          </>
        )}

        {screen === 'phone-code' && (
          <>
            <button type="button" className="webauth-back" onClick={() => setScreen('email')}>← {t('auth.back')}</button>
            <h1 className="webauth-title">{t('auth.codeLabel')}</h1>
            {devCode && <div className="webauth-devcode">{t('field.demoCodeNoSms')} <strong>{devCode}</strong></div>}
            {error && <div className="webauth-error">{error}</div>}
            <div className="field">
              <label>{t('auth.codeLabel')}</label>
              <input
                autoFocus
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                placeholder={t('field.sixDigitCode')}
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && submitPhoneConfirm()}
              />
            </div>
            <button type="button" className="webauth-btn webauth-btn-primary" disabled={busy || !phoneCode.trim()} onClick={submitPhoneConfirm}>
              {busy ? `${t('auth.verify')}…` : t('auth.verify')}
            </button>
            <button type="button" className="webauth-switch" disabled={busy} onClick={() => submitPhoneRequest(phoneChannel)}>
              {t('auth.resendCode')}
            </button>
          </>
        )}
      </div>

      {/* Même palette claire que le reste de l'app RÉZO (voir modal-auth-dark dans App.jsx pour
          l'équivalent mobile, valeurs identiques) : fond blanc, accent bleu #1877F2 — remplace le
          thème sombre/turquoise d'une maquette de référence externe, qui tranchait avec le reste de
          l'app. Dupliqué plutôt qu'importé : contrainte d'isolation totale entre WebAuth.jsx et
          App.jsx. */}
      <style>{`
        .rezo-webauth {
          --ink: #F5F5F7;
          --card: #FFFFFF;
          --card-hover: #F7F8FA;
          --border: #DADDE1;
          --border-strong: #C6C9CC;
          --text: #1C1E21;
          --muted: #65676B;
          --live: #1877F2;
          --live-rgb: 24, 119, 242;
          --amber: #F2A65A;
          min-height: 100dvh; width: 100%; background: var(--card);
          display: flex; align-items: center; justify-content: center; padding: 32px 16px;
          font-family: 'Inter', -apple-system, sans-serif; color: var(--text);
        }
        .webauth-card {
          width: 100%; max-width: 400px; background: var(--card);
          border-radius: 20px; padding: 8px 4px 4px;
        }
        .webauth-lang-row { display: flex; justify-content: flex-start; margin-bottom: 14px; }
        .webauth-lang-wrap { position: relative; display: inline-block; }
        .webauth-lang-btn {
          background: var(--ink); border: 1px solid var(--border); border-radius: 999px;
          padding: 5px 10px; font-size: 12px; font-weight: 600; color: var(--text);
          cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .webauth-lang-btn:hover { border-color: var(--border-strong); }
        .webauth-lang-menu {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 10;
          background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.12); padding: 4px; min-width: 140px;
          display: flex; flex-direction: column; gap: 2px;
        }
        [dir="rtl"] .webauth-lang-menu { left: auto; right: 0; }
        .webauth-lang-item {
          background: none; border: none; text-align: left; padding: 8px 10px; border-radius: 7px;
          font-size: 12.5px; color: var(--text); cursor: pointer; font-family: 'Inter', sans-serif;
        }
        [dir="rtl"] .webauth-lang-item { text-align: right; }
        .webauth-lang-item:hover { background: var(--card-hover); }
        .webauth-lang-item.active { background: rgba(var(--live-rgb),0.12); color: var(--live); font-weight: 600; }

        .webauth-topbar {
          position: relative; display: flex; align-items: center; justify-content: center;
          height: 40px; margin-bottom: 6px;
        }
        .webauth-back {
          position: absolute; left: 0; top: 50%; transform: translateY(-50%);
          width: 36px; height: 36px; border-radius: 50%; background: var(--ink);
          border: none; color: var(--text); font-size: 16px; display: flex; align-items: center;
          justify-content: center; cursor: pointer;
        }
        [dir="rtl"] .webauth-back { left: auto; right: 0; }
        .webauth-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700;
          color: var(--text); text-align: center;
        }
        .webauth-subtitle {
          color: var(--muted); font-size: 13px; line-height: 1.55; text-align: center; margin: 10px 0 22px;
        }
        .webauth-error {
          background: rgba(239,122,155,0.1); border: 1px solid rgba(239,122,155,0.35); color: #EF7A9B;
          border-radius: 8px; padding: 8px 10px; font-size: 12px; margin-bottom: 10px; line-height: 1.4;
        }
        .webauth-devcode {
          background: rgba(var(--live-rgb),0.1); border: 1px solid rgba(var(--live-rgb),0.3); color: var(--live);
          font-size: 12.5px; padding: 10px 12px; border-radius: 10px; margin-bottom: 12px;
        }
        .webauth-field-row { display: flex; gap: 10px; }
        .webauth-field-row .field { flex: 1; min-width: 0; }
        .webauth-card .field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
        .webauth-card .field label { font-size: 12px; color: var(--muted); }
        .webauth-field-hint { display: block; font-size: 11px; color: var(--muted); margin-top: -2px; }
        .webauth-mismatch-hint { font-size: 11px; color: var(--amber); }
        .webauth-input-icon {
          display: flex; align-items: center; gap: 8px;
          background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 0 11px;
        }
        .webauth-input-icon:focus-within { border-color: var(--live); }
        .webauth-input-icon.mismatch { border-color: var(--amber); }
        .webauth-input-icon-glyph { color: var(--muted); font-size: 13px; flex-shrink: 0; }
        .webauth-input-icon-btn {
          background: none; border: none; color: var(--muted); cursor: pointer;
          display: flex; align-items: center; padding: 4px; flex-shrink: 0; font-size: 14px;
        }
        .webauth-card .field input, .webauth-card .field select {
          border: none; background: transparent; padding: 10px 0; flex: 1; min-width: 0;
          color: var(--text); font-size: 14px; font-family: 'Inter', sans-serif; outline: none;
          width: 100%;
        }
        .webauth-phone-row { display: flex; gap: 8px; }
        .webauth-dial-select {
          flex: 0 0 108px; background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 8px; color: var(--text); font-size: 13.5px; font-family: 'Inter', sans-serif;
        }
        .webauth-phone-row input { flex: 1; min-width: 0; background: var(--ink); border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; }
        .webauth-forgot-link {
          display: block; width: 100%; text-align: right; background: none; border: none;
          color: var(--live); font-size: 12px; cursor: pointer; margin: -6px 0 10px;
          font-family: 'Inter', sans-serif;
        }
        [dir="rtl"] .webauth-forgot-link { text-align: left; }
        .webauth-checkbox-row {
          display: flex; align-items: flex-start; gap: 9px; margin: 10px 0; cursor: pointer;
          font-size: 11.5px; color: var(--muted); line-height: 1.5;
        }
        .webauth-checkbox-row input[type="checkbox"] {
          flex-shrink: 0; width: 16px; height: 16px; margin-top: 1px; accent-color: var(--live); cursor: pointer;
        }
        .webauth-legal-link {
          background: none; border: none; padding: 0; color: var(--live); font-size: inherit;
          cursor: pointer; text-decoration: underline; font-family: inherit;
        }
        .webauth-btn {
          width: 100%; padding: 12px; border-radius: 12px; font-size: 13.5px; font-weight: 700;
          cursor: pointer; margin-bottom: 10px; font-family: 'Inter', sans-serif; border: none;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .webauth-btn-primary { background: linear-gradient(135deg, #1877F2, #145DBF); color: #fff; box-shadow: 0 6px 16px rgba(var(--live-rgb),0.28); }
        .webauth-btn-primary:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
        .webauth-oauth-btn { background: var(--card); color: var(--text); border: 1px solid var(--border); }
        .webauth-oauth-btn:hover { background: var(--card-hover); }
        .webauth-oauth-btn:disabled { opacity: 0.6; cursor: default; }
        .webauth-sep {
          display: flex; align-items: center; gap: 10px; margin: 16px 0; color: var(--muted); font-size: 11.5px;
        }
        .webauth-sep::before, .webauth-sep::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .webauth-switch {
          display: block; width: 100%; text-align: center; background: none; border: none;
          color: var(--muted); font-size: 12.5px; cursor: pointer; margin-top: 6px;
          font-family: 'Inter', sans-serif;
        }
        .webauth-switch-link { text-decoration: underline; font-weight: 600; color: var(--live); }
      `}</style>
    </div>
  );
}
