/**
 * Résumé hebdomadaire ("Cette semaine près de toi : 12 nouvelles rencontres
 * Sport…") — agrège les rencontres créées dans les 7 derniers jours et
 * envoie une notification push à tous les abonnés.
 *
 * ⚠️ Limite honnête : ce résumé est GLOBAL, pas personnalisé "près de toi".
 * Le backend ne connaît la position d'aucun utilisateur — `rezo-coords` est
 * volontairement `shared: false` (jamais envoyé au serveur, voir
 * storagePolyfill.js). Une vraie version géolocalisée demanderait de
 * partager la position des utilisateurs avec le serveur, ce qui est un choix
 * de confidentialité à trancher en équipe, pas quelque chose à ajouter en
 * silence. En attendant, le résumé porte sur toutes les nouvelles rencontres,
 * ce qui reste une raison légitime de revenir un dimanche soir.
 */

const ACTIVITY_LABELS = {
  sport: 'Sport', fitness: 'Fitness', randonnee: 'Plein air', culture: 'Culture', musique: 'Musique',
  cinema: 'Cinéma', jeux: 'Jeux', bienetre: 'Bien-être', food: 'Food & Boissons', voyage: 'Voyage',
  photo: 'Photo', lecture: 'Lecture', tech: 'Tech', business: 'Business', langues: 'Langues',
  animaux: 'Animaux', famille: 'Famille', autre: 'Autre',
};

function buildDigestMessage(meetups) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = meetups.filter((m) => {
    const created = new Date(m.createdAt || m.datetime).getTime();
    return !isNaN(created) && created >= weekAgo;
  });

  if (recent.length === 0) return null;

  const counts = {};
  recent.forEach((m) => {
    counts[m.activity] = (counts[m.activity] || 0) + 1;
  });
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([activity, count]) => `${ACTIVITY_LABELS[activity] || activity} ×${count}`);

  const title = 'Ton résumé de la semaine';
  const body = `Cette semaine : ${recent.length} nouvelle${recent.length > 1 ? 's' : ''} rencontre${recent.length > 1 ? 's' : ''} · ${top.join(' · ')}`;
  return { title, body };
}

// Envoie le résumé à toutes les souscriptions push connues.
// `webpush` est injecté (déjà configuré avec les clés VAPID) pour ne pas coupler ce module à la
// config du serveur qui l'appelle. `{ kvGet, kvSet }` est le même accès Firestore que le reste du
// serveur (voir firebaseClient.js) — injecté ici aussi pour rester testable indépendamment.
export async function sendWeeklyDigest({ kvGet, kvSet }, webpush) {
  const meetupsRaw = await kvGet('meetups-list');
  const meetups = meetupsRaw ? JSON.parse(meetupsRaw) : [];
  const message = buildDigestMessage(meetups);
  if (!message) {
    return { sent: 0, reason: 'no_recent_meetups' };
  }

  const subsRaw = await kvGet('push-subscriptions');
  const subsByEmail = subsRaw ? JSON.parse(subsRaw) : {};
  const allSubs = Object.values(subsByEmail).flat();

  let sent = 0;
  let pruned = 0;
  for (const [email, subs] of Object.entries(subsByEmail)) {
    const stillValid = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title: message.title, body: message.body, url: '/' })
        );
        stillValid.push(sub);
        sent += 1;
      } catch (err) {
        // 404/410 = abonnement expiré/révoqué côté navigateur, on le retire.
        if (err.statusCode === 404 || err.statusCode === 410) {
          pruned += 1;
        } else {
          stillValid.push(sub); // erreur transitoire : on garde l'abonnement
        }
      }
    }
    subsByEmail[email] = stillValid;
  }

  await kvSet('push-subscriptions', JSON.stringify(subsByEmail));
  return { sent, pruned, total: allSubs.length, message };
}
