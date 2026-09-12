import React from 'react';

// Pages légales (CGU + politique de confidentialité) — voir main.jsx pour leur routage
// (/conditions-utilisation, /politique-confidentialite), accessible sans connexion, sur mobile
// comme sur desktop, indépendamment de isMobileUserAgent()/loggedIn (voir Root() dans main.jsx).
//
// ⚠️ Contenu fourni tel quel par le produit : un brouillon de base cohérent avec les fonctionnalités
// réelles de l'app, PAS un texte validé par un juriste. Avant un vrai lancement public — vu les
// données sensibles collectées (sexe, localisation, photos) — à faire relire par un avocat, la loi
// marocaine 09-08 encadrant la protection des données personnelles.
const LAST_UPDATED = '12 septembre 2026';
const CONTACT_EMAIL = 'contact@rezomeet.com';

const TERMS_SECTIONS = [
  {
    heading: '1. Objet',
    paragraphs: [
      "RÉZO est une plateforme qui permet à ses utilisateurs d'organiser et de rejoindre des rencontres physiques groupées par activité (sport, culture, musique, jeux, bien-être...). En créant un compte, tu acceptes les présentes conditions.",
    ],
  },
  {
    heading: '2. Âge minimum',
    paragraphs: [
      "L'accès à RÉZO est réservé aux personnes âgées de 16 ans ou plus. En créant un compte, tu confirmes avoir l'âge requis.",
    ],
  },
  {
    heading: '3. Ton compte',
    list: [
      'Les informations fournies (nom, prénom, sexe, ville) doivent être exactes',
      'Tu es responsable de la confidentialité de tes identifiants de connexion',
      'Un compte est personnel et ne doit pas être partagé',
    ],
  },
  {
    heading: '4. Fonctionnement du service',
    list: [
      'Toute personne peut créer une rencontre ou demander à en rejoindre une',
      "L'organisateur d'une rencontre valide ou refuse chaque demande de participation",
      'RÉZO propose des rencontres réservées à un sexe (100% Femmes / 100% Hommes) ou mixtes, au choix de l\'organisateur',
    ],
  },
  {
    heading: '5. Règles de conduite',
    paragraphs: ['En utilisant RÉZO, tu t\'engages à :'],
    list: [
      'Ne pas créer de faux profil ni usurper l\'identité d\'autrui',
      'Traiter les autres membres avec respect',
      'Ne pas utiliser la plateforme à des fins commerciales, de spam ou frauduleuses',
      'Signaler tout comportement inapproprié via la fonction de signalement',
    ],
  },
  {
    heading: '6. Modération',
    paragraphs: [
      'RÉZO se réserve le droit de suspendre ou supprimer tout compte ou toute rencontre ne respectant pas ces règles, notamment en cas de signalements répétés.',
    ],
  },
  {
    heading: '7. Rencontres physiques : ta responsabilité',
    paragraphs: [
      "RÉZO est un service de mise en relation. Les rencontres organisées via la plateforme se déroulent sous la responsabilité de leurs participants. RÉZO ne peut garantir le comportement des utilisateurs ni le déroulement des événements, et n'est pas responsable des incidents survenant lors d'une rencontre. Nous t'encourageons à rester prudent·e, notamment lors d'une première rencontre avec des inconnus.",
    ],
  },
  {
    heading: '8. Suppression de compte',
    paragraphs: [
      'Tu peux supprimer ton compte à tout moment depuis Profil → Paramètres. Cela entraîne la suppression de tes données personnelles conformément à notre Politique de confidentialité.',
    ],
  },
  {
    heading: '9. Modification des présentes conditions',
    paragraphs: [
      'RÉZO peut modifier ces conditions ; en cas de changement important, tu en seras informé·e via l\'application.',
    ],
  },
  {
    heading: '10. Contact',
    paragraphs: [`Pour toute question : ${CONTACT_EMAIL}`],
  },
];

const PRIVACY_SECTIONS = [
  {
    heading: '1. Données que nous collectons',
    list: [
      'Identité : nom, prénom, sexe, date de naissance',
      'Localisation : pays, ville déclarée ; position GPS uniquement si tu actives volontairement "Activités proches de moi" ou "Mon trajet"',
      'Photo de profil (optionnelle)',
      'Coordonnées de connexion : e-mail et/ou numéro de téléphone',
      'Contenu que tu publies : rencontres créées, messages de chat, avis',
    ],
  },
  {
    heading: '2. Pourquoi nous les utilisons',
    list: [
      'Te mettre en relation avec des rencontres pertinentes près de chez toi',
      'Permettre aux organisateurs de valider les participants',
      'Assurer la sécurité de la plateforme (vérification, signalement, modération)',
      'Afficher ton profil aux autres membres (prénom, photo, avis)',
    ],
  },
  {
    heading: '3. Qui a accès à tes données',
    list: [
      'Les autres utilisateurs voient : ton prénom, ta photo, tes avis, les rencontres auxquelles tu participes publiquement',
      'Ton nom de famille, ton e-mail et ton numéro de téléphone restent privés, jamais affichés publiquement',
      'Nos prestataires techniques (hébergement des données : Google Firebase/Cloud) traitent tes données pour notre compte, sous contrat de confidentialité',
      'RÉZO ne vend jamais tes données à des tiers',
    ],
  },
  {
    heading: '4. Durée de conservation',
    paragraphs: [
      'Tes données sont conservées tant que ton compte est actif. En cas de suppression de compte, tes données personnelles sont supprimées sous 30 jours, à l\'exception des données nécessaires au respect d\'obligations légales.',
    ],
  },
  {
    heading: '5. Tes droits',
    paragraphs: [
      `Conformément à la loi 09-08 (Maroc) et aux réglementations applicables, tu disposes d'un droit d'accès, de rectification, de suppression et d'opposition sur tes données. Tu peux exercer ces droits depuis Profil → Paramètres, ou en nous contactant à ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '6. Sécurité',
    paragraphs: [
      'Nous mettons en œuvre des mesures techniques pour protéger tes données (chiffrement des connexions HTTPS, règles d\'accès restreintes à notre base de données).',
    ],
  },
  {
    heading: '7. Localisation en temps réel',
    paragraphs: [
      'La fonctionnalité "Mon trajet" ne partage jamais ta position en continu avec les autres membres — seule ton arrivée sur place (un simple horodatage) leur est signalée. Ta position GPS n\'est jamais stockée au-delà de la détection d\'arrivée.',
    ],
  },
  {
    heading: '8. Cookies et stockage local',
    paragraphs: [
      'RÉZO utilise le stockage local de ton navigateur pour te garder connecté·e et mémoriser tes préférences — pas de cookies publicitaires ni de tracking tiers.',
    ],
  },
  {
    heading: '9. Modifications',
    paragraphs: [
      'Nous pouvons mettre à jour cette politique ; tout changement important te sera notifié dans l\'application.',
    ],
  },
  {
    heading: '10. Contact',
    paragraphs: [`Pour toute question relative à tes données : ${CONTACT_EMAIL}`],
  },
];

const PAGES = {
  terms: { title: "Conditions Générales d'Utilisation de RÉZO", sections: TERMS_SECTIONS },
  privacy: { title: 'Politique de confidentialité de RÉZO', sections: PRIVACY_SECTIONS },
};

// Chemins réels (voir Root() dans main.jsx, et public/404.html pour leur rechargement direct sur
// GitHub Pages) — utilisés à la fois pour le routage et pour générer les liens réels ailleurs
// (écrans de connexion/inscription, footer de la landing).
export const LEGAL_PATHS = {
  terms: '/conditions-utilisation',
  privacy: '/politique-confidentialite',
};

export function legalPageForPath(pathname) {
  if (pathname === LEGAL_PATHS.terms) return 'terms';
  if (pathname === LEGAL_PATHS.privacy) return 'privacy';
  return null;
}

export default function LegalPage({ page }) {
  const content = PAGES[page];
  if (!content) return null;
  return (
    <div className="rezo-legal">
      <header className="legal-header">
        <a href="/" className="legal-brand">RÉZO<span className="dot">·</span></a>
        <a href="/" className="legal-back">← Retour à l'accueil</a>
      </header>
      <main className="legal-main">
        <h1>{content.title}</h1>
        <p className="legal-updated">Dernière mise à jour : {LAST_UPDATED}</p>
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {section.list && (
              <ul>
                {section.list.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
        <p className="legal-cross-link">
          {page === 'terms' ? (
            <a href={LEGAL_PATHS.privacy}>Consulter la politique de confidentialité →</a>
          ) : (
            <a href={LEGAL_PATHS.terms}>Consulter les conditions générales d'utilisation →</a>
          )}
        </p>
      </main>

      <style>{`
        .rezo-legal {
          --live: #1877F2; --ink: #0B0C10; --text: #17181C; --muted: #6b7280;
          --border: #E7E9EE; --card: #FFFFFF; --bg: #F7F8FA;
          min-height: 100dvh; width: 100%; background: var(--bg); color: var(--text);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .legal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--card);
          position: sticky; top: 0;
        }
        .legal-brand {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px;
          color: var(--text); text-decoration: none;
        }
        .legal-brand .dot { color: var(--live); }
        .legal-back { color: var(--live); text-decoration: none; font-size: 13.5px; font-weight: 600; }
        .legal-back:hover { text-decoration: underline; }
        .legal-main {
          max-width: 720px; margin: 0 auto; padding: 32px 20px 64px;
          line-height: 1.65; font-size: 14.5px;
        }
        .legal-main h1 {
          font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 700;
          margin: 0 0 6px;
        }
        .legal-updated { color: var(--muted); font-size: 13px; margin: 0 0 32px; }
        .legal-main h2 {
          font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700;
          margin: 28px 0 10px;
        }
        .legal-main p { margin: 0 0 12px; color: var(--text); }
        .legal-main ul { margin: 0 0 12px; padding-inline-start: 22px; }
        .legal-main li { margin-bottom: 6px; }
        .legal-cross-link { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); }
        .legal-cross-link a { color: var(--live); text-decoration: none; font-weight: 600; font-size: 13.5px; }
        .legal-cross-link a:hover { text-decoration: underline; }

        @media (min-width: 768px) {
          .legal-header { padding: 18px 40px; }
          .legal-main { padding: 48px 40px 96px; font-size: 15px; }
          .legal-main h1 { font-size: 30px; }
        }
      `}</style>
    </div>
  );
}
