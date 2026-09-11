import React, { useState } from 'react';
import { requestPhoneCode, confirmPhoneCode } from './lib/verify.js';
import { createEmailAccount, loginEmailAccount, completePhoneLogin, DIAL_CODES } from './lib/webAuth.js';

// Écran de connexion/inscription dédié au web (voir Landing.jsx et la contrainte d'isolation totale
// vis-à-vis de App.jsx dans main.jsx). Reproduit le même choix de méthodes que le flux mobile
// (téléphone SMS/WhatsApp, e-mail, Google/Facebook) sans remplacer ni modifier ce flux mobile —
// une fois authentifié ici, la page se recharge et l'app existante (inchangée) reprend la main avec
// la session déjà posée dans localStorage (voir webAuth.js).
export default function WebAuth({ language, t, initialMode = 'login', onBack, onAuthenticated }) {
  const [screen, setScreen] = useState('choose'); // 'choose' | 'email' | 'phone-code'
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [dialCode, setDialCode] = useState('+212');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneChannel, setPhoneChannel] = useState('sms');
  const [phoneCode, setPhoneCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const finishAuth = () => {
    // Rechargement complet plutôt qu'un simple callback d'état : App.jsx lit la session (email,
    // profil) depuis localStorage à son montage, exactement comme pour un retour de visite normal —
    // c'est le point de handoff vers l'app existante, non modifiée.
    onAuthenticated();
  };

  const submitEmail = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (password !== confirm) throw new Error(t('auth.passwordMismatch'));
        await createEmailAccount(email, password, language);
      } else {
        await loginEmailAccount(email, password);
      }
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

  const oauthStub = (provider) => setError(t('toast.oauthUnavailable', { provider }));

  return (
    <div className="rezo-webauth">
      <div className="webauth-card">
        {screen === 'choose' && (
          <>
            <button type="button" className="webauth-back" onClick={onBack}>← {t('landing.backToSite')}</button>
            <h1>{t('auth.title')}</h1>
            <p className="webauth-intro">{t('auth.intro')}</p>
            {error && <div className="webauth-error">{error}</div>}

            <div className="field">
              <label>{t('auth.phoneLabel')}</label>
              <div className="webauth-phone-row">
                <select value={dialCode} onChange={(e) => setDialCode(e.target.value)}>
                  {DIAL_CODES.map((d) => (
                    <option key={d.country} value={d.code}>{d.flag} {d.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="6 12 34 56 78"
                  onKeyDown={(e) => e.key === 'Enter' && submitPhoneRequest('sms')}
                />
              </div>
            </div>
            <button type="button" className="webauth-btn webauth-btn-outline" disabled={busy} onClick={() => submitPhoneRequest('whatsapp')}>
              {t('auth.whatsapp')}
            </button>
            <button type="button" className="webauth-btn webauth-btn-outline" disabled={busy} onClick={() => submitPhoneRequest('sms')}>
              {t('auth.sms')}
            </button>

            <div className="webauth-sep"><span>ou avec</span></div>

            <button type="button" className="webauth-btn webauth-btn-outline" onClick={() => oauthStub('Google')}>{t('auth.continueGoogle')}</button>
            <button type="button" className="webauth-btn webauth-btn-outline" onClick={() => oauthStub('Facebook')}>{t('auth.continueFacebook')}</button>
            <button type="button" className="webauth-btn webauth-btn-outline" onClick={() => setScreen('email')}>{t('auth.continueEmail')}</button>

            <button type="button" className="webauth-switch" onClick={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}>
              {mode === 'signup' ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
          </>
        )}

        {screen === 'email' && (
          <>
            <button type="button" className="webauth-back" onClick={() => setScreen('choose')}>← {t('auth.back')}</button>
            <h1>{mode === 'signup' ? t('auth.createAccount') : t('auth.emailLoginTitle')}</h1>
            {error && <div className="webauth-error">{error}</div>}
            <div className="field">
              <label>{t('auth.emailLabel')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
            </div>
            <div className="field">
              <label>{t('auth.passwordLabel')}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 6 caractères" />
            </div>
            {mode === 'signup' && (
              <div className="field">
                <label>{t('auth.confirmPasswordLabel')}</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Retape ton mot de passe" />
              </div>
            )}
            <button
              type="button"
              className="webauth-btn webauth-btn-primary"
              disabled={busy || !email.trim() || !password || (mode === 'signup' && !confirm)}
              onClick={submitEmail}
            >
              {busy ? '…' : mode === 'signup' ? t('auth.createAccount') : t('auth.login')}
            </button>
            <button type="button" className="webauth-switch" onClick={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}>
              {mode === 'signup' ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
          </>
        )}

        {screen === 'phone-code' && (
          <>
            <button type="button" className="webauth-back" onClick={() => setScreen('choose')}>← {t('auth.back')}</button>
            <h1>{t('auth.codeLabel')}</h1>
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

      <style>{`
        .rezo-webauth {
          min-height: 100dvh; width: 100%; background: #F7F8FA;
          display: flex; align-items: center; justify-content: center; padding: 32px 16px;
          font-family: 'Inter', -apple-system, sans-serif; color: #17181C;
        }
        .webauth-card {
          width: 100%; max-width: 380px; background: #fff; border: 1px solid #E7E9EE;
          border-radius: 20px; padding: 28px 26px; box-shadow: 0 20px 60px rgba(0,0,0,0.08);
        }
        .webauth-card h1 { font-family: 'Space Grotesk', sans-serif; font-size: 20px; margin: 12px 0 6px; }
        .webauth-intro { font-size: 13px; color: #6b7280; margin: 0 0 18px; }
        .webauth-back {
          background: none; border: none; color: #6b7280; font-size: 13px; cursor: pointer;
          padding: 0; margin-bottom: 6px; font-family: 'Inter', sans-serif;
        }
        .webauth-error {
          background: rgba(220,38,38,0.08); color: #DC2626; font-size: 12.5px;
          padding: 10px 12px; border-radius: 10px; margin-bottom: 12px;
        }
        .webauth-devcode {
          background: rgba(47,107,255,0.08); color: #2F6BFF; font-size: 12.5px;
          padding: 10px 12px; border-radius: 10px; margin-bottom: 12px;
        }
        .webauth-card .field { margin-bottom: 14px; }
        .webauth-card .field label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 6px; color: #444; }
        .webauth-card .field input, .webauth-card .field select {
          width: 100%; padding: 11px 12px; border-radius: 10px; border: 1px solid #E7E9EE;
          font-size: 14px; font-family: 'Inter', sans-serif; background: #F7F8FA; color: #17181C;
        }
        .webauth-phone-row { display: flex; gap: 8px; }
        .webauth-phone-row select { flex: 0 0 110px; }
        .webauth-phone-row input { flex: 1; }
        .webauth-btn {
          width: 100%; padding: 12px; border-radius: 12px; font-size: 13.5px; font-weight: 700;
          cursor: pointer; margin-bottom: 10px; font-family: 'Inter', sans-serif;
        }
        .webauth-btn-primary { background: #2F6BFF; color: #fff; border: none; }
        .webauth-btn-primary:disabled { opacity: 0.6; cursor: default; }
        .webauth-btn-outline { background: #fff; color: #17181C; border: 1px solid #E7E9EE; }
        .webauth-btn-outline:hover { border-color: #2F6BFF; }
        .webauth-sep { text-align: center; font-size: 11.5px; color: #9ca3af; margin: 14px 0; position: relative; }
        .webauth-sep::before, .webauth-sep::after {
          content: ''; position: absolute; top: 50%; width: 40%; height: 1px; background: #E7E9EE;
        }
        .webauth-sep::before { left: 0; }
        .webauth-sep::after { right: 0; }
        .webauth-switch {
          display: block; width: 100%; text-align: center; background: none; border: none;
          color: #2F6BFF; font-size: 12.5px; font-weight: 600; cursor: pointer; margin-top: 6px;
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </div>
  );
}
