/**
 * Script de contenu de démarrage ("seed") pour REZO.
 *
 * Problème "ville fantôme" : un utilisateur qui arrive sur un flux vide ne
 * revient jamais. Ce script amorce la pompe en publiant une quinzaine de
 * rencontres réalistes directement dans Firestore, comme si l'équipe RÉZO
 * les avait créées elle-même au lancement dans une ville. Parle directement
 * à Firestore (comme le client) : n'a pas besoin que `npm run server` tourne.
 *
 * ⚠️ Ce n'est PAS un substitut à du vrai contenu créé par une vraie équipe :
 * personne ne peut rejoindre "Équipe REZO" ou discuter avec elle puisque ce
 * n'est pas un compte réel. Avant un vrai lancement, remplacer/compléter ces
 * rencontres par de vraies rencontres organisées par de vraies personnes de
 * l'équipe, avec de vrais comptes (voir "Créer un compte" dans l'app).
 *
 * Usage : npm run seed
 *
 * Idempotent : peut être relancé sans dupliquer les rencontres déjà semées
 * (dédupliqué par titre).
 */

import { kvGet, kvSet } from './firebaseClient.js';

const HOST_NAME = 'Équipe REZO';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Prochaine occurrence d'une heure donnée dans N jours (toujours dans le futur).
function inDaysAt(days, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 16);
}

// 15 rencontres variées (activité, ville, horaire) pour donner tout de suite
// une impression de vie sur le flux, dans plusieurs villes marocaines.
const SEED_MEETUPS = [
  { title: 'Foot 5 vs 5 entre nouveaux arrivants', activity: 'sport', zone: 'Maarif, Casablanca', location: 'Complexe sportif Anfa', days: 1, hour: 19, note: 'Niveau détente, tout le monde est bienvenu.' },
  { title: 'Randonnée matinale au Parc de la Ligue Arabe', activity: 'randonnee', zone: 'Gauthier, Casablanca', location: 'Parc de la Ligue Arabe', days: 2, hour: 8, note: 'Rythme tranquille, environ 1h30.' },
  { title: 'Café polyglotte — échange de langues', activity: 'langues', zone: 'Centre-ville, Rabat', location: 'Café Van Dyck', days: 1, hour: 18, note: 'Français, anglais, darija — tous niveaux.' },
  { title: 'Soirée jeux de société', activity: 'jeux', zone: 'Agdal, Rabat', location: null, days: 3, hour: 19, note: 'Ramène ton jeu préféré si tu en as un.' },
  { title: 'Sortie photo au coucher du soleil', activity: 'photo', zone: 'Corniche, Casablanca', location: 'Corniche Ain Diab', days: 4, hour: 18, note: 'Débutants bienvenus, prêt de matériel possible sur place.' },
  { title: 'Yoga en plein air', activity: 'bienetre', zone: 'Parc Murdoch, Casablanca', location: null, days: 2, hour: 9, note: 'Tapis non fourni pour l’instant.' },
  { title: 'Dégustation street food', activity: 'food', zone: 'Habous, Casablanca', location: null, days: 5, hour: 20, note: 'On teste 3-4 adresses ensemble.' },
  { title: 'Meetup développeurs & tech', activity: 'tech', zone: 'Technopark, Casablanca', location: 'Technopark Casablanca', days: 6, hour: 18, note: 'Pitchs courts + networking informel.' },
  { title: 'Ciné-club en plein air', activity: 'cinema', zone: 'Marina, Casablanca', location: null, days: 7, hour: 20, note: 'Film à confirmer selon les votes du groupe.' },
  { title: 'Balade et musique acoustique', activity: 'musique', zone: 'Guéliz, Marrakech', location: null, days: 3, hour: 19, note: 'Amène ton instrument si tu joues.' },
  { title: 'Visite guidée de la Médina', activity: 'culture', zone: 'Médina, Marrakech', location: null, days: 4, hour: 10, note: 'Petit groupe, rythme adapté à tous.' },
  { title: 'Networking jeunes pros', activity: 'business', zone: 'Centre-ville, Rabat', location: null, days: 8, hour: 18, note: 'Tous secteurs bienvenus.' },
  { title: 'Balade avec nos chiens', activity: 'animaux', zone: 'Parc Lalla Hasna, Fès', location: null, days: 2, hour: 17, note: 'Chiens tenus en laisse dans les zones fréquentées.' },
  { title: 'Brunch en famille', activity: 'famille', zone: 'Ville Nouvelle, Fès', location: null, days: 6, hour: 11, note: 'Enfants bienvenus, espace de jeu à proximité.' },
  { title: 'Club lecture — roman du mois', activity: 'lecture', zone: 'Maarif, Casablanca', location: 'Café littéraire Reprise', days: 9, hour: 19, note: 'Le livre du mois est annoncé sur le chat du groupe.' },
];

async function main() {
  console.log('Seed REZO → Firestore');
  const raw = await kvGet('meetups-list');
  const existing = raw ? JSON.parse(raw) : [];
  const existingTitles = new Set(existing.map((m) => m.title));

  const toAdd = SEED_MEETUPS.filter((s) => !existingTitles.has(s.title)).map((s) => ({
    id: uid(),
    title: s.title,
    activity: s.activity,
    zone: s.zone,
    location: s.location || '',
    datetime: inDaysAt(s.days, s.hour),
    maxParticipants: 10,
    note: s.note,
    host: HOST_NAME,
    hostGender: 'autre',
    audience: 'mixte',
    ageMin: 16,
    ageMax: 99,
    participants: [HOST_NAME],
    participantGenders: { [HOST_NAME]: 'autre' },
    pendingRequests: [],
    createdAt: new Date().toISOString(),
    coords: null,
  }));

  if (toAdd.length === 0) {
    console.log('Rien à ajouter — toutes les rencontres seed existent déjà.');
    return;
  }

  const updated = [...toAdd, ...existing];
  await kvSet('meetups-list', JSON.stringify(updated));
  console.log(`${toAdd.length} rencontre(s) semée(s) avec succès (${existing.length} déjà présentes).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Échec du seed :', err.message);
    console.error('Vérifie la config Firebase (src/lib/firebase.js) et les règles Firestore (README.md).');
    process.exit(1);
  });
