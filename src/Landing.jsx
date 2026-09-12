import React, { useState } from 'react';
import { LANGUAGES } from './lib/i18n.js';

const BASE = import.meta.env.BASE_URL;

const USE_CASES = [
  { key: 'foot', emoji: '⚽' },
  { key: 'cafe', emoji: '☕' },
  { key: 'women', emoji: '👩' },
  { key: 'games', emoji: '🎮' },
];

const FAQ_ITEMS = ['q1', 'q2', 'q3', 'q4'];

const SCREENSHOTS = [
  { src: `${BASE}landing/shot-home.png`, alt: 'Flux de rencontres' },
  { src: `${BASE}landing/shot-create.png`, alt: 'Création de rencontre' },
  { src: `${BASE}landing/shot-filters.png`, alt: 'Filtres' },
  { src: `${BASE}landing/shot-profile.png`, alt: 'Profil' },
];

function LangSwitcher({ language, setLanguage }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  return (
    <div className="landing-lang-wrap">
      <button type="button" className="landing-lang-btn" onClick={() => setOpen((v) => !v)}>
        {current.flag} {current.code.toUpperCase()}
      </button>
      {open && (
        <div className="landing-lang-menu">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`landing-lang-item ${l.code === language ? 'active' : ''}`}
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

function FaqRow({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`landing-faq-row ${open ? 'open' : ''}`}>
      <button type="button" className="landing-faq-question" onClick={() => setOpen((v) => !v)}>
        {question}
        <span className="landing-faq-chevron">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="landing-faq-answer">{answer}</div>}
    </div>
  );
}

export default function Landing({ language, setLanguage, dir, t, onGoAuth }) {
  const [heroImgOk, setHeroImgOk] = useState(true);

  return (
    <div className="rezo-landing" dir={dir}>
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo">RÉZO<span className="dot">·</span></div>
          <nav className="landing-nav">
            <a href="#comment-ca-marche">{t('landing.nav.howItWorks')}</a>
            <a href="#fonctionnalites">{t('landing.nav.features')}</a>
            <a href="#securite">{t('landing.nav.security')}</a>
            <a href="#faq">{t('landing.nav.faq')}</a>
          </nav>
          <div className="landing-header-actions">
            <LangSwitcher language={language} setLanguage={setLanguage} />
            <button type="button" className="landing-btn landing-btn-ghost" onClick={() => onGoAuth('login')}>
              {t('landing.nav.login')}
            </button>
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => onGoAuth('signup')}>
              {t('landing.nav.signup')}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-text">
            <h1>{t('landing.hero.title')}</h1>
            <p>{t('landing.hero.subtitle')}</p>
            <button type="button" className="landing-btn landing-btn-primary landing-btn-lg" onClick={() => onGoAuth('signup')}>
              {t('landing.hero.cta')}
            </button>
          </div>
          <div className="landing-hero-visual">
            <div className="landing-phone-frame">
              {heroImgOk ? (
                <img
                  src={`${BASE}landing/shot-home.png`}
                  alt={t('landing.hero.mockupAlt')}
                  onError={() => setHeroImgOk(false)}
                />
              ) : (
                <div className="landing-phone-placeholder" />
              )}
            </div>
          </div>
        </section>

        <section id="comment-ca-marche" className="landing-section">
          <h2>{t('landing.howItWorks.title')}</h2>
          <div className="landing-steps">
            {[1, 2, 3, 4].map((n) => (
              <div className="landing-step" key={n}>
                <div className="landing-step-num">{n}</div>
                <h3>{t(`landing.howItWorks.step${n}.title`)}</h3>
                <p>{t(`landing.howItWorks.step${n}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnalites" className="landing-section landing-section-alt">
          <h2>{t('landing.useCases.title')}</h2>
          <div className="landing-usecases">
            {USE_CASES.map((u) => (
              <div className="landing-usecase-card" key={u.key}>
                {t(`landing.useCases.${u.key}`)}
              </div>
            ))}
          </div>
        </section>

        <section id="securite" className="landing-section">
          <h2>{t('landing.trust.title')}</h2>
          <div className="landing-trust-grid">
            <div className="landing-trust-item">✅ {t('landing.trust.verification')}</div>
            <div className="landing-trust-item">✅ {t('landing.trust.validation')}</div>
            <div className="landing-trust-item">✅ {t('landing.trust.ratings')}</div>
            <div className="landing-trust-item">✅ {t('landing.trust.moderation')}</div>
          </div>
        </section>

        <section className="landing-section landing-section-alt">
          <h2>{t('landing.demo.title')}</h2>
          <div className="landing-carousel">
            {SCREENSHOTS.map((s) => (
              <div className="landing-carousel-item" key={s.src}>
                <img src={s.src} alt={s.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-section landing-section-narrow">
          <h2>{t('landing.faq.title')}</h2>
          <div className="landing-faq-list">
            {FAQ_ITEMS.map((q) => (
              <FaqRow key={q} question={t(`landing.faq.${q}`)} answer={t(`landing.faq.a${q.slice(1)}`)} />
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">RÉZO<span className="dot">·</span></div>
          <div className="landing-footer-links">
            <a href="/conditions-utilisation" target="_blank" rel="noopener">{t('landing.footer.terms')}</a>
            <a href="/politique-confidentialite" target="_blank" rel="noopener">{t('landing.footer.privacy')}</a>
            <a href="#">{t('landing.footer.contact')}</a>
          </div>
          <LangSwitcher language={language} setLanguage={setLanguage} />
        </div>
        <div className="landing-footer-bottom">
          © {new Date().getFullYear()} RÉZO — {t('landing.footer.rights')}
        </div>
      </footer>

      <style>{`
        .rezo-landing {
          --live: #2F6BFF; --ink: #0B0C10; --text: #17181C; --muted: #6b7280;
          --border: #E7E9EE; --card: #FFFFFF; --bg: #F7F8FA;
          background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, sans-serif;
          min-height: 100dvh; width: 100%;
        }
        .rezo-landing h1, .rezo-landing h2, .rezo-landing h3 {
          font-family: 'Space Grotesk', sans-serif; margin: 0;
        }
        .rezo-landing a { color: inherit; text-decoration: none; }
        .rezo-landing .dot { color: var(--live); }

        .landing-header {
          position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,0.9);
          backdrop-filter: blur(8px); border-bottom: 1px solid var(--border);
        }
        .landing-header-inner {
          max-width: 1120px; margin: 0 auto; padding: 16px 24px;
          display: flex; align-items: center; gap: 32px;
        }
        .landing-logo { font-weight: 700; font-size: 20px; letter-spacing: 0.02em; }
        .landing-nav { display: flex; gap: 24px; flex: 1; font-size: 14px; font-weight: 600; color: var(--muted); }
        .landing-nav a:hover { color: var(--text); }
        .landing-header-actions { display: flex; align-items: center; gap: 10px; }

        .landing-btn {
          font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 700;
          padding: 9px 18px; border-radius: 999px; cursor: pointer; border: none;
        }
        .landing-btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .landing-btn-primary { background: var(--live); color: #fff; }
        .landing-btn-primary:hover { filter: brightness(1.08); }
        .landing-btn-lg { padding: 13px 26px; font-size: 15px; margin-top: 22px; }

        .landing-lang-wrap { position: relative; }
        .landing-lang-btn {
          background: transparent; border: 1px solid var(--border); border-radius: 999px;
          padding: 7px 12px; font-size: 12.5px; font-weight: 700; cursor: pointer; color: var(--text);
        }
        .landing-lang-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 10;
          background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.14); overflow: hidden; min-width: 150px;
        }
        [dir="rtl"] .landing-lang-menu { right: auto; left: 0; }
        .landing-lang-item {
          display: block; width: 100%; text-align: start; background: none; border: none;
          padding: 10px 14px; font-size: 13px; cursor: pointer; color: var(--text);
        }
        .landing-lang-item:hover { background: var(--bg); }
        .landing-lang-item.active { color: var(--live); font-weight: 700; }

        .landing-hero {
          max-width: 1120px; margin: 0 auto; padding: 64px 24px 40px;
          display: flex; align-items: center; gap: 48px; flex-wrap: wrap;
        }
        .landing-hero-text { flex: 1; min-width: 320px; }
        .landing-hero-text h1 { font-size: 40px; line-height: 1.15; font-weight: 700; }
        .landing-hero-text p { margin-top: 18px; font-size: 16px; color: var(--muted); line-height: 1.6; max-width: 480px; }
        .landing-hero-visual { flex: 1; min-width: 280px; display: flex; justify-content: center; }
        .landing-phone-frame {
          width: 280px; height: 580px; border-radius: 36px; overflow: hidden; background: var(--ink);
          box-shadow: 0 30px 80px rgba(0,0,0,0.25), 0 0 0 8px #05060a, 0 0 0 10px #23262f;
        }
        .landing-phone-frame img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
        .landing-phone-placeholder { width: 100%; height: 100%; background: linear-gradient(160deg, #2F6BFF, #17193a); }

        .landing-section { max-width: 1120px; margin: 0 auto; padding: 56px 24px; }
        .landing-section-alt { background: var(--card); max-width: none; }
        .landing-section-alt > * { max-width: 1120px; margin-left: auto; margin-right: auto; }
        .landing-section-narrow { max-width: 720px; }
        .landing-section h2 { font-size: 28px; text-align: center; margin-bottom: 36px; }

        .landing-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .landing-step { text-align: center; }
        .landing-step-num {
          width: 36px; height: 36px; border-radius: 50%; background: var(--live); color: #fff;
          display: flex; align-items: center; justify-content: center; font-weight: 700;
          margin: 0 auto 14px;
        }
        .landing-step h3 { font-size: 15.5px; margin-bottom: 8px; }
        .landing-step p { font-size: 13.5px; color: var(--muted); line-height: 1.5; }

        .landing-usecases { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .landing-usecase-card {
          background: var(--bg); border: 1px solid var(--border); border-radius: 16px;
          padding: 22px 18px; font-size: 14.5px; font-weight: 600; text-align: center;
        }

        .landing-trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .landing-trust-item {
          background: var(--card); border: 1px solid var(--border); border-radius: 14px;
          padding: 18px; font-size: 14px; font-weight: 600; text-align: center;
        }

        .landing-carousel {
          display: flex; gap: 20px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory;
        }
        .landing-carousel-item {
          flex: 0 0 auto; width: 220px; border-radius: 20px; overflow: hidden; scroll-snap-align: start;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12); border: 1px solid var(--border);
        }
        .landing-carousel-item img { width: 100%; display: block; }

        .landing-faq-list { display: flex; flex-direction: column; gap: 10px; }
        .landing-faq-row {
          background: var(--card); border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
        }
        .landing-faq-question {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          background: none; border: none; padding: 16px 18px; font-size: 14.5px; font-weight: 700;
          cursor: pointer; text-align: start; color: var(--text); font-family: 'Inter', sans-serif;
        }
        .landing-faq-chevron { color: var(--live); font-size: 18px; }
        .landing-faq-answer { padding: 0 18px 16px; font-size: 13.5px; color: var(--muted); line-height: 1.6; }

        .landing-footer { border-top: 1px solid var(--border); padding: 32px 24px 20px; }
        .landing-footer-inner {
          max-width: 1120px; margin: 0 auto; display: flex; align-items: center;
          gap: 24px; flex-wrap: wrap; justify-content: space-between;
        }
        .landing-footer-brand { font-weight: 700; font-size: 17px; }
        .landing-footer-links { display: flex; gap: 20px; font-size: 13px; color: var(--muted); }
        .landing-footer-links a:hover { color: var(--text); }
        .landing-footer-bottom {
          max-width: 1120px; margin: 20px auto 0; font-size: 12px; color: var(--muted); text-align: center;
        }

        @media (max-width: 860px) {
          .landing-nav { display: none; }
          .landing-steps, .landing-usecases, .landing-trust-grid { grid-template-columns: repeat(2, 1fr); }
          .landing-hero-text h1 { font-size: 30px; }
        }
      `}</style>
    </div>
  );
}
