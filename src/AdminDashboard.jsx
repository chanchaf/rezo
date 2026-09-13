import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, authReady } from './lib/firebase.js';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

/**
 * Tableau de bord admin — voir "Objectif final" du prompt : statistiques en lecture seule,
 * pas de modération active (accepter/rejeter un signalement, bannir un compte viendra plus tard).
 *
 * Accès : voir Root() dans main.jsx — route /admin, gardée par un champ `isAdmin: true` sur le
 * compte courant dans kv/accounts (pas de collection users/{uid} dans cette app, voir README).
 * Protection côté client uniquement : les règles Firestore actuelles laissent déjà kv/accounts et
 * kv/meetups-list lisibles par tout utilisateur authentifié (même anonyme), condition nécessaire au
 * fonctionnement normal de l'app pour tout le monde — il n'y a donc rien de plus exposé ici qu'un
 * client un peu curieux ne pourrait déjà lire directement. La vraie barrière est l'absence d'indice
 * visuel menant à /admin, pas un contrôle serveur.
 *
 * Métriques calculées côté client à partir des deux documents déjà nécessaires à l'app (`accounts`,
 * `meetups-list`), pas via les requêtes d'agrégation Firestore (count()/sum()/average()) : ces
 * requêtes comptent des documents dans une collection, alors que les rencontres vivent comme
 * éléments d'un tableau JSON à l'intérieur d'un seul document ici — rien à agréger côté serveur avec
 * cette API tant que ce n'est pas restructuré en vraies collections.
 */

const ACTIVITIES = [
  { id: 'sport', label: 'Sport', color: '#F2A65A' },
  { id: 'fitness', label: 'Fitness', color: '#64B5F6' },
  { id: 'randonnee', label: 'Plein air', color: '#8BC34A' },
  { id: 'culture', label: 'Culture', color: '#B08CE0' },
  { id: 'musique', label: 'Musique', color: '#EF7A9B' },
  { id: 'cinema', label: 'Cinéma', color: '#7986CB' },
  { id: 'jeux', label: 'Jeux', color: '#4FD1C5' },
  { id: 'bienetre', label: 'Bien-être', color: '#7FCF9E' },
  { id: 'food', label: 'Food & Boissons', color: '#E8674F' },
  { id: 'voyage', label: 'Voyage', color: '#4DB6E5' },
  { id: 'photo', label: 'Photo', color: '#90A4AE' },
  { id: 'lecture', label: 'Lecture', color: '#D4A574' },
  { id: 'tech', label: 'Tech', color: '#7C93F7' },
  { id: 'business', label: 'Business', color: '#64748B' },
  { id: 'langues', label: 'Langues', color: '#26A69A' },
  { id: 'animaux', label: 'Animaux', color: '#A67C52' },
  { id: 'famille', label: 'Famille', color: '#FF8FA3' },
  { id: 'autre', label: 'Autre', color: '#9AA0B4' },
];
const REPORT_THRESHOLD = 3; // même seuil que App.jsx (voir REPORT_THRESHOLD)

// Même grâce de 2h après l'heure prévue que isPast() dans App.jsx.
function isMeetupPast(m) {
  const d = new Date(m.datetime);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now() - 2 * 60 * 60 * 1000;
}

function meetupStatus(m) {
  if (m.closed || isMeetupPast(m)) return 'done';
  if (m.started) return 'ongoing';
  return 'upcoming';
}

// "Quartier, Ville" -> "Ville" (dernier segment) ; repli sur la chaîne entière si pas de virgule.
function extractCity(zone) {
  if (!zone) return null;
  const parts = zone.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function average(numbers) {
  if (!numbers.length) return null;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function toDateKey(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Fenêtre glissante des 30 derniers jours (aujourd'hui inclus), pour que les jours sans donnée
// apparaissent quand même à 0 dans les graphiques plutôt que d'être absents.
function last30DayKeys() {
  const keys = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function bucketByDay(dateStrings) {
  const counts = {};
  for (const iso of dateStrings) {
    const key = toDateKey(iso);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return last30DayKeys().map((key) => ({
    date: key.slice(5), // MM-DD, plus lisible sur l'axe
    count: counts[key] || 0,
  }));
}

const PIE_COLORS = ['#1877F2', '#F2A65A', '#31A24C', '#EF7A9B', '#7986CB', '#4FD1C5', '#B08CE0', '#90A4AE'];

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState(null);
  const [meetups, setMeetups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await authReady;
      const [accSnap, meetupsSnap] = await Promise.all([
        getDoc(doc(db, 'kv', 'accounts')),
        getDoc(doc(db, 'kv', 'meetups-list')),
      ]);
      setAccounts(accSnap.exists() ? JSON.parse(accSnap.data().value || '{}') : {});
      setMeetups(meetupsSnap.exists() ? JSON.parse(meetupsSnap.data().value || '[]') : []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (!accounts || !meetups) return null;

    const accountEntries = Object.entries(accounts);
    const totalUsers = accountEntries.length;
    const completedProfiles = accountEntries.filter(
      ([, a]) => a.gender && Array.isArray(a.preferences) && a.preferences.length > 0
    ).length;

    const statusCounts = { upcoming: 0, ongoing: 0, done: 0 };
    meetups.forEach((m) => { statusCounts[meetupStatus(m)]++; });

    const allRatings = meetups.flatMap((m) => m.ratings || []);
    const satisfactionScores = allRatings.map((r) => r.satisfactionStars).filter((n) => typeof n === 'number');
    const avgSatisfaction = average(satisfactionScores);

    const pastMeetups = meetups.filter(isMeetupPast);
    const startedPast = pastMeetups.filter((m) => m.started || m.closed).length;
    const completionRate = pastMeetups.length ? (startedPast / pastMeetups.length) * 100 : null;

    const avgParticipants = average(meetups.map((m) => (m.participants || []).length));

    const newUsersByDay = bucketByDay(accountEntries.map(([, a]) => a.createdAt).filter(Boolean));
    const meetupsByDay = bucketByDay(meetups.map((m) => m.createdAt).filter(Boolean));

    // Top organisateurs par note moyenne (même logique que hostRatingStats dans App.jsx), avec au
    // moins un avis reçu pour figurer dans le classement.
    const byHost = {};
    meetups.forEach((m) => {
      if (!byHost[m.host]) byHost[m.host] = { meetupCount: 0, hostScores: [] };
      byHost[m.host].meetupCount++;
      (m.ratings || []).forEach((r) => {
        if (typeof r.hostStars === 'number') byHost[m.host].hostScores.push(r.hostStars);
      });
    });
    const topOrganizers = Object.entries(byHost)
      .map(([host, v]) => ({ host, meetupCount: v.meetupCount, avgRating: average(v.hostScores), ratingCount: v.hostScores.length }))
      .filter((o) => o.ratingCount > 0)
      .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount)
      .slice(0, 5);

    const categoryBreakdown = ACTIVITIES.map((a) => ({
      id: a.id,
      label: a.label,
      color: a.color,
      value: meetups.filter((m) => m.activity === a.id).length,
    })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);

    const now = Date.now();
    const in30d = (iso) => {
      const t = new Date(iso).getTime();
      return !isNaN(t) && now - t <= 30 * 24 * 3600 * 1000;
    };
    const allReports = meetups.flatMap((m) => (m.reports || []).map((r) => ({ ...r, meetupId: m.id })));
    const reports30d = allReports.filter((r) => r.reportedAt && in30d(r.reportedAt));
    const autoHiddenCount = meetups.filter((m) => (m.reports || []).length >= REPORT_THRESHOLD).length;

    const activeCityCounts = {};
    meetups
      .filter((m) => meetupStatus(m) !== 'done')
      .forEach((m) => {
        const city = extractCity(m.zone);
        if (!city) return;
        activeCityCounts[city] = (activeCityCounts[city] || 0) + 1;
      });
    const topCities = Object.entries(activeCityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalUsers,
      completedProfiles,
      totalMeetups: meetups.length,
      statusCounts,
      avgSatisfaction,
      completionRate,
      pastMeetupsCount: pastMeetups.length,
      avgParticipants,
      newUsersByDay,
      meetupsByDay,
      topOrganizers,
      categoryBreakdown,
      totalReports: allReports.length,
      reports30dCount: reports30d.length,
      autoHiddenCount,
      topCities,
    };
  }, [accounts, meetups]);

  return (
    <div className="rezo-admin">
      <header className="admin-header">
        <div>
          <div className="admin-brand">RÉZO<span className="dot">·</span> Admin</div>
          {lastRefreshed && (
            <div className="admin-refreshed">Actualisé à {lastRefreshed.toLocaleTimeString('fr-FR')}</div>
          )}
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-btn admin-btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Actualisation…' : '↻ Actualiser'}
          </button>
          <a href="/" className="admin-back">← Retour à l'accueil</a>
        </div>
      </header>

      <main className="admin-main">
        {error && <div className="admin-error">{error}</div>}
        {!stats ? (
          <div className="admin-loading">Chargement des statistiques…</div>
        ) : (
          <>
            <section className="admin-section">
              <h2>Vue d'ensemble</h2>
              <div className="admin-cards">
                <StatCard label="Utilisateurs inscrits" value={stats.totalUsers} />
                <StatCard label="Rencontres créées" value={stats.totalMeetups} hint="rencontres encore existantes — une suppression efface toute trace" />
                <StatCard label="À venir" value={stats.statusCounts.upcoming} />
                <StatCard label="En cours" value={stats.statusCounts.ongoing} />
                <StatCard label="Terminées" value={stats.statusCounts.done} />
                <StatCard
                  label="Satisfaction moyenne"
                  value={stats.avgSatisfaction !== null ? `${stats.avgSatisfaction.toFixed(1)} / 5` : '—'}
                />
              </div>
            </section>

            <section className="admin-section">
              <h2>Croissance (30 derniers jours)</h2>
              <div className="admin-charts-row">
                <ChartPanel title="Nouveaux utilisateurs par jour">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stats.newUsersByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EE" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#1877F2" strokeWidth={2} dot={false} name="Nouveaux comptes" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>
                <ChartPanel title="Rencontres créées par jour">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.meetupsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EE" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#31A24C" name="Rencontres créées" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              </div>
            </section>

            <section className="admin-section">
              <h2>Engagement</h2>
              <div className="admin-cards">
                <StatCard
                  label="Taux de démarrage"
                  value={stats.completionRate !== null ? `${stats.completionRate.toFixed(0)}%` : '—'}
                  hint={`parmi les ${stats.pastMeetupsCount} rencontres passées encore existantes — les rencontres supprimées ne sont pas comptées`}
                />
                <StatCard
                  label="Participants / rencontre"
                  value={stats.avgParticipants !== null ? stats.avgParticipants.toFixed(1) : '—'}
                />
              </div>
              <div className="admin-charts-row">
                <ChartPanel title="Top 5 organisateurs les mieux notés">
                  {stats.topOrganizers.length === 0 ? (
                    <EmptyNote>Aucun avis reçu pour l'instant.</EmptyNote>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr><th>Organisateur</th><th>Note</th><th>Rencontres</th></tr>
                      </thead>
                      <tbody>
                        {stats.topOrganizers.map((o) => (
                          <tr key={o.host}>
                            <td>{o.host}</td>
                            <td>{o.avgRating.toFixed(1)} / 5 <span className="admin-muted">({o.ratingCount})</span></td>
                            <td>{o.meetupCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ChartPanel>
                <ChartPanel title="Répartition par catégorie">
                  {stats.categoryBreakdown.length === 0 ? (
                    <EmptyNote>Aucune rencontre pour l'instant.</EmptyNote>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={stats.categoryBreakdown} dataKey="value" nameKey="label" outerRadius={70} label={(e) => e.label}>
                          {stats.categoryBreakdown.map((c, i) => (
                            <Cell key={c.id} fill={c.color || PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartPanel>
              </div>
            </section>

            <section className="admin-section">
              <h2>Sécurité / santé de la plateforme</h2>
              <div className="admin-cards">
                <StatCard label="Signalements reçus" value={stats.totalReports} hint={`dont ${stats.reports30dCount} sur les 30 derniers jours`} />
                <StatCard label="Rencontres masquées (≥ 3 signalements)" value={stats.autoHiddenCount} />
                <StatCard
                  label="Profils complétés"
                  value={`${stats.completedProfiles} / ${stats.totalUsers}`}
                  hint={
                    stats.totalUsers > 0 && stats.completedProfiles / stats.totalUsers < 0.7
                      ? '⚠️ écart important — possible souci d\'onboarding'
                      : undefined
                  }
                />
              </div>
            </section>

            <section className="admin-section">
              <h2>Répartition géographique</h2>
              <ChartPanel title="Villes avec le plus de rencontres actives (à venir/en cours)">
                {stats.topCities.length === 0 ? (
                  <EmptyNote>Aucune rencontre active pour l'instant.</EmptyNote>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(180, stats.topCities.length * 32)}>
                    <BarChart data={stats.topCities} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EE" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1877F2" name="Rencontres actives" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartPanel>
            </section>
          </>
        )}
      </main>

      <style>{`
        .rezo-admin {
          --live: #1877F2; --text: #17181C; --muted: #6b7280;
          --border: #E7E9EE; --card: #FFFFFF; --bg: #F7F8FA; --danger: #DC2626;
          min-height: 100dvh; width: 100%; background: var(--bg); color: var(--text);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .admin-header {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
          padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--card);
          position: sticky; top: 0; z-index: 5;
        }
        .admin-brand { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; }
        .admin-brand .dot { color: var(--live); }
        .admin-refreshed { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        .admin-header-actions { display: flex; align-items: center; gap: 14px; }
        .admin-btn {
          border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: 'Inter', sans-serif; border: 1px solid var(--border); background: var(--card); color: var(--text);
        }
        .admin-btn-primary { background: var(--live); color: #fff; border-color: var(--live); }
        .admin-btn-primary:disabled { opacity: 0.6; cursor: default; }
        .admin-back { color: var(--live); text-decoration: none; font-size: 13px; font-weight: 600; }
        .admin-back:hover { text-decoration: underline; }
        .admin-main { max-width: 1080px; margin: 0 auto; padding: 24px; }
        .admin-error {
          background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.3); color: var(--danger);
          border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px;
        }
        .admin-loading { color: var(--muted); font-size: 14px; padding: 40px 0; text-align: center; }
        .admin-section { margin-bottom: 36px; }
        .admin-section h2 {
          font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 14px;
        }
        .admin-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
        .admin-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px;
        }
        .admin-card-value { font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; }
        .admin-card-label { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .admin-card-hint { font-size: 10.5px; color: var(--muted); margin-top: 6px; line-height: 1.4; }
        .admin-charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
        .admin-chart-panel { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
        .admin-chart-title { font-size: 12.5px; font-weight: 600; margin-bottom: 10px; color: var(--text); }
        .admin-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .admin-table th { text-align: left; color: var(--muted); font-weight: 600; padding: 4px 6px; border-bottom: 1px solid var(--border); }
        .admin-table td { padding: 6px 6px; border-bottom: 1px solid var(--border); }
        .admin-muted { color: var(--muted); font-size: 11px; }
        .admin-empty-note { color: var(--muted); font-size: 12.5px; padding: 20px 0; text-align: center; }

        @media (min-width: 768px) {
          .admin-main { padding: 32px 40px; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="admin-card">
      <div className="admin-card-value">{value}</div>
      <div className="admin-card-label">{label}</div>
      {hint && <div className="admin-card-hint">{hint}</div>}
    </div>
  );
}

function ChartPanel({ title, children }) {
  return (
    <div className="admin-chart-panel">
      <div className="admin-chart-title">{title}</div>
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <div className="admin-empty-note">{children}</div>;
}
