import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Users, Clock, Plus, X, Radio, Check, Loader2, Navigation, Crosshair, Pencil, MessageCircle, Send,
  Flag, SlidersHorizontal, Dumbbell, Palette, Music, Gamepad2, HeartPulse, UtensilsCrossed, Sparkles, Search,
  UserPlus, Copy, Share2, Star, ExternalLink, Home, Bookmark, Compass, User, Mail, Lock, LogOut, Eye, EyeOff,
  Trash2, Type as TypeIcon, AlignLeft, Heart, Activity, Mountain, Film, Plane, Camera, BookOpen, Cpu, Briefcase,
  Languages, PawPrint, Baby, Cake, Bell, BellOff, Flame, Award, ShieldCheck, Phone, Globe,
  Trophy, Medal, Zap, Settings, ChevronRight, Image as ImageIcon,
} from 'lucide-react';
import { isPushSupported, getExistingPushSubscription, subscribeToPush, unsubscribeFromPush, notifyByName } from './lib/push.js';
import { requestPhoneCode, confirmPhoneCode } from './lib/verify.js';
import { LANGUAGES, translate, detectBrowserLanguage, dirForLanguage } from './lib/i18n.js';

// Large éventail d'activités pour toucher un public international aux intérêts variés
// (inspiré des catégories des grandes apps de meetup) tout en restant scannable dans une seule
// rangée d'icônes horizontale.
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

const ACTIVITY_ICONS = {
  sport: Dumbbell,
  fitness: Activity,
  randonnee: Mountain,
  culture: Palette,
  musique: Music,
  cinema: Film,
  jeux: Gamepad2,
  bienetre: HeartPulse,
  food: UtensilsCrossed,
  voyage: Plane,
  photo: Camera,
  lecture: BookOpen,
  tech: Cpu,
  business: Briefcase,
  langues: Languages,
  animaux: PawPrint,
  famille: Baby,
  autre: Sparkles,
};

const activityById = (id) => ACTIVITIES.find((a) => a.id === id) || ACTIVITIES[ACTIVITIES.length - 1];

// Assombrit (ou éclaircit si négatif) une couleur hex de `percent`% — sert à composer un dégradé
// à deux tons à partir de la seule couleur d'activité, pour une bannière qui ait un peu de relief
// plutôt qu'un aplat plat.
function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

const MOROCCO_PRESETS = [
  { label: 'Casablanca centre', coords: { lat: 33.5731, lng: -7.5898 } },
  { label: 'Rabat', coords: { lat: 34.0209, lng: -6.8416 } },
  { label: 'Marrakech', coords: { lat: 31.6295, lng: -7.9811 } },
];

// Formate un objet Date en valeur compatible avec <input type="datetime-local">, en heure locale
// (surtout ne pas utiliser toISOString ici, qui est en UTC et décalerait l'heure affichée).
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Prochaine occurrence d'un jour de semaine (0 = dimanche) à une heure donnée, toujours dans le
// futur (si "aujourd'hui" correspond mais que l'heure est déjà passée, bascule à la semaine suivante).
function nextWeekday(targetDay, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + ((targetDay - d.getDay() + 7) % 7));
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return d;
}

// Templates "un tap" affichés quand le flux est vide : réduire la friction de création à zéro
// plutôt que de laisser un état vide passif ("sois le premier").
const QUICK_TEMPLATES = [
  {
    id: 'foot-soir',
    emoji: '⚽',
    label: 'Foot ce soir',
    activity: 'sport',
    title: 'Foot 5 vs 5 ce soir',
    note: 'Niveau détente, tout le monde est bienvenu.',
    when: () => {
      const d = new Date();
      d.setHours(19, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    id: 'cafe-weekend',
    emoji: '☕',
    label: 'Café ce weekend',
    activity: 'food',
    title: 'Café entre nouveaux arrivants',
    note: 'Discussion informelle autour d’un café, aucune expérience requise.',
    when: () => nextWeekday(6, 11),
  },
  {
    id: 'jeux-soiree',
    emoji: '🎲',
    label: 'Soirée jeux',
    activity: 'jeux',
    title: 'Soirée jeux de société',
    note: 'Ramène ton jeu préféré si tu en as un !',
    when: () => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      d.setHours(19, 30, 0, 0);
      return d;
    },
  },
];

const GENDER_OPTIONS = [
  { id: 'femme', label: 'Femme' },
  { id: 'homme', label: 'Homme' },
  { id: 'autre', label: 'Autre / ne pas dire' },
];

const AUDIENCE_OPTIONS = [
  { id: 'mixte', label: 'Mixte', short: 'Mixte' },
  { id: 'femmes', label: '100% Femmes', short: '100% Femmes' },
  { id: 'hommes', label: '100% Hommes', short: '100% Hommes' },
];

// REZO cible d'abord le Maroc (voir le contenu de démarrage) : liste resserrée mais couvrant les
// pays francophones/voisins les plus probables, plutôt qu'une liste ISO exhaustive peu lisible.
const COUNTRIES = [
  'Maroc', 'France', 'Espagne', 'Belgique', 'Algérie', 'Tunisie', 'Canada', 'Suisse', 'Autre',
];

// Villes proposées en autocomplétion (`<datalist>`) selon le pays choisi — reste un champ texte
// libre : ces listes n'ont pas besoin d'être exhaustives, seulement d'accélérer la saisie.
const CITIES_BY_COUNTRY = {
  Maroc: [
    'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès', 'Oujda',
    'Kénitra', 'Tétouan', 'Salé', 'Nador', 'El Jadida', 'Béni Mellal', 'Essaouira',
  ],
  France: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg'],
  Espagne: ['Madrid', 'Barcelone', 'Valence', 'Séville', 'Malaga'],
  Belgique: ['Bruxelles', 'Anvers', 'Liège', 'Gand'],
  Algérie: ['Alger', 'Oran', 'Constantine'],
  Tunisie: ['Tunis', 'Sfax', 'Sousse'],
  Canada: ['Montréal', 'Toronto', 'Québec', 'Ottawa'],
  Suisse: ['Genève', 'Lausanne', 'Zurich'],
  Autre: [],
};

// Préfixes téléphoniques pour l'écran d'authentification par numéro — même couverture de pays que
// COUNTRIES/CITIES_BY_COUNTRY, avec le drapeau pour un menu déroulant reconnaissable au premier coup d'œil.
const DIAL_CODES = [
  { country: 'Maroc', flag: '🇲🇦', code: '+212' },
  { country: 'France', flag: '🇫🇷', code: '+33' },
  { country: 'Espagne', flag: '🇪🇸', code: '+34' },
  { country: 'Belgique', flag: '🇧🇪', code: '+32' },
  { country: 'Algérie', flag: '🇩🇿', code: '+213' },
  { country: 'Tunisie', flag: '🇹🇳', code: '+216' },
  { country: 'Canada', flag: '🇨🇦', code: '+1' },
  { country: 'Suisse', flag: '🇨🇭', code: '+41' },
];

// Devine le pays via géolocalisation IP (best effort, pas de clé requise) pour pré-sélectionner le
// champ Pays à l'inscription ; le Maroc reste le repli par défaut si ça échoue ou prend trop de temps.
// ipapi.co renvoie le nom du pays en anglais ; la liste COUNTRIES est en français (cohérente avec
// le reste de l'UI) — on traduit les cas les plus probables, plutôt que d'accepter un nom qui ne
// correspondrait à aucune <option> du menu déroulant.
const ENGLISH_TO_FRENCH_COUNTRY = {
  Morocco: 'Maroc',
  France: 'France',
  Spain: 'Espagne',
  Belgium: 'Belgique',
  Algeria: 'Algérie',
  Tunisia: 'Tunisie',
  Canada: 'Canada',
  Switzerland: 'Suisse',
};

async function guessCountryFromIP() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://ipapi.co/country_name/', { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return 'Maroc';
    const name = (await res.text()).trim();
    if (COUNTRIES.includes(name)) return name;
    return ENGLISH_TO_FRENCH_COUNTRY[name] || 'Maroc';
  } catch (err) {
    return 'Maroc';
  }
}

const BADGE_THRESHOLD = 3;

// Nombre maximal d'occurrences pré-générées d'un coup pour une série récurrente (y compris pour
// "jusqu'à nouvel ordre", faute de tâche planifiée côté serveur pour en générer d'autres plus
// tard) — voir generateSeriesOccurrences. L'organisateur peut toujours recréer une série une fois
// celle-ci épuisée.
const SERIES_OCCURRENCE_CAP = 12;
const SERIES_STEP_DAYS = { weekly: 7, biweekly: 14 };
const SERIES_LABEL_KEY = { weekly: 'series.badge.weekly', biweekly: 'series.badge.biweekly', monthly: 'series.badge.monthly' };

// Calcule les dates ISO (datetime-local) des occurrences suivantes d'une série, en partant de la
// première date fournie, jusqu'à la date de fin (incluse) ou le plafond SERIES_OCCURRENCE_CAP.
function generateSeriesOccurrences(startDatetime, frequency, endDate) {
  const dates = [];
  let current = new Date(startDatetime);
  if (isNaN(current.getTime())) return dates;
  const endTime = endDate ? new Date(`${endDate}T23:59`).getTime() : null;
  for (let i = 0; i < SERIES_OCCURRENCE_CAP; i++) {
    if (endTime !== null && current.getTime() > endTime) break;
    dates.push(toDatetimeLocalValue(current));
    const next = new Date(current);
    if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else next.setDate(next.getDate() + (SERIES_STEP_DAYS[frequency] || 7));
    current = next;
  }
  return dates;
}

// Délai après l'heure prévue avant de demander à l'organisateur si la rencontre est toujours en
// cours, et avant d'inviter les participants à laisser un avis si personne n'a répondu.
const MEETUP_CHECKIN_DELAY_MS = 30 * 60 * 1000;

// Horodatage auquel on pose la question "toujours en cours ?" à l'organisateur.
function meetupCheckinDueAt(m) {
  const start = new Date(m.datetime).getTime();
  if (isNaN(start)) return null;
  return start + MEETUP_CHECKIN_DELAY_MS;
}

// Un avis n'est pertinent qu'une fois la rencontre réellement terminée : soit l'organisateur l'a
// clôturée, soit elle a été démarrée et le délai de vérification est dépassé sans réponse (on ne
// bloque pas les participants indéfiniment si l'organisateur ne répond jamais).
function isRatingDue(m, now) {
  if (m.closed) return true;
  if (!m.started) return false;
  const dueAt = meetupCheckinDueAt(m);
  return dueAt !== null && now >= dueAt;
}

// Nom du compte utilisé par le script de contenu de démarrage (voir server/seed.js). Ce n'est PAS
// un vrai compte connectable : personne ne peut donc jamais accepter de demandes ni démarrer ces
// rencontres via le chemin normal (réservé à l'hôte). On adapte ces deux actions spécifiquement
// pour ces rencontres-là afin qu'elles restent utilisables : adhésion immédiate (pas de validation
// à attendre d'un hôte qui n'existe pas) et démarrage ouvert à tout participant une fois complètes.
const REZO_HOST_NAME = 'Équipe REZO';

// Traduit via t(`report.${id}`) — voir i18n.js. `id` est ce qui est stocké dans m.reports[].reason
// (jamais réaffiché ailleurs dans l'UI), pas le libellé, pour rester indépendant de la langue.
const REPORT_REASONS = ['spam', 'inappropriate', 'scam', 'fakeProfile', 'other'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const ACCOUNTS_KEY = 'accounts';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Hash côté client (Web Crypto) : évite de stocker le mot de passe en clair dans le
// registre de comptes partagé. Ce n'est pas un substitut à une vraie authentification
// serveur (voir storagePolyfill.js), mais c'est raisonnable pour ce prototype local.
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Vrai si l'erreur vient d'un `fetch` qui n'a pas pu joindre le serveur (backend arrêté,
// mauvaise URL…), par opposition à une réponse HTTP normale (ex: 404 = clé absente).
function isNetworkError(err) {
  return err instanceof TypeError && /fetch|network/i.test(err.message || '');
}

const SERVER_UNREACHABLE_MESSAGE =
  "Impossible de joindre le serveur partagé. Vérifie qu'il tourne (npm run server, ou npm run dev qui lance les deux) puis réessaie.";

async function loadAccounts() {
  try {
    const res = await window.storage.get(ACCOUNTS_KEY, true);
    const map = res && res.value ? JSON.parse(res.value) : {};
    return map && typeof map === 'object' ? map : {};
  } catch (err) {
    // "Key not found" = pas encore de compte créé, c'est normal. Toute autre erreur
    // (serveur injoignable, etc.) doit remonter pour que l'appelant puisse la signaler.
    if (err && typeof err.message === 'string' && err.message.startsWith('Key not found')) {
      return {};
    }
    throw err;
  }
}

async function saveAccounts(accounts) {
  await window.storage.set(ACCOUNTS_KEY, JSON.stringify(accounts), true);
}

// Découpe un texte traduit contenant des jetons {clé} pour y injecter des éléments React (liens
// cliquables notamment) plutôt qu'un simple remplacement de texte — voir translate() dans i18n.js
// pour l'interpolation texte-à-texte classique, utilisée partout ailleurs.
function interpolateNodes(template, replacements) {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const match = part.match(/^\{(\w+)\}$/);
    if (match && replacements[match[1]] !== undefined) {
      return <React.Fragment key={i}>{replacements[match[1]]}</React.Fragment>;
    }
    return part;
  });
}

const WHEN_LOCALES = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-MA' };
const TODAY_LABEL = { fr: "Aujourd'hui", en: 'Today', ar: 'اليوم' };

function formatWhen(iso, lang = 'fr') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const locale = WHEN_LOCALES[lang] || WHEN_LOCALES.fr;
  const opts = { hour: '2-digit', minute: '2-digit' };
  if (sameDay) return `${TODAY_LABEL[lang] || TODAY_LABEL.fr} · ${d.toLocaleTimeString(locale, opts)}`;
  return `${d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString(locale, opts)}`;
}

// Distance réelle entre deux coordonnées GPS (formule de haversine), en km
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Cap (bearing) réel entre deux coordonnées GPS, en degrés (0 = nord)
function bearingDeg(a, b) {
  if (!a || !b) return 0;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function formatDistance(km) {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

// Transforme un résultat brut Nominatim (OpenStreetMap) en suggestion affichable : nom principal
// (établissement/rue) + contexte secondaire (quartier, ville), avec les coordonnées exactes.
function toGeoSuggestion(r) {
  const addr = r.address || {};
  const parts = (r.display_name || '').split(',').map((p) => p.trim()).filter(Boolean);
  const primary = addr.amenity || addr.shop || addr.leisure || addr.tourism || addr.office || addr.building || addr.road || parts[0] || r.display_name;
  const primaryLower = String(primary).toLowerCase();
  const city = addr.city || addr.town || addr.village || addr.county || '';
  const suburb = addr.suburb || addr.neighbourhood || '';
  // Un résultat "quartier" a souvent le même texte en primary (dérivé de display_name) et en
  // suburb — sans ce filtre, la suggestion afficherait "Maarif — Maarif, Casablanca" en double.
  const structuredParts = [suburb, city].filter((p) => p && p.toLowerCase() !== primaryLower);
  const secondaryParts = structuredParts.length
    ? [...new Set(structuredParts)]
    : parts.slice(1, 3).filter((p) => p.toLowerCase() !== primaryLower);
  return {
    id: r.place_id ?? `${r.lat}-${r.lon}`,
    primary,
    secondary: secondaryParts.join(', '),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  };
}

// Autocomplétion d'adresse via Nominatim (OpenStreetMap) : gratuit, sans clé API — cohérent avec le
// choix déjà fait pour "Voir sur la carte" (lien Google Maps sans clé). Débounce 450ms + annulation
// de la requête précédente pour rester raisonnable vis-à-vis du service public (limite ~1 req/s,
// voir la mention d'attribution affichée sous la liste de suggestions dans le JSX appelant).
function useGeoSuggest(query, language) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = (query || '').trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    debounceRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      const params = new URLSearchParams({
        format: 'jsonv2',
        addressdetails: '1',
        limit: '6',
        'accept-language': language || 'fr',
        q: trimmed,
      });
      fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => setSuggestions(Array.isArray(data) ? data.map(toGeoSuggestion) : []))
        .catch((err) => {
          if (err.name !== 'AbortError') setSuggestions([]);
        })
        .finally(() => setLoading(false));
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, language]);

  return { suggestions, loading };
}

// Libellé lisible pour la tranche d'âge ciblée par une rencontre.
function formatAgeRange(min, max, t) {
  const lo = min || 18;
  const hi = max || 99;
  if (lo <= 18 && hi >= 99) return t('card.allAges');
  if (hi >= 99) return t('card.ageAndUp', { age: lo });
  return t('card.ageRange', { min: lo, max: hi });
}

// Construit un lien Google Maps pour une rencontre : coordonnées GPS si disponibles,
// sinon recherche textuelle sur le lieu précis + la zone.
function mapsLinkFor(meetup) {
  if (meetup.coords && typeof meetup.coords.lat === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${meetup.coords.lat},${meetup.coords.lng}`;
  }
  const query = [meetup.location, meetup.zone].filter(Boolean).join(', ');
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Redimensionne et compresse une image locale en petit avatar carré encodé en base64
// (pas d'upload de fichier réel disponible ici : on stocke l'image elle-même comme texte).
function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Comme fileToAvatarDataUrl, mais recadre en bandeau large (façon couverture Facebook) plutôt
// qu'en carré : ratio ~3:1, recadrage centré, redimensionné pour rester léger en localStorage.
function fileToCoverDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const width = 640;
        const height = 220;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const targetRatio = width / height;
        const srcRatio = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (srcRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Logos officiels (multicolore Google, bleu Facebook) pour les boutons "Continuer avec…" de
// l'écran d'authentification — aucune icône de marque n'existe dans lucide-react.
// Sélecteur de langue discret (drapeau + code, ex: 🇫🇷 FR) réutilisé avant l'écran d'authentification
// et dans Paramètres → Langue (voir README "Langue et RTL").
function LanguageMenu({ language, onChange, open, onToggle, align = 'left' }) {
  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];
  return (
    <div className="lang-menu-wrap">
      <button type="button" className="lang-menu-btn" onClick={onToggle}>
        {current.flag} {current.code.toUpperCase()}
      </button>
      {open && (
        <div className={`lang-menu-dropdown ${align === 'right' ? 'align-right' : ''}`}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`lang-menu-item ${l.code === language ? 'active' : ''}`}
              onClick={() => onChange(l.code)}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

// Avatar réutilisable : photo si disponible dans le registre partagé, sinon initiale colorée.
function Avatar({ name, avatarUrl, size = 22 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid var(--card)',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }
  return (
    <span className="avatar" title={name} style={{ width: size, height: size }}>
      {initial}
    </span>
  );
}

// Affichage lecture seule d'une note moyenne en étoiles
function StarDisplay({ value, count, size = 12 }) {
  if (!count) return null;
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="star-display" title={`${value.toFixed(1)}/5 (${count} avis)`}>
      <Star size={size} fill="#F2A65A" color="#F2A65A" style={{ verticalAlign: '-2px' }} />
      <span className="star-display-value">{value.toFixed(1)}</span>
      <span className="star-display-count">({count})</span>
    </span>
  );
}

// Libellé de champ avec petite icône contextuelle, pour guider visuellement chaque étape des formulaires.
function FieldLabel({ icon: Icon, children }) {
  return (
    <label>
      {Icon && <Icon size={12} style={{ verticalAlign: '-2px', marginInlineEnd: 5, opacity: 0.75 }} />}
      {children}
    </label>
  );
}

// Sélecteur d'étoiles interactif (1 à 5)
function StarPicker({ value, onChange, size = 22 }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star-picker-btn"
          onClick={() => onChange(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          <Star size={size} fill={n <= value ? '#F2A65A' : 'none'} color="#F2A65A" />
        </button>
      ))}
    </div>
  );
}

export default function RezoApp() {
  const [meetups, setMeetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [splashHiding, setSplashHiding] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [zoneQuery, setZoneQuery] = useState('');
  const [activityQuery, setActivityQuery] = useState('');
  const [activitySuggestOpen, setActivitySuggestOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('all');
  const [ageFilterMin, setAgeFilterMin] = useState(16);
  const [ageFilterMax, setAgeFilterMax] = useState(99);
  const [userName, setUserName] = useState(null);
  // Nom de famille : donnée de profil privée par défaut (voir publicLastNames pour l'affichage
  // public optionnel) — userName reste le prénom, seul affiché sur les cartes/avatars/chat.
  const [userLastName, setUserLastName] = useState(null);
  const [userCountry, setUserCountry] = useState(null);
  const [userCity, setUserCity] = useState(null);
  const [userShowLastName, setUserShowLastName] = useState(false);
  const [publicLastNames, setPublicLastNames] = useState({});
  const [userShowCity, setUserShowCity] = useState(false);
  const [publicCities, setPublicCities] = useState({});
  const [userCover, setUserCover] = useState(null);
  const [userBio, setUserBio] = useState('');
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  // Profil public d'un organisateur consulté (tap sur son nom depuis une carte) : null = son propre
  // profil. Couverture/bio/activités/pays publiés systématiquement (comme l'avatar) dans
  // public-profiles ; nom de famille/ville restent soumis à leurs bascules dédiées existantes.
  const [viewedProfileName, setViewedProfileName] = useState(null);
  const [publicProfiles, setPublicProfiles] = useState({});
  // Qui suit qui : { [abonné]: [organisateur1, organisateur2, ...] } — jamais affiché comme liste
  // publique complète (voir Objectif "limite à poser"), seulement utilisé pour compter/vérifier.
  const [follows, setFollows] = useState({});
  const [showCirclePage, setShowCirclePage] = useState(false);
  // Langue d'interface : par appareil tant qu'aucun compte n'est connecté, puis synchronisée dans
  // le compte (voir setLanguage) — jamais bloquant, repli FR géré par translate() si une clé manque.
  const [language, setLanguageState] = useState('fr');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [userGender, setUserGender] = useState(null);
  const [userPreferences, setUserPreferences] = useState([]);
  const [userAvatar, setUserAvatar] = useState(null);
  const [userPhone, setUserPhone] = useState(null);
  const [userPhoneVerified, setUserPhoneVerified] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // 'choose' (téléphone + portes d'entrée) -> 'phone-code' (OTP) ou 'email' (formulaire e-mail).
  const [authScreen, setAuthScreen] = useState('choose');
  const [authMode, setAuthMode] = useState('signup'); // 'signup' | 'login' — pour l'écran e-mail
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authDialCode, setAuthDialCode] = useState('+212');
  const [authDialCountry, setAuthDialCountry] = useState('Maroc');
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [authPhoneChannel, setAuthPhoneChannel] = useState('sms'); // 'sms' | 'whatsapp'
  const [authPhoneCode, setAuthPhoneCode] = useState('');
  const [authPhoneDevCode, setAuthPhoneDevCode] = useState(null);
  const [authPhoneBusy, setAuthPhoneBusy] = useState(false);
  const [profilesMap, setProfilesMap] = useState({});
  const [verifiedMap, setVerifiedMap] = useState({});
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneVerifiedDraft, setPhoneVerifiedDraft] = useState(false);
  const [verifyCodeSent, setVerifyCodeSent] = useState(false);
  const [verifyDevCode, setVerifyDevCode] = useState(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [lastNameDraft, setLastNameDraft] = useState('');
  const [countryDraft, setCountryDraft] = useState('Maroc');
  const [cityDraft, setCityDraft] = useState('');
  const [showLastNameDraft, setShowLastNameDraft] = useState(false);
  const [genderDraft, setGenderDraft] = useState('');
  const [preferencesDraft, setPreferencesDraft] = useState([]);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [coverDraft, setCoverDraft] = useState(null);
  const [coverProcessing, setCoverProcessing] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // fn to run after name is set
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  // Tri "près de moi" : basé sur la ville déclarée (fiable, toujours disponible), le GPS n'étant
  // qu'un bonus optionnel pour affiner le tri à l'intérieur du groupe "même ville" (voir activateNearMe).
  const [nearMeActive, setNearMeActive] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [seriesJoinChoice, setSeriesJoinChoice] = useState(null);
  const [reportingMeetup, setReportingMeetup] = useState(null);
  const [invitingMeetup, setInvitingMeetup] = useState(null);
  const [inviteNameDraft, setInviteNameDraft] = useState('');
  const [ratingMeetup, setRatingMeetup] = useState(null);
  const [ratingHostStars, setRatingHostStars] = useState(0);
  const [ratingSatisfactionStars, setRatingSatisfactionStars] = useState(0);
  const [dismissedRatingIds, setDismissedRatingIds] = useState(new Set());
  const [ongoingCheckMeetup, setOngoingCheckMeetup] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [journeyMeetupId, setJourneyMeetupId] = useState(null);
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyError, setJourneyError] = useState(null);
  const [journeyDistance, setJourneyDistance] = useState(null);
  const watchIdRef = useRef(null);
  const arrivalsSeenRef = useRef({});
  const arrivalsInitRef = useRef(false);
  const extendingSeriesRef = useRef(new Set());
  const [editingMeetup, setEditingMeetup] = useState(null);
  const [templateDraft, setTemplateDraft] = useState(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [chatMeetup, setChatMeetup] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatSavingRef = useRef(false);
  // Nombre de messages lus par rencontre (persisté par appareil) vs. nombre total actuel (rafraîchi
  // par sondage) : la différence donne le badge de non-lus sur l'icône chat de chaque carte.
  const [chatReadCounts, setChatReadCounts] = useState({});
  const [chatTotalCounts, setChatTotalCounts] = useState({});
  const savingRef = useRef(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const t = useCallback((key, vars) => translate(language, key, vars), [language]);
  const dir = dirForLanguage(language);
  // Les id/couleurs des catégories (ACTIVITIES) restent la clé de données stable ; seul le libellé
  // affiché est traduit — jamais utiliser aLabel()/gLabel()/audLabel() comme valeur stockée.
  const aLabel = useCallback((id) => t(`activity.${id}`), [t]);
  const gLabel = useCallback((id) => t(`gender.${id}`), [t]);
  const audLabel = useCallback((id) => t(`audience.${id}`), [t]);

  // Change la langue d'interface : par appareil immédiatement, et synchronisée dans le compte dès
  // qu'un utilisateur est connecté (voir Objectif de la demande : "sauvegardé dans le profil...
  // synchronisé sur tous ses appareils"). N'affecte jamais le contenu créé par les utilisateurs.
  const setLanguage = async (code) => {
    setLanguageState(code);
    setLangMenuOpen(false);
    try {
      await window.storage.set('rezo-language', code, false);
      if (userEmail) {
        const accounts = await loadAccounts();
        accounts[userEmail] = { ...(accounts[userEmail] || {}), language: code };
        await saveAccounts(accounts);
      }
    } catch (err) {
      // best effort
    }
  };

  // Écran de démarrage animé, affiché à chaque lancement de l'app avant de révéler le contenu.
  useEffect(() => {
    const hideTimer = setTimeout(() => setSplashHiding(true), 1500);
    const removeTimer = setTimeout(() => setShowSplash(false), 1900);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const loadMeetups = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('meetups-list', true);
      const list = res && res.value ? JSON.parse(res.value) : [];
      setMeetups(Array.isArray(list) ? list : []);
      setLastSync(new Date());
    } catch (err) {
      setMeetups([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const saveMeetups = useCallback(async (updated) => {
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await window.storage.set('meetups-list', JSON.stringify(updated), true);
      if (!result) throw new Error('Échec de la sauvegarde');
      setMeetups(updated);
      setLastSync(new Date());
    } catch (err) {
      showToast(t('toast.saveError'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  const loadProfiles = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('profiles', true);
      const map = res && res.value ? JSON.parse(res.value) : {};
      setProfilesMap(map && typeof map === 'object' ? map : {});
    } catch (err) {
      if (!silent) setProfilesMap({});
    }
  }, []);

  // Nom -> vérifié (numéro de téléphone confirmé), registre partagé alimenté par le flux de
  // vérification (voir confirmPhoneVerification). Chargé comme profilesMap, même logique.
  const loadVerified = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('verified-map', true);
      const map = res && res.value ? JSON.parse(res.value) : {};
      setVerifiedMap(map && typeof map === 'object' ? map : {});
    } catch (err) {
      if (!silent) setVerifiedMap({});
    }
  }, []);

  // Prénom -> nom de famille, UNIQUEMENT pour les personnes ayant explicitement choisi de
  // l'afficher publiquement (voir confirmName) — registre partagé, chargé comme profilesMap.
  const loadPublicLastNames = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('public-lastnames', true);
      const map = res && res.value ? JSON.parse(res.value) : {};
      setPublicLastNames(map && typeof map === 'object' ? map : {});
    } catch (err) {
      if (!silent) setPublicLastNames({});
    }
  }, []);

  // Prénom -> ville, même logique que loadPublicLastNames (confidentialité opt-in, voir toggleShowCity).
  const loadPublicCities = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('public-cities', true);
      const map = res && res.value ? JSON.parse(res.value) : {};
      setPublicCities(map && typeof map === 'object' ? map : {});
    } catch (err) {
      if (!silent) setPublicCities({});
    }
  }, []);

  // Prénom -> { cover, bio, preferences, country } : contrairement au nom/à la ville, publiées
  // systématiquement (comme l'avatar) dès que le profil est complété — pas de bascule dédiée, voir
  // Objectif "vraie page d'identité sociale" de la demande de refonte du profil.
  const loadPublicProfiles = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('public-profiles', true);
      const map = res && res.value ? JSON.parse(res.value) : {};
      setPublicProfiles(map && typeof map === 'object' ? map : {});
    } catch (err) {
      if (!silent) setPublicProfiles({});
    }
  }, []);

  // { [abonné]: [organisateur, ...] } — voir toggleFollow. Chargé/sondé comme les autres registres
  // partagés ; jamais exposé comme liste publique complète dans l'UI (seulement des comptages).
  const loadFollows = useCallback(async (silent) => {
    try {
      const res = await window.storage.get('follows', true);
      const map = res && res.value ? JSON.parse(res.value) : {};
      setFollows(map && typeof map === 'object' ? map : {});
    } catch (err) {
      if (!silent) setFollows({});
    }
  }, []);

  useEffect(() => {
    loadMeetups(false);
    loadProfiles(false);
    loadVerified(false);
    loadPublicLastNames(false);
    loadPublicCities(false);
    loadPublicProfiles(false);
    loadFollows(false);
    const interval = setInterval(() => {
      if (!savingRef.current) loadMeetups(true);
      loadProfiles(true);
      loadVerified(true);
      loadPublicLastNames(true);
      loadPublicCities(true);
      loadPublicProfiles(true);
      loadFollows(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadMeetups, loadProfiles, loadVerified, loadPublicLastNames, loadPublicCities, loadPublicProfiles, loadFollows]);

  // Détecte les nouvelles arrivées à chaque rafraîchissement et notifie les membres concernés
  // (pas de partage de position continue : uniquement l'événement "est arrivé·e").
  useEffect(() => {
    const isFirstPass = !arrivalsInitRef.current;
    meetups.forEach((m) => {
      const arrivals = m.arrivals || {};
      const concernsMe = userName && (m.host === userName || m.participants.includes(userName));
      if (!arrivalsSeenRef.current[m.id]) arrivalsSeenRef.current[m.id] = new Set();
      const seen = arrivalsSeenRef.current[m.id];
      Object.keys(arrivals).forEach((name) => {
        if (seen.has(name)) return;
        seen.add(name);
        if (!isFirstPass && concernsMe && name !== userName) {
          showToast(t('toast.arrivalNotify', { name, title: m.title }));
        }
      });
    });
    arrivalsInitRef.current = true;
  }, [meetups, userName]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('rezo-email', false);
        if (res && res.value) setUserEmail(res.value);
      } catch (err) {
        // no session yet
      }
      try {
        const res = await window.storage.get('rezo-username', false);
        if (res && res.value) setUserName(res.value);
      } catch (err) {
        // no name stored yet
      }
      try {
        const res = await window.storage.get('rezo-lastname', false);
        if (res && res.value) setUserLastName(res.value);
      } catch (err) {
        // no last name stored yet
      }
      try {
        const res = await window.storage.get('rezo-country', false);
        if (res && res.value) setUserCountry(res.value);
      } catch (err) {
        // no country stored yet
      }
      try {
        const res = await window.storage.get('rezo-city', false);
        if (res && res.value) setUserCity(res.value);
      } catch (err) {
        // no city stored yet
      }
      try {
        const res = await window.storage.get('rezo-show-lastname', false);
        if (res && res.value === 'true') setUserShowLastName(true);
      } catch (err) {
        // opt-in par défaut désactivé
      }
      try {
        const res = await window.storage.get('rezo-show-city', false);
        if (res && res.value === 'true') setUserShowCity(true);
      } catch (err) {
        // opt-in par défaut désactivé
      }
      try {
        const res = await window.storage.get('rezo-cover', false);
        if (res && res.value) setUserCover(res.value);
      } catch (err) {
        // pas de couverture pour l'instant
      }
      try {
        const res = await window.storage.get('rezo-bio', false);
        if (res && res.value) setUserBio(res.value);
      } catch (err) {
        // pas de bio pour l'instant
      }
      try {
        const res = await window.storage.get('rezo-gender', false);
        if (res && res.value) setUserGender(res.value);
      } catch (err) {
        // no gender stored yet
      }
      try {
        const res = await window.storage.get('rezo-preferences', false);
        if (res && res.value) setUserPreferences(JSON.parse(res.value));
      } catch (err) {
        // no preferences stored yet
      }
      try {
        const res = await window.storage.get('rezo-avatar', false);
        if (res && res.value) setUserAvatar(res.value);
      } catch (err) {
        // no avatar stored yet
      }
      try {
        const res = await window.storage.get('rezo-phone', false);
        if (res && res.value) setUserPhone(res.value);
      } catch (err) {
        // no phone stored yet
      }
      try {
        const res = await window.storage.get('rezo-phone-verified', false);
        if (res && res.value === 'true') setUserPhoneVerified(true);
      } catch (err) {
        // not verified yet
      }
      try {
        const res = await window.storage.get('rezo-coords', false);
        if (res && res.value) setUserCoords(JSON.parse(res.value));
      } catch (err) {
        // no coords stored yet
      }
      try {
        const res = await window.storage.get('rezo-near-me-active', false);
        if (res && res.value === 'true') setNearMeActive(true);
      } catch (err) {
        // désactivé par défaut
      }
      try {
        const res = await window.storage.get('rezo-language', false);
        if (res && res.value && LANGUAGES.some((l) => l.code === res.value)) {
          setLanguageState(res.value);
        } else {
          setLanguageState(detectBrowserLanguage());
        }
      } catch (err) {
        setLanguageState(detectBrowserLanguage());
      }
    })();
  }, []);

  // Reflète l'état réel de l'abonnement push de CET appareil (un abonnement est par
  // navigateur/appareil, pas par compte), pour que le bouton affiche le bon état au chargement.
  useEffect(() => {
    getExistingPushSubscription().then((sub) => setPushEnabled(!!sub));
  }, []);

  const togglePush = () => {
    if (!userEmail) return;
    setPushBusy(true);
    if (pushEnabled) {
      unsubscribeFromPush(userEmail)
        .then(() => {
          setPushEnabled(false);
          showToast(t('toast.pushDisabled'));
        })
        .catch(() => showToast(t('toast.pushDisableFailed')))
        .finally(() => setPushBusy(false));
    } else {
      subscribeToPush(userEmail)
        .then(() => {
          setPushEnabled(true);
          showToast(t('toast.pushEnabled'));
        })
        .catch((err) => showToast(err.message || t('toast.pushEnableFailed')))
        .finally(() => setPushBusy(false));
    }
  };

  // Bascules de confidentialité (page Paramètres) : effet immédiat, contrairement aux autres champs
  // du profil qui n'appliquent qu'à la validation du formulaire "Modifier le profil".
  const toggleShowLastName = async () => {
    if (!userName) return;
    const next = !userShowLastName;
    setUserShowLastName(next);
    setShowLastNameDraft(next);
    try {
      await window.storage.set('rezo-show-lastname', next ? 'true' : 'false', false);
      if (userEmail) {
        const accounts = await loadAccounts();
        accounts[userEmail] = { ...(accounts[userEmail] || {}), showLastNamePublicly: next };
        await saveAccounts(accounts);
      }
      const lastNamesRes = await window.storage.get('public-lastnames', true).catch(() => null);
      const nextMap = lastNamesRes && lastNamesRes.value ? JSON.parse(lastNamesRes.value) : {};
      if (next && userLastName) nextMap[userName] = userLastName;
      else delete nextMap[userName];
      await window.storage.set('public-lastnames', JSON.stringify(nextMap), true);
      setPublicLastNames(nextMap);
    } catch (err) {
      showToast(t('toast.unreadUpdateFailed'));
    }
  };

  const toggleShowCity = async () => {
    if (!userName) return;
    const next = !userShowCity;
    setUserShowCity(next);
    try {
      await window.storage.set('rezo-show-city', next ? 'true' : 'false', false);
      if (userEmail) {
        const accounts = await loadAccounts();
        accounts[userEmail] = { ...(accounts[userEmail] || {}), showCityPublicly: next };
        await saveAccounts(accounts);
      }
      const citiesRes = await window.storage.get('public-cities', true).catch(() => null);
      const nextMap = citiesRes && citiesRes.value ? JSON.parse(citiesRes.value) : {};
      if (next && userCity) nextMap[userName] = userCity;
      else delete nextMap[userName];
      await window.storage.set('public-cities', JSON.stringify(nextMap), true);
      setPublicCities(nextMap);
    } catch (err) {
      showToast(t('toast.unreadUpdateFailed'));
    }
  };

  // Abonnement à un organisateur : { [abonné]: [organisateur, ...] } (voir Objectif "limite à
  // poser" — jamais affiché comme liste publique, seulement un comptage). Relit une copie fraîche
  // avant d'écrire pour limiter (sans l'éliminer) le risque de course sur ce registre partagé.
  const toggleFollow = (organizerName) => {
    requireName(async (name) => {
      if (name === organizerName) return;
      try {
        const res = await window.storage.get('follows', true).catch(() => null);
        const current = res && res.value ? JSON.parse(res.value) : {};
        const mine = current[name] || [];
        const alreadyFollowing = mine.includes(organizerName);
        current[name] = alreadyFollowing ? mine.filter((n) => n !== organizerName) : [...mine, organizerName];
        await window.storage.set('follows', JSON.stringify(current), true);
        setFollows(current);
        showToast(alreadyFollowing ? t('toast.unfollowed', { name: organizerName }) : t('toast.followed', { name: organizerName }));
      } catch (err) {
        showToast(t('toast.unreadUpdateFailed'));
      }
    });
  };

  // Gamification légère : nombre de rencontres (organisées ou rejointes) ce mois-ci civil.
  // Une raison de revenir même sans notification.
  const monthlyCount = userName
    ? meetups.filter((m) => {
        // Le badge récompense une participation réelle : seules les rencontres réellement
        // clôturées comptent, jamais une simple inscription ou création (voir closeMeetupNow).
        if (!m.closed) return false;
        if (!(m.host === userName || m.participants.includes(userName))) return false;
        const d = new Date(m.datetime);
        const now = new Date();
        return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length
    : 0;
  const badgeUnlocked = monthlyCount >= BADGE_THRESHOLD;

  // Célèbre le badge une seule fois par mois civil (persisté localement pour survivre à un
  // rechargement de page), au moment où le seuil est franchi.
  useEffect(() => {
    if (!badgeUnlocked || !userName) return;
    const monthKey = `rezo-badge-seen-${new Date().getFullYear()}-${new Date().getMonth()}`;
    (async () => {
      try {
        const res = await window.storage.get(monthKey, false).catch(() => null);
        if (res && res.value) return;
        await window.storage.set(monthKey, 'true', false);
        showToast(t('toast.badgeUnlocked', { threshold: BADGE_THRESHOLD }));
      } catch (err) {
        // best effort
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeUnlocked, userName]);

  // Horloge légère : force un nouveau rendu périodique pour que les éléments dépendant de l'heure
  // (bouton "Démarrer" qui apparaît à l'heure prévue, relance "toujours en cours ?") se mettent à
  // jour sans attendre une action de l'utilisateur.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  // Avis déjà écartés par l'utilisateur (par appareil) : évite de rouvrir la fenêtre de notation
  // en boucle après un "Plus tard" alors que le bouton "Noter" reste disponible manuellement.
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('rezo-rating-dismissed', false);
        if (res && res.value) setDismissedRatingIds(new Set(JSON.parse(res.value)));
      } catch (err) {
        // rien d'écarté pour l'instant, comportement par défaut
      }
    })();
  }, []);

  // Compteurs de messages lus par rencontre (par appareil) : persistent pour que le badge de
  // non-lus survive à une fermeture/réouverture de l'app, pas seulement à la session en cours.
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('rezo-chat-read-counts', false);
        if (res && res.value) setChatReadCounts(JSON.parse(res.value));
      } catch (err) {
        // rien de lu pour l'instant, comportement par défaut (tout compte comme non-lu)
      }
    })();
  }, []);

  // Sonde le nombre total de messages de chaque rencontre où l'utilisateur est impliqué (hôte ou
  // participant), pour calculer le badge de non-lus sans avoir à ouvrir chaque conversation.
  useEffect(() => {
    if (!userName) return;
    const myIds = meetups
      .filter((m) => m.host === userName || m.participants.includes(userName))
      .map((m) => m.id);
    if (!myIds.length) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const results = await Promise.all(
          myIds.map(async (id) => {
            try {
              const res = await window.storage.get(`chat:${id}`, true);
              const list = res && res.value ? JSON.parse(res.value) : [];
              return [id, Array.isArray(list) ? list.length : 0];
            } catch (err) {
              return [id, 0];
            }
          })
        );
        if (!cancelled) setChatTotalCounts((prev) => ({ ...prev, ...Object.fromEntries(results) }));
      } catch (err) {
        // best effort, un prochain cycle resynchronisera les badges
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, meetups.length]);

  // Prolongation automatique des séries récurrentes "jusqu'à nouvel ordre" (ou pas encore arrivées à
  // leur date de fin) : la génération initiale est plafonnée à SERIES_OCCURRENCE_CAP occurrences
  // (voir handleCreate/generateSeriesOccurrences), donc sans ce relais une série hebdomadaire
  // s'arrêterait silencieusement après ~3 mois. Déclenché côté client de l'organisateur uniquement
  // (comme la clôture à 30 min ci-dessous) — pas de vrai cron serveur dans ce prototype.
  useEffect(() => {
    if (!userName) return;
    const bySeriesId = new Map();
    meetups.forEach((m) => {
      if (!m.seriesId || m.host !== userName) return;
      if (!bySeriesId.has(m.seriesId)) bySeriesId.set(m.seriesId, []);
      bySeriesId.get(m.seriesId).push(m);
    });
    bySeriesId.forEach((occurrences, seriesId) => {
      if (extendingSeriesRef.current.has(seriesId)) return;
      if (occurrences.some((m) => m.seriesStopped)) return;
      const upcoming = occurrences.filter((m) => !m.closed && !isPast(m));
      if (upcoming.length > 2) return; // encore assez d'occurrences à venir, rien à faire pour l'instant
      const last = occurrences.reduce((a, b) => (new Date(a.datetime) > new Date(b.datetime) ? a : b));
      const frequency = last.seriesFrequency;
      if (frequency !== 'weekly' && frequency !== 'biweekly' && frequency !== 'monthly') return;
      const endDate = last.seriesEndDate || null;
      if (endDate && new Date(last.datetime).getTime() >= new Date(`${endDate}T23:59`).getTime()) return; // fin naturelle déjà atteinte
      extendingSeriesRef.current.add(seriesId);
      (async () => {
        try {
          const startFrom = new Date(last.datetime);
          if (frequency === 'monthly') startFrom.setMonth(startFrom.getMonth() + 1);
          else startFrom.setDate(startFrom.getDate() + (SERIES_STEP_DAYS[frequency] || 7));
          const newDates = generateSeriesOccurrences(toDatetimeLocalValue(startFrom), frequency, endDate);
          if (newDates.length === 0) return;
          const freshRes = await window.storage.get('meetups-list', true).catch(() => null);
          const freshMeetups = freshRes && freshRes.value ? JSON.parse(freshRes.value) : meetups;
          // Un autre onglet/appareil de l'organisateur a peut-être déjà prolongé la série entre-temps.
          const alreadyMax = freshMeetups
            .filter((m) => m.seriesId === seriesId)
            .reduce((max, m) => Math.max(max, m.seriesIndex || 0), 0);
          if (alreadyMax > (last.seriesIndex || 0)) return;
          if (freshMeetups.some((m) => m.seriesId === seriesId && m.seriesStopped)) return;
          const subscribers = (last.seriesSubscribers || []).filter((n) => n !== last.host);
          const participants = [last.host, ...subscribers].slice(0, last.maxParticipants);
          const participantGenders = {};
          participants.forEach((p) => {
            if (last.participantGenders && last.participantGenders[p]) participantGenders[p] = last.participantGenders[p];
          });
          const newOccurrences = newDates.map((datetime, i) => ({
            ...last,
            id: uid(),
            datetime,
            seriesIndex: (last.seriesIndex || 0) + 1 + i,
            participants: [...participants],
            participantGenders: { ...participantGenders },
            seriesSubscribers: [...(last.seriesSubscribers || [])],
            pendingRequests: [],
            closed: false,
            closedAt: undefined,
            started: false,
            startedAt: undefined,
            ongoingDeferredUntil: undefined,
            arrivals: {},
            ratings: [],
            reports: [],
            createdAt: new Date().toISOString(),
          }));
          await saveMeetups([...newOccurrences, ...freshMeetups]);
        } catch (err) {
          // best effort : la série reste utilisable même si la prolongation automatique échoue,
          // elle sera retentée au prochain rendu tant que le seuil est toujours atteint.
        } finally {
          extendingSeriesRef.current.delete(seriesId);
        }
      })();
    });
  }, [meetups, userName, saveMeetups]);

  // 30 min après l'heure prévue, on demande à l'organisateur si sa rencontre est toujours en
  // cours (voir confirmStillOngoing / closeMeetupNow), tant qu'il n'a pas répondu ou que le délai
  // de report n'est pas écoulé.
  useEffect(() => {
    if (!userName || ongoingCheckMeetup) return;
    const due = meetups.find((m) => {
      if (m.host !== userName || !m.started || m.closed) return false;
      const dueAt = meetupCheckinDueAt(m);
      if (dueAt === null || now < dueAt) return false;
      const deferredUntil = m.ongoingDeferredUntil ? new Date(m.ongoingDeferredUntil).getTime() : 0;
      return !deferredUntil || now >= deferredUntil;
    });
    if (due) setOngoingCheckMeetup(due);
  }, [meetups, userName, now, ongoingCheckMeetup]);

  // Dès qu'une rencontre est clôturée — ou que le délai de vérification est dépassé sans réponse
  // de l'organisateur — chaque participant (hors organisateur) est invité à laisser son avis.
  useEffect(() => {
    if (!userName || ratingMeetup) return;
    const candidate = meetups.find((m) => {
      if (m.host === userName) return false;
      if (!m.participants.includes(userName)) return false;
      if ((m.ratings || []).some((r) => r.rater === userName)) return false;
      if (dismissedRatingIds.has(m.id)) return false;
      return isRatingDue(m, now);
    });
    if (candidate) {
      setRatingMeetup(candidate);
      setRatingHostStars(0);
      setRatingSatisfactionStars(0);
    }
  }, [meetups, userName, now, ratingMeetup, dismissedRatingIds]);

  const applyManualCoords = async (coords) => {
    if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) {
      showToast(t('toast.invalidCoords'));
      return;
    }
    setUserCoords(coords);
    setLocationError(null);
    try {
      await window.storage.set('rezo-coords', JSON.stringify(coords), false);
    } catch (err) {
      // best effort
    }
    showToast(t('toast.positionSetManually'));
  };

  // Le GPS seul n'est pas fiable (permission refusée, contexte restreint...) : la source principale
  // de proximité est désormais la ville déclarée au profil (toujours disponible une fois
  // renseignée), le GPS restant un bonus silencieux pour affiner le tri par distance réelle à
  // l'intérieur du groupe "même ville" quand il est accordé.
  const activateNearMe = () => {
    if (!userCity) {
      showToast(t('toast.addCityFirst'));
      openProfile();
      return;
    }
    setLocating(true);
    // Délai bref volontaire : retour visuel clair (voir demande), même si le tri par ville est
    // instantané une fois la ville connue.
    setTimeout(async () => {
      setNearMeActive(true);
      setLocating(false);
      try {
        await window.storage.set('rezo-near-me-active', 'true', false);
      } catch (err) {
        // best effort
      }
      showToast(t('toast.nearMeActivated', { city: userCity }));
    }, 300);

    // Bonus GPS best effort, en arrière-plan : n'empêche jamais le tri par ville de fonctionner
    // (voir nearCityMeetups, qui ne dépend pas de userCoords) même en cas d'échec ou de refus.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          setLocationError(null);
          try {
            await window.storage.set('rezo-coords', JSON.stringify(coords), false);
          } catch (err) {
            // best effort persistence
          }
        },
        (err) => {
          setLocationError(
            err.code === 1
              ? 'Localisation précise refusée — le tri reste basé sur ta ville.'
              : "Position précise indisponible — le tri reste basé sur ta ville."
          );
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const disableNearMe = async () => {
    setNearMeActive(false);
    setUserCoords(null);
    setLocationError(null);
    try {
      await window.storage.set('rezo-near-me-active', 'false', false);
      await window.storage.delete('rezo-coords', false).catch(() => {});
    } catch (err) {
      // best effort
    }
    showToast(t('toast.positionDisabled'));
  };

  const resetPhoneVerifyUi = () => {
    setVerifyCodeSent(false);
    setVerifyDevCode(null);
    setVerifyCodeInput('');
  };

  const openProfile = () => {
    if (userEmail && userName && userLastName && userGender && userPreferences.length > 0) {
      setPendingAction(null);
      setNameDraft(userName);
      setLastNameDraft(userLastName);
      setCountryDraft(userCountry || 'Maroc');
      setCityDraft(userCity || '');
      setShowLastNameDraft(userShowLastName);
      setGenderDraft(userGender);
      setPreferencesDraft(userPreferences);
      setAvatarDraft(null);
      setCoverDraft(null);
      setBioDraft(userBio || '');
      setPhoneDraft(userPhone || '');
      setPhoneVerifiedDraft(userPhoneVerified);
      resetPhoneVerifyUi();
      setShowNameModal(true);
    } else {
      requireName(() => {});
    }
  };

  // Ouvre la vraie page de profil (voir plus bas dans le rendu) plutôt que le formulaire d'édition
  // — accessible depuis l'onglet "Profil" de la barre du bas une fois le profil complet.
  const openProfilePage = () => {
    if (userEmail && userName && userLastName && userGender && userPreferences.length > 0) {
      setViewedProfileName(null);
      setShowCirclePage(false);
      setShowProfilePage(true);
    } else {
      requireName(() => {});
    }
  };

  // Porte d'entrée avant toute action nécessitant une identité : d'abord un compte
  // (e-mail + mot de passe), puis obligatoirement le profil (nom, prénom, sexe, activités).
  const requireName = (action) => {
    if (userEmail && userName && userLastName && userGender && userPreferences.length > 0) {
      action(userName, userGender);
      return;
    }
    setPendingAction(() => action);
    if (!userEmail) {
      setAuthScreen('choose');
      setAuthMode('signup');
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirm('');
      setAuthShowPassword(false);
      setAuthError(null);
      setAuthPhoneNumber('');
      setAuthPhoneCode('');
      setAuthPhoneDevCode(null);
      setShowAuthModal(true);
      // Pré-sélection best effort du préfixe pays (même géoloc IP que le profil).
      guessCountryFromIP().then((guessed) => {
        const match = DIAL_CODES.find((d) => d.country === guessed);
        if (match) {
          setAuthDialCountry(match.country);
          setAuthDialCode(match.code);
        }
      });
      return;
    }
    setNameDraft(userName || '');
    setLastNameDraft(userLastName || '');
    setCountryDraft(userCountry || 'Maroc');
    setCityDraft(userCity || '');
    setShowLastNameDraft(userShowLastName);
    setGenderDraft(userGender || '');
    setPreferencesDraft(userPreferences.length > 0 ? userPreferences : []);
    setAvatarDraft(null);
    setCoverDraft(null);
    setBioDraft(userBio || '');
    setPhoneDraft(userPhone || '');
    setPhoneVerifiedDraft(userPhoneVerified);
    resetPhoneVerifyUi();
    setShowNameModal(true);
  };

  const submitSignup = async () => {
    const email = authEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setAuthError('Adresse e-mail invalide.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (authPassword !== authConfirm) {
      setAuthError('Les mots de passe ne correspondent pas.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const accounts = await loadAccounts();
      if (accounts[email]) {
        setAuthError('Un compte existe déjà avec cette adresse.');
        setAuthMode('login');
        return;
      }
      const passwordHash = await hashPassword(authPassword);
      accounts[email] = { passwordHash, createdAt: new Date().toISOString(), language };
      await saveAccounts(accounts);
      await window.storage.set('rezo-email', email, false);
      setUserEmail(email);
      setShowAuthModal(false);
      setNameDraft('');
      setLastNameDraft('');
      setCountryDraft('Maroc');
      setCityDraft('');
      setShowLastNameDraft(false);
      setGenderDraft('');
      setPreferencesDraft([]);
      setAvatarDraft(null);
      setCoverDraft(null);
      setBioDraft('');
      setPhoneDraft('');
      setPhoneVerifiedDraft(false);
      resetPhoneVerifyUi();
      setShowNameModal(true);
      // Pré-sélection best effort du pays (géoloc IP) : n'écrase pas un choix déjà fait entre-temps.
      guessCountryFromIP().then((guessed) => {
        setCountryDraft((current) => (current === 'Maroc' ? guessed : current));
      });
    } catch (err) {
      setAuthError(isNetworkError(err) ? SERVER_UNREACHABLE_MESSAGE : 'Erreur lors de la création du compte, réessaie.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const submitLogin = async () => {
    const email = authEmail.trim().toLowerCase();
    if (!email || !authPassword) {
      setAuthError('Renseigne ton e-mail et ton mot de passe.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const accounts = await loadAccounts();
      const account = accounts[email];
      if (!account) {
        setAuthError('Aucun compte avec cette adresse. Crée-en un.');
        setAuthMode('signup');
        return;
      }
      const passwordHash = await hashPassword(authPassword);
      if (passwordHash !== account.passwordHash) {
        setAuthError('Mot de passe incorrect.');
        return;
      }
      const name = account.name || '';
      const lastName = account.lastName || '';
      const country = account.country || 'Maroc';
      const city = account.city || '';
      const showLastName = !!account.showLastNamePublicly;
      const showCity = !!account.showCityPublicly;
      const cover = account.cover || null;
      const bio = account.bio || '';
      const gender = account.gender || '';
      const preferences = account.preferences || [];
      const avatar = account.avatar || null;
      const phone = account.phone || null;
      const phoneVerified = !!account.phoneVerified;
      await window.storage.set('rezo-email', email, false);
      if (name) await window.storage.set('rezo-username', name, false);
      if (lastName) await window.storage.set('rezo-lastname', lastName, false);
      await window.storage.set('rezo-country', country, false);
      if (city) await window.storage.set('rezo-city', city, false);
      await window.storage.set('rezo-show-lastname', showLastName ? 'true' : 'false', false);
      await window.storage.set('rezo-show-city', showCity ? 'true' : 'false', false);
      if (cover) await window.storage.set('rezo-cover', cover, false);
      if (bio) await window.storage.set('rezo-bio', bio, false);
      if (gender) await window.storage.set('rezo-gender', gender, false);
      if (preferences.length) await window.storage.set('rezo-preferences', JSON.stringify(preferences), false);
      if (avatar) await window.storage.set('rezo-avatar', avatar, false);
      if (phone) await window.storage.set('rezo-phone', phone, false);
      await window.storage.set('rezo-phone-verified', phoneVerified ? 'true' : 'false', false);
      // Langue : priorité à celle déjà enregistrée sur le compte (synchronisation multi-appareils) ;
      // sinon on adopte celle de cet appareil et on l'enregistre sur le compte pour la prochaine fois.
      if (account.language && LANGUAGES.some((l) => l.code === account.language)) {
        setLanguageState(account.language);
        await window.storage.set('rezo-language', account.language, false);
      } else {
        accounts[email] = { ...accounts[email], language };
        await saveAccounts(accounts);
      }
      setUserEmail(email);
      setUserName(name || null);
      setUserLastName(lastName || null);
      setUserCountry(country);
      setUserCity(city || null);
      setUserShowLastName(showLastName);
      setUserShowCity(showCity);
      setUserCover(cover);
      setUserBio(bio);
      setUserGender(gender || null);
      setUserPreferences(preferences);
      setUserAvatar(avatar);
      setUserPhone(phone);
      setUserPhoneVerified(phoneVerified);
      setShowAuthModal(false);
      setNameDraft(name);
      setLastNameDraft(lastName);
      setCountryDraft(country);
      setCityDraft(city);
      setShowLastNameDraft(showLastName);
      setGenderDraft(gender);
      setPreferencesDraft(preferences);
      setAvatarDraft(null);
      setCoverDraft(null);
      setBioDraft(bio);
      setPhoneDraft(phone || '');
      setPhoneVerifiedDraft(phoneVerified);
      resetPhoneVerifyUi();
      setShowNameModal(true);
    } catch (err) {
      setAuthError(isNetworkError(err) ? SERVER_UNREACHABLE_MESSAGE : 'Erreur de connexion, réessaie.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Authentification par numéro de téléphone (méthode principale) : réutilise le flux de
  // vérification déjà en place pour le badge "Vérifié" (voir lib/verify.js), avec le numéro
  // complet lui-même comme identifiant de compte — même limitation assumée : pas de vrai
  // fournisseur SMS/WhatsApp branché, le code est donc affiché à l'écran ("devCode").
  const requestPhoneAuthCode = async (channel) => {
    const digits = authPhoneNumber.replace(/\s+/g, '');
    if (!digits) {
      setAuthError('Renseigne ton numéro de téléphone.');
      return;
    }
    const fullPhone = `${authDialCode}${digits}`;
    setAuthPhoneChannel(channel);
    setAuthPhoneBusy(true);
    setAuthError(null);
    try {
      const data = await requestPhoneCode(fullPhone, fullPhone);
      setAuthPhoneDevCode(data.devCode || null);
      setAuthPhoneCode('');
      setAuthScreen('phone-code');
    } catch (err) {
      setAuthError(isNetworkError(err) ? SERVER_UNREACHABLE_MESSAGE : err.message || "Impossible d'envoyer le code.");
    } finally {
      setAuthPhoneBusy(false);
    }
  };

  const confirmPhoneAuthCode = async () => {
    if (!authPhoneCode.trim()) {
      setAuthError('Renseigne le code reçu.');
      return;
    }
    const digits = authPhoneNumber.replace(/\s+/g, '');
    const fullPhone = `${authDialCode}${digits}`;
    setAuthPhoneBusy(true);
    setAuthError(null);
    try {
      await confirmPhoneCode(fullPhone, fullPhone, authPhoneCode.trim());
      // Le serveur vient de créer/mettre à jour accounts[fullPhone] = {..., phone, phoneVerified: true}
      // (voir server/index.js /api/verify/confirm) — on recharge pour savoir si le profil social
      // (nom, activités...) existe déjà (retour) ou reste à compléter (première connexion).
      const accounts = await loadAccounts();
      const account = accounts[fullPhone] || {};
      const name = account.name || '';
      const lastName = account.lastName || '';
      const country = account.country || 'Maroc';
      const city = account.city || '';
      const showLastName = !!account.showLastNamePublicly;
      const showCity = !!account.showCityPublicly;
      const cover = account.cover || null;
      const bio = account.bio || '';
      const gender = account.gender || '';
      const preferences = account.preferences || [];
      const avatar = account.avatar || null;
      await window.storage.set('rezo-email', fullPhone, false);
      await window.storage.set('rezo-phone', fullPhone, false);
      await window.storage.set('rezo-phone-verified', 'true', false);
      if (name) await window.storage.set('rezo-username', name, false);
      if (lastName) await window.storage.set('rezo-lastname', lastName, false);
      await window.storage.set('rezo-country', country, false);
      if (city) await window.storage.set('rezo-city', city, false);
      await window.storage.set('rezo-show-lastname', showLastName ? 'true' : 'false', false);
      await window.storage.set('rezo-show-city', showCity ? 'true' : 'false', false);
      if (cover) await window.storage.set('rezo-cover', cover, false);
      if (bio) await window.storage.set('rezo-bio', bio, false);
      if (gender) await window.storage.set('rezo-gender', gender, false);
      if (preferences.length) await window.storage.set('rezo-preferences', JSON.stringify(preferences), false);
      if (avatar) await window.storage.set('rezo-avatar', avatar, false);
      if (account.language && LANGUAGES.some((l) => l.code === account.language)) {
        setLanguageState(account.language);
        await window.storage.set('rezo-language', account.language, false);
      } else {
        accounts[fullPhone] = { ...accounts[fullPhone], language };
        await saveAccounts(accounts);
      }

      setUserEmail(fullPhone);
      setUserPhone(fullPhone);
      setUserPhoneVerified(true);
      setUserName(name || null);
      setUserLastName(lastName || null);
      setUserCountry(country);
      setUserCity(city || null);
      setUserShowLastName(showLastName);
      setUserShowCity(showCity);
      setUserCover(cover);
      setUserBio(bio);
      setUserGender(gender || null);
      setUserPreferences(preferences);
      setUserAvatar(avatar);

      setShowAuthModal(false);
      setNameDraft(name);
      setLastNameDraft(lastName);
      setCountryDraft(country);
      setCityDraft(city);
      setShowLastNameDraft(showLastName);
      setGenderDraft(gender);
      setPreferencesDraft(preferences);
      setAvatarDraft(null);
      setCoverDraft(null);
      setBioDraft(bio);
      setPhoneDraft(fullPhone);
      setPhoneVerifiedDraft(true);
      resetPhoneVerifyUi();
      setShowNameModal(true);
    } catch (err) {
      setAuthError(isNetworkError(err) ? SERVER_UNREACHABLE_MESSAGE : err.message || 'Code incorrect.');
    } finally {
      setAuthPhoneBusy(false);
    }
  };

  // Google/Facebook nécessitent de vraies applications OAuth (client ID, App ID Facebook) qu'on ne
  // peut pas improviser ici : plutôt que de simuler une fausse connexion, on l'annonce clairement.
  const handleOAuthStub = (provider) => {
    showToast(t('toast.oauthUnavailable', { provider }));
  };

  const showLegalPlaceholder = (label) => {
    showToast(t('toast.legalPlaceholder', { label }));
  };

  const logout = async () => {
    try {
      await window.storage.delete('rezo-email', false).catch(() => {});
    } catch (err) {
      // best effort
    }
    setUserEmail(null);
    setUserName(null);
    setUserLastName(null);
    setUserCountry(null);
    setUserCity(null);
    setUserShowLastName(false);
    setUserShowCity(false);
    setUserCover(null);
    setUserBio('');
    setUserGender(null);
    setUserPreferences([]);
    setUserAvatar(null);
    setUserPhone(null);
    setUserPhoneVerified(false);
    setShowNameModal(false);
    setShowProfilePage(false);
    setShowSettingsSheet(false);
    setPendingAction(null);
    showToast(t('toast.loggedOut'));
  };

  const togglePreference = (id) => {
    setPreferencesDraft((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleAvatarFile = async (file) => {
    if (!file) return;
    setAvatarProcessing(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarDraft(dataUrl);
    } catch (err) {
      showToast(t('toast.imageError'));
    } finally {
      setAvatarProcessing(false);
    }
  };

  const handleCoverFile = async (file) => {
    if (!file) return;
    setCoverProcessing(true);
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      setCoverDraft(dataUrl);
    } catch (err) {
      showToast(t('toast.imageError'));
    } finally {
      setCoverProcessing(false);
    }
  };

  const confirmName = async () => {
    const trimmed = nameDraft.trim();
    const trimmedLastName = lastNameDraft.trim();
    const trimmedCity = cityDraft.trim();
    if (!trimmed || !trimmedLastName || !countryDraft || !genderDraft || preferencesDraft.length === 0) return;
    const avatarRemoved = avatarDraft === '';
    const finalAvatar = avatarDraft ? avatarDraft : avatarRemoved ? null : userAvatar;
    const coverRemoved = coverDraft === '';
    const finalCover = coverDraft ? coverDraft : coverRemoved ? null : userCover;
    const trimmedBio = bioDraft.trim().slice(0, 280);
    try {
      await window.storage.set('rezo-username', trimmed, false);
      await window.storage.set('rezo-lastname', trimmedLastName, false);
      await window.storage.set('rezo-country', countryDraft, false);
      await window.storage.set('rezo-city', trimmedCity, false);
      await window.storage.set('rezo-show-lastname', showLastNameDraft ? 'true' : 'false', false);
      await window.storage.set('rezo-gender', genderDraft, false);
      await window.storage.set('rezo-preferences', JSON.stringify(preferencesDraft), false);
      if (finalCover) await window.storage.set('rezo-cover', finalCover, false);
      else await window.storage.delete('rezo-cover', false).catch(() => {});
      await window.storage.set('rezo-bio', trimmedBio, false);
      if (finalAvatar) {
        await window.storage.set('rezo-avatar', finalAvatar, false);
        const nextProfiles = { ...profilesMap, [trimmed]: finalAvatar };
        await window.storage.set('profiles', JSON.stringify(nextProfiles), true);
        setProfilesMap(nextProfiles);
      } else if (avatarRemoved) {
        await window.storage.delete('rezo-avatar', false).catch(() => {});
        const nextProfiles = { ...profilesMap };
        delete nextProfiles[trimmed];
        await window.storage.set('profiles', JSON.stringify(nextProfiles), true);
        setProfilesMap(nextProfiles);
      }
      await window.storage.set('rezo-phone', phoneDraft.trim(), false);
      await window.storage.set('rezo-phone-verified', phoneVerifiedDraft ? 'true' : 'false', false);
      if (userEmail) {
        const accounts = await loadAccounts();
        accounts[userEmail] = {
          ...(accounts[userEmail] || {}),
          name: trimmed,
          lastName: trimmedLastName,
          country: countryDraft,
          city: trimmedCity,
          showLastNamePublicly: showLastNameDraft,
          showCityPublicly: userShowCity,
          cover: finalCover || null,
          bio: trimmedBio,
          gender: genderDraft,
          preferences: preferencesDraft,
          avatar: finalAvatar || null,
          phone: phoneDraft.trim() || null,
          phoneVerified: phoneVerifiedDraft,
          updatedAt: new Date().toISOString(),
        };
        await saveAccounts(accounts);
      }
      // Registre partagé "nom -> vérifié", pour afficher le badge sur les cartes sans exposer
      // le numéro lui-même à personne d'autre que son propriétaire.
      const verifiedRes = await window.storage.get('verified-map', true).catch(() => null);
      const nextVerifiedMap = verifiedRes && verifiedRes.value ? JSON.parse(verifiedRes.value) : {};
      if (phoneVerifiedDraft) nextVerifiedMap[trimmed] = true;
      else delete nextVerifiedMap[trimmed];
      await window.storage.set('verified-map', JSON.stringify(nextVerifiedMap), true);
      setVerifiedMap(nextVerifiedMap);
      // Nom de famille : privé par défaut, n'entre dans le registre public que si l'utilisateur a
      // explicitement coché "l'afficher publiquement" (voir Objectif de la demande).
      const lastNamesRes = await window.storage.get('public-lastnames', true).catch(() => null);
      const nextPublicLastNames = lastNamesRes && lastNamesRes.value ? JSON.parse(lastNamesRes.value) : {};
      if (showLastNameDraft) nextPublicLastNames[trimmed] = trimmedLastName;
      else delete nextPublicLastNames[trimmed];
      await window.storage.set('public-lastnames', JSON.stringify(nextPublicLastNames), true);
      setPublicLastNames(nextPublicLastNames);
      // Même logique pour la ville : le choix de la rendre publique se fait dans Paramètres >
      // Confidentialité (userShowCity), mais on garde le registre à jour si la ville change ici.
      const citiesRes = await window.storage.get('public-cities', true).catch(() => null);
      const nextPublicCities = citiesRes && citiesRes.value ? JSON.parse(citiesRes.value) : {};
      if (userShowCity && trimmedCity) nextPublicCities[trimmed] = trimmedCity;
      else delete nextPublicCities[trimmed];
      await window.storage.set('public-cities', JSON.stringify(nextPublicCities), true);
      setPublicCities(nextPublicCities);
      // Couverture/bio/activités/pays : publiées systématiquement (comme l'avatar), pour que la
      // page de profil public d'un organisateur (voir tap sur son nom depuis une carte) ait de quoi
      // s'afficher sans dépendre d'une bascule supplémentaire.
      const profilesPubRes = await window.storage.get('public-profiles', true).catch(() => null);
      const nextPublicProfiles = profilesPubRes && profilesPubRes.value ? JSON.parse(profilesPubRes.value) : {};
      nextPublicProfiles[trimmed] = {
        cover: finalCover || null,
        bio: trimmedBio,
        preferences: preferencesDraft,
        country: countryDraft,
      };
      await window.storage.set('public-profiles', JSON.stringify(nextPublicProfiles), true);
      setPublicProfiles(nextPublicProfiles);
    } catch (err) {
      // continue even if persistence fails
    }
    setUserName(trimmed);
    setUserLastName(trimmedLastName);
    setUserCountry(countryDraft);
    setUserCity(trimmedCity);
    setUserShowLastName(showLastNameDraft);
    setUserCover(finalCover);
    setUserBio(trimmedBio);
    setUserGender(genderDraft);
    setUserPreferences(preferencesDraft);
    setUserAvatar(finalAvatar);
    setUserPhone(phoneDraft.trim() || null);
    setUserPhoneVerified(phoneVerifiedDraft);
    setAvatarDraft(null);
    setCoverDraft(null);
    setShowNameModal(false);
    if (pendingAction) {
      pendingAction(trimmed, genderDraft);
      setPendingAction(null);
    }
  };

  const onPhoneDraftChange = (value) => {
    setPhoneDraft(value);
    if (value.trim() !== (userPhone || '')) setPhoneVerifiedDraft(false); // nouveau numéro = à re-vérifier
    resetPhoneVerifyUi();
  };

  const requestPhoneVerification = async () => {
    const phone = phoneDraft.trim();
    if (!phone) {
      showToast(t('toast.enterPhoneNumber'));
      return;
    }
    setVerifyBusy(true);
    try {
      const { devCode } = await requestPhoneCode(userEmail, phone);
      setVerifyCodeSent(true);
      setVerifyDevCode(devCode);
      setVerifyCodeInput('');
    } catch (err) {
      showToast(err.message || t('toast.codeSendFailed'));
    } finally {
      setVerifyBusy(false);
    }
  };

  const confirmPhoneVerification = async () => {
    const phone = phoneDraft.trim();
    const code = verifyCodeInput.trim();
    if (!code) return;
    setVerifyBusy(true);
    try {
      await confirmPhoneCode(userEmail, phone, code);
      setPhoneVerifiedDraft(true);
      resetPhoneVerifyUi();
      showToast(t('toast.phoneVerifiedToast'));
    } catch (err) {
      showToast(err.message || t('toast.wrongCode'));
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleCreate = (form) => {
    requireName(async (name, gender) => {
      let audience = form.audience || 'mixte';
      // Sécurité : une femme ne peut pas publier une rencontre 100% Hommes, et inversement,
      // même si le choix a été fait avant que le sexe soit confirmé.
      if (audience === 'hommes' && gender !== 'homme') audience = 'mixte';
      if (audience === 'femmes' && gender !== 'femme') audience = 'mixte';

      // Priorité des coordonnées : le lieu précis choisi via autocomplétion (le plus fin), puis la
      // zone choisie via autocomplétion, puis "épingler ma position actuelle" (dépend d'être sur
      // place au moment de la création) — voir useGeoSuggest dans CreateModal.
      const resolvedCoords =
        form.locationCoords || form.zoneCoords || (form.useLocation && userCoords ? userCoords : null);

      if (editingMeetup) {
        const updated = meetups.map((m) =>
          m.id === editingMeetup.id
            ? {
                ...m,
                title: form.title.trim(),
                activity: form.activity,
                zone: form.zone.trim(),
                location: form.location.trim(),
                datetime: form.datetime,
                maxParticipants: Number(form.maxParticipants) || 8,
                note: form.note.trim(),
                audience,
                ageMin: Number(form.ageMin) || 18,
                ageMax: Number(form.ageMax) || 99,
                coords: resolvedCoords || m.coords,
              }
            : m
        );
        await saveMeetups(updated);
        setShowCreate(false);
        setEditingMeetup(null);
        showToast(t('toast.meetupUpdated'));
        return;
      }

      const baseMeetup = {
        title: form.title.trim(),
        activity: form.activity,
        zone: form.zone.trim(),
        location: form.location.trim(),
        maxParticipants: Number(form.maxParticipants) || 8,
        note: form.note.trim(),
        host: name,
        hostGender: gender,
        audience,
        ageMin: Number(form.ageMin) || 18,
        ageMax: Number(form.ageMax) || 99,
        pendingRequests: [],
        createdAt: new Date().toISOString(),
        coords: resolvedCoords,
      };

      // Récurrence : génère toutes les occurrences d'un coup (voir generateSeriesOccurrences),
      // chacune sa propre rencontre indépendante partageant seriesId/seriesFrequency — l'organisateur
      // ne participe (comme pour une rencontre simple) qu'à chaque occurrence individuellement.
      const isRecurring = form.recurrence && form.recurrence !== 'none';
      const occurrenceDates = isRecurring
        ? generateSeriesOccurrences(form.datetime, form.recurrence, form.recurrenceEndDate)
        : [form.datetime];
      const seriesId = isRecurring ? uid() : null;
      // seriesEndDate (ou null si "jusqu'à nouvel ordre") est répété sur chaque occurrence : c'est
      // la seule trace de ce choix une fois les documents créés, nécessaire pour savoir si la série
      // peut être prolongée automatiquement plus tard (voir l'effet d'extension plus bas).
      const newMeetups = occurrenceDates.map((datetime, index) => ({
        ...baseMeetup,
        id: uid(),
        datetime,
        participants: [name],
        participantGenders: { [name]: gender },
        ...(isRecurring
          ? {
              seriesId,
              seriesFrequency: form.recurrence,
              seriesIndex: index,
              seriesEndDate: form.recurrenceEndDate || null,
              seriesSubscribers: [],
            }
          : {}),
      }));

      const updated = [...newMeetups, ...meetups];
      await saveMeetups(updated);
      setShowCreate(false);
      setTemplateDraft(null);
      showToast(t('toast.meetupCreated'));

      // Notifie les abonnés de l'organisateur (voir toggleFollow) qu'une nouvelle rencontre vient
      // d'être publiée — uniquement pour la toute première occurrence, pas pour chaque occurrence
      // pré-générée d'une série.
      try {
        const followsRes = await window.storage.get('follows', true).catch(() => null);
        const followsMap = followsRes && followsRes.value ? JSON.parse(followsRes.value) : {};
        const followers = Object.keys(followsMap).filter((follower) => (followsMap[follower] || []).includes(name));
        followers.forEach((follower) => {
          notifyByName(follower, 'REZO', t('toast.newMeetupFromFollowed', { name, title: newMeetups[0].title }), '/');
        });
      } catch (err) {
        // best effort, la rencontre reste créée même si la notification échoue
      }
    });
  };

  // "Rejoindre" envoie désormais une demande ; seul l'organisateur peut l'accepter.
  // Quitter une rencontre, en revanche, reste immédiat (pas d'approbation nécessaire).
  const performJoin = async (meetup, name, gender, wantsSeries) => {
    // Rencontres "Équipe REZO" (contenu de démarrage) : pas de vrai hôte connectable pour valider
    // les demandes, donc adhésion immédiate plutôt que de rester bloqué en attente pour toujours.
    if (meetup.host === REZO_HOST_NAME) {
      const updated = meetups.map((m) =>
        m.id === meetup.id
          ? {
              ...m,
              participants: [...m.participants, name],
              participantGenders: { ...(m.participantGenders || {}), [name]: gender },
            }
          : m
      );
      await saveMeetups(updated);
      showToast(t('toast.joined'));
      return;
    }

    const updated = meetups.map((m) =>
      m.id === meetup.id
        ? {
            ...m,
            pendingRequests: [
              ...(m.pendingRequests || []),
              { name, gender, requestedAt: new Date().toISOString(), wantsSeries: !!wantsSeries },
            ],
          }
        : m
    );
    await saveMeetups(updated);
    showToast(wantsSeries ? t('toast.seriesJoinedAll') : t('toast.requestSent'));
    notifyByName(
      meetup.host,
      'Nouvelle demande',
      `${name} veut rejoindre "${meetup.title}"`,
      '/'
    );
  };

  const requestOrLeave = (meetup) => {
    requireName(async (name, gender) => {
      const isParticipant = meetup.participants.includes(name);
      const isPending = (meetup.pendingRequests || []).some((r) => r.name === name);

      if (isParticipant) {
        // Quitter
        const updated = meetups.map((m) => {
          if (m.id !== meetup.id) return m;
          const participantGenders = { ...(m.participantGenders || {}) };
          delete participantGenders[name];
          return { ...m, participants: m.participants.filter((p) => p !== name), participantGenders };
        });
        await saveMeetups(updated);
        showToast(t('toast.leftMeetup'));
        return;
      }

      if (isPending) {
        // Annuler la demande
        const updated = meetups.map((m) =>
          m.id === meetup.id
            ? { ...m, pendingRequests: (m.pendingRequests || []).filter((r) => r.name !== name) }
            : m
        );
        await saveMeetups(updated);
        showToast(t('toast.requestCanceled'));
        return;
      }

      if (meetup.participants.length >= meetup.maxParticipants) {
        showToast(t('toast.meetupFull'));
        return;
      }
      const audience = meetup.audience || 'mixte';
      if (audience === 'femmes' && gender !== 'femme') {
        showToast(t('toast.womenOnly'));
        return;
      }
      if (audience === 'hommes' && gender !== 'homme') {
        showToast(t('toast.menOnly'));
        return;
      }

      if (meetup.seriesId && meetup.host !== REZO_HOST_NAME) {
        setSeriesJoinChoice({ meetup, name, gender });
        return;
      }

      await performJoin(meetup, name, gender, false);
    });
  };

  const respondToRequest = async (meetup, requesterName, accept) => {
    if (accept && meetup.participants.length >= meetup.maxParticipants) {
      showToast(t('toast.cantAcceptFull'));
      return;
    }
    const request = (meetup.pendingRequests || []).find((r) => r.name === requesterName);
    const wantsSeries = !!(accept && request && request.wantsSeries && meetup.seriesId);
    const updated = meetups.map((m) => {
      if (m.id === meetup.id) {
        const pendingRequests = (m.pendingRequests || []).filter((r) => r.name !== requesterName);
        if (!accept || !request) return { ...m, pendingRequests };
        const participantGenders = { ...(m.participantGenders || {}), [requesterName]: request.gender };
        const seriesSubscribers = wantsSeries
          ? [...new Set([...(m.seriesSubscribers || []), requesterName])]
          : m.seriesSubscribers;
        return { ...m, pendingRequests, participants: [...m.participants, requesterName], participantGenders, seriesSubscribers };
      }
      // Cascade : abonné à toute la série, on l'inscrit directement aux prochaines occurrences
      // (la validation initiale de l'organisateur suffit, pas de re-validation à chaque fois).
      // seriesSubscribers est aussi mis à jour sur CHAQUE occurrence (même complète ou passée) :
      // c'est la seule trace persistée de "veut toutes les prochaines occurrences", nécessaire pour
      // que l'extension automatique de la série (voir plus bas) sache qui réinscrire plus tard.
      if (wantsSeries && m.seriesId === meetup.seriesId) {
        const alreadySubscribed = (m.seriesSubscribers || []).includes(requesterName);
        const canJoinThisOne =
          !m.closed && !isPast(m) && !m.participants.includes(requesterName) && m.participants.length < m.maxParticipants;
        if (alreadySubscribed && !canJoinThisOne) return m;
        return {
          ...m,
          seriesSubscribers: [...new Set([...(m.seriesSubscribers || []), requesterName])],
          ...(canJoinThisOne
            ? {
                participants: [...m.participants, requesterName],
                participantGenders: { ...(m.participantGenders || {}), [requesterName]: request.gender },
              }
            : {}),
        };
      }
      return m;
    });
    await saveMeetups(updated);
    showToast(
      accept
        ? t('toast.requestAccepted', { name: requesterName })
        : t('toast.requestRejected', { name: requesterName })
    );
    if (accept) {
      notifyByName(
        requesterName,
        'Demande acceptée',
        `Tu as été accepté·e pour "${meetup.title}" !`,
        '/'
      );
    }
  };

  const REPORT_THRESHOLD = 3;

  const submitReport = (meetup, reason) => {
    requireName(async (name) => {
      const already = (meetup.reports || []).some((r) => r.reporter === name);
      if (already) {
        showToast(t('toast.alreadyReported'));
        setReportingMeetup(null);
        return;
      }
      const updated = meetups.map((m) =>
        m.id === meetup.id
          ? { ...m, reports: [...(m.reports || []), { reporter: name, reason, reportedAt: new Date().toISOString() }] }
          : m
      );
      await saveMeetups(updated);
      setReportingMeetup(null);
      showToast(t('toast.reportSent'));
    });
  };

  const inviteShareText = (meetup) =>
    `Rejoins-moi pour "${meetup.title}" (${activityById(meetup.activity).label}) le ${formatWhen(meetup.datetime)} à ${
      meetup.zone || 'un lieu à confirmer'
    }. Retrouve-moi sur REZO !`;

  const copyInviteText = async (meetup) => {
    try {
      await navigator.clipboard.writeText(inviteShareText(meetup));
      showToast(t('toast.messageCopied'));
    } catch (err) {
      showToast(t('toast.copyFailed'));
    }
  };

  const shareInvite = async (meetup) => {
    const text = inviteShareText(meetup);
    if (navigator.share) {
      try {
        await navigator.share({ title: meetup.title, text });
      } catch (err) {
        // annulé ou non supporté, on ne fait rien
      }
    } else {
      copyInviteText(meetup);
    }
  };

  const inviteFriendByName = (meetup) => {
    const trimmed = inviteNameDraft.trim();
    if (!trimmed) return;
    requireName(async (name) => {
      const alreadyIn = meetup.participants.includes(trimmed);
      const alreadyPending = (meetup.pendingRequests || []).some((r) => r.name === trimmed);
      if (alreadyIn || alreadyPending) {
        showToast(t('toast.alreadyRegisteredOrPending'));
        return;
      }
      if (meetup.participants.length >= meetup.maxParticipants) {
        showToast(t('toast.cantInviteFull'));
        return;
      }
      const updated = meetups.map((m) =>
        m.id === meetup.id
          ? {
              ...m,
              pendingRequests: [
                ...(m.pendingRequests || []),
                { name: trimmed, gender: null, invitedBy: name, requestedAt: new Date().toISOString() },
              ],
            }
          : m
      );
      await saveMeetups(updated);
      setInviteNameDraft('');
      showToast(t('toast.friendInvited', { name: trimmed }));
    });
  };

  // Moyenne des notes reçues par un organisateur, calculée sur l'ensemble de ses rencontres passées.
  const hostRatingStats = (hostName) => {
    const scores = [];
    meetups.forEach((m) => {
      if (m.host !== hostName) return;
      (m.ratings || []).forEach((r) => {
        if (typeof r.hostStars === 'number') scores.push(r.hostStars);
      });
    });
    if (scores.length === 0) return null;
    return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
  };

  // Moyenne de satisfaction pour une rencontre précise.
  const meetupSatisfactionStats = (meetup) => {
    const scores = (meetup.ratings || [])
      .map((r) => r.satisfactionStars)
      .filter((s) => typeof s === 'number');
    if (scores.length === 0) return null;
    return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
  };

  // Page de profil consultée : la sienne par défaut, ou celle d'un·e organisateur·trice quand on
  // tape sur "Organisé par X" depuis une carte — toutes les stats ci-dessous sont génériques et
  // se recalculent pour la personne consultée (viewedProfileName), pas seulement userName.
  const profileTargetName = viewedProfileName || userName;
  const isOwnProfile = !viewedProfileName || viewedProfileName === userName;
  const viewedPublicProfile = publicProfiles[profileTargetName] || {};
  const profileAvatarUrl = isOwnProfile ? userAvatar : (profilesMap[profileTargetName] || null);
  const profileCoverUrl = isOwnProfile ? userCover : (viewedPublicProfile.cover || null);
  const profileBio = isOwnProfile ? userBio : (viewedPublicProfile.bio || '');
  const profilePreferences = isOwnProfile ? userPreferences : (viewedPublicProfile.preferences || []);
  const profileCountry = isOwnProfile ? userCountry : (viewedPublicProfile.country || '');
  const profileCity = isOwnProfile ? userCity : (publicCities[profileTargetName] || '');
  const profileLastName = isOwnProfile ? userLastName : (publicLastNames[profileTargetName] || '');
  const profileVerified = isOwnProfile ? userPhoneVerified : !!verifiedMap[profileTargetName];
  const profileFollowersCount = Object.keys(follows).filter((follower) => (follows[follower] || []).includes(profileTargetName)).length;
  const isFollowingProfile = !!(follows[userName] || []).includes(profileTargetName);

  // Statistiques de la page de profil : uniquement des rencontres réellement clôturées (même
  // philosophie que monthlyCount/canRate — un chiffre qui reflète une vraie participation vécue).
  const organizedCount = profileTargetName ? meetups.filter((m) => m.closed && m.host === profileTargetName).length : 0;
  const participatedCount = profileTargetName
    ? meetups.filter((m) => m.closed && m.host !== profileTargetName && m.participants.includes(profileTargetName)).length
    : 0;
  const myRatingStats = profileTargetName ? hostRatingStats(profileTargetName) : null;
  // Nombre de fois où l'utilisateur a été le·la premier·ère arrivé·e sur place (voir markArrival).
  const firstArrivalCount = profileTargetName
    ? meetups.filter((m) => {
        if (!m.arrivals || !m.arrivals[profileTargetName]) return false;
        const times = Object.values(m.arrivals).map((t) => new Date(t).getTime());
        return new Date(m.arrivals[profileTargetName]).getTime() === Math.min(...times);
      }).length
    : 0;
  // Historique : dernières rencontres clôturées (organisées ou rejointes), plus récentes d'abord —
  // aperçu affiché sur la page de profil, avec renvoi vers "Mes sorties" pour la liste complète.
  const profileHistory = profileTargetName
    ? meetups
        .filter((m) => m.closed && (m.host === profileTargetName || m.participants.includes(profileTargetName)))
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
        .slice(0, 3)
    : [];
  // Badges "façon succès" : chaque palier est un badge distinct, débloqué indépendamment une fois
  // le seuil atteint — collection visuelle plutôt qu'un simple compteur (voir Objectif de la demande).
  const PROFILE_BADGES = [
    { id: 'org-1', icon: Sparkles, label: t('badge.orgFirst.label'), hint: t('badge.orgFirst.hint'), threshold: 1, counter: organizedCount },
    { id: 'org-5', icon: Award, label: t('badge.orgConfirmed.label'), hint: t('badge.orgConfirmed.hint'), threshold: 5, counter: organizedCount },
    { id: 'org-10', icon: Trophy, label: t('badge.orgPillar.label'), hint: t('badge.orgPillar.hint'), threshold: 10, counter: organizedCount },
    { id: 'part-3', icon: Flame, label: t('badge.habitue.label'), hint: t('badge.habitue.hint'), threshold: 3, counter: participatedCount },
    { id: 'part-10', icon: Medal, label: t('badge.explorer.label'), hint: t('badge.explorer.hint'), threshold: 10, counter: participatedCount },
    { id: 'arrival-3', icon: Zap, label: t('badge.onTime.label'), hint: t('badge.onTime.hint'), threshold: 3, counter: firstArrivalCount },
  ].map((b) => ({ ...b, unlocked: b.counter >= b.threshold }));

  const submitRating = (meetup) => {
    if (!ratingHostStars || !ratingSatisfactionStars) {
      showToast(t('toast.pickBothRatings'));
      return;
    }
    requireName(async (name) => {
      if (name === meetup.host) {
        showToast(t('toast.cantRateSelf'));
        setRatingMeetup(null);
        return;
      }
      if (!meetup.participants.includes(name)) {
        showToast(t('toast.onlyParticipantsCanRate'));
        setRatingMeetup(null);
        return;
      }
      const already = (meetup.ratings || []).some((r) => r.rater === name);
      if (already) {
        showToast(t('toast.alreadyRated'));
        setRatingMeetup(null);
        return;
      }
      const updated = meetups.map((m) =>
        m.id === meetup.id
          ? {
              ...m,
              ratings: [
                ...(m.ratings || []),
                {
                  rater: name,
                  hostStars: ratingHostStars,
                  satisfactionStars: ratingSatisfactionStars,
                  ratedAt: new Date().toISOString(),
                },
              ],
            }
          : m
      );
      await saveMeetups(updated);
      setRatingMeetup(null);
      setRatingHostStars(0);
      setRatingSatisfactionStars(0);
      showToast(t('toast.thanksForRating'));
    });
  };

  const startMeetup = async (meetup) => {
    const updated = meetups.map((m) =>
      m.id === meetup.id ? { ...m, started: true, startedAt: new Date().toISOString() } : m
    );
    await saveMeetups(updated);
    showToast(t('toast.meetupStarted'));
  };

  // L'organisateur répond "encore en cours" au check-in de 30 min : on repousse la question
  // d'un nouveau délai plutôt que de clôturer à sa place.
  const confirmStillOngoing = async (meetup) => {
    const updated = meetups.map((m) =>
      m.id === meetup.id
        ? { ...m, ongoingDeferredUntil: new Date(Date.now() + MEETUP_CHECKIN_DELAY_MS).toISOString() }
        : m
    );
    await saveMeetups(updated);
    setOngoingCheckMeetup(null);
    showToast(t('toast.askAgainLater'));
  };

  // Clôture réelle de la rencontre (confirmée par l'organisateur, ou automatique si le délai de
  // check-in est dépassé sans réponse) : déclenche l'invitation à noter pour les participants et
  // rend la rencontre éligible au badge mensuel (voir monthlyCount).
  const closeMeetupNow = async (meetup) => {
    const updated = meetups.map((m) =>
      m.id === meetup.id ? { ...m, closed: true, closedAt: new Date().toISOString() } : m
    );
    await saveMeetups(updated);
    setOngoingCheckMeetup(null);
    showToast(t('toast.meetupClosed'));
  };

  // Ferme la fenêtre d'avis sans noter ("Plus tard") : le bouton "Noter" reste disponible
  // manuellement, mais la fenêtre automatique ne se réaffichera plus pour cette rencontre.
  const dismissRatingPrompt = (meetupId) => {
    setRatingMeetup(null);
    setDismissedRatingIds((prev) => {
      const next = new Set(prev);
      next.add(meetupId);
      window.storage.set('rezo-rating-dismissed', JSON.stringify([...next]), false).catch(() => {});
      return next;
    });
  };

  const ARRIVAL_THRESHOLD_KM = 0.05; // 50 m

  // Enregistre l'arrivée d'un participant (pas sa position en continu) et prévient le groupe via le chat.
  const markArrival = async (meetup, name) => {
    try {
      const res = await window.storage.get('meetups-list', true).catch(() => null);
      const current = res && res.value ? JSON.parse(res.value) : meetups;
      const target = current.find((m) => m.id === meetup.id);
      if (target && target.arrivals && target.arrivals[name]) return; // déjà marqué
      const updated = current.map((m) =>
        m.id === meetup.id ? { ...m, arrivals: { ...(m.arrivals || {}), [name]: new Date().toISOString() } } : m
      );
      await saveMeetups(updated);
      try {
        const chatRes = await window.storage.get(`chat:${meetup.id}`, true).catch(() => null);
        const chatList = chatRes && chatRes.value ? JSON.parse(chatRes.value) : [];
        const systemMsg = { id: uid(), author: 'REZO', text: `📍 ${name} est arrivé·e sur place.`, sentAt: new Date().toISOString(), system: true, arrivalOf: name };
        await window.storage.set(`chat:${meetup.id}`, JSON.stringify([...(Array.isArray(chatList) ? chatList : []), systemMsg]), true);
      } catch (err) {
        // notification chat manquée, l'arrivée reste enregistrée
      }
      const others = new Set([meetup.host, ...meetup.participants].filter((p) => p !== name));
      others.forEach((p) => notifyByName(p, 'Quelqu’un est arrivé', `📍 ${name} est arrivé·e à "${meetup.title}"`, '/'));
    } catch (err) {
      showToast(t('toast.arrivalSaveFailed'));
    }
  };

  // Permet de se rétracter après une confirmation d'arrivée par erreur : retire l'entrée de "Déjà
  // sur place", le message système correspondant dans le chat, et repasse en "pas encore arrivé·e"
  // pour pouvoir relancer un trajet ou reconfirmer plus tard.
  const cancelArrival = async (meetup, name) => {
    try {
      const res = await window.storage.get('meetups-list', true).catch(() => null);
      const current = res && res.value ? JSON.parse(res.value) : meetups;
      const updated = current.map((m) => {
        if (m.id !== meetup.id) return m;
        const arrivals = { ...(m.arrivals || {}) };
        delete arrivals[name];
        return { ...m, arrivals };
      });
      await saveMeetups(updated);
      try {
        const chatRes = await window.storage.get(`chat:${meetup.id}`, true).catch(() => null);
        const chatList = chatRes && chatRes.value ? JSON.parse(chatRes.value) : [];
        const filteredChat = (Array.isArray(chatList) ? chatList : []).filter(
          (msg) => !(msg.system && msg.arrivalOf === name)
        );
        await window.storage.set(`chat:${meetup.id}`, JSON.stringify(filteredChat), true);
      } catch (err) {
        // message de chat non retiré, l'annulation de l'arrivée reste effective
      }
      showToast(t('toast.arrivalCanceled'));
    } catch (err) {
      showToast(t('toast.arrivalCancelFailed'));
    }
  };

  const stopJourney = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setJourneyActive(false);
    setJourneyDistance(null);
  };

  const startJourney = (meetup) => {
    requireName((name) => {
      if (!navigator.geolocation) {
        setJourneyError("La géolocalisation n'est pas disponible sur cet appareil.");
        return;
      }
      setJourneyError(null);
      setJourneyActive(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (!meetup.coords) return; // pas de lieu épinglé : détection auto impossible, confirmation manuelle uniquement
          const d = distanceKm(meetup.coords, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          setJourneyDistance(d);
          if (d < ARRIVAL_THRESHOLD_KM) {
            stopJourney();
            markArrival(meetup, name);
            showToast(t('toast.youArrived'));
          }
        },
        (err) => {
          setJourneyError(
            err.code === 1
              ? 'Localisation refusée. Confirme ton arrivée manuellement en bas.'
              : "Impossible de suivre ta position."
          );
          setJourneyActive(false);
        },
        { enableHighAccuracy: true, maximumAge: 8000 }
      );
    });
  };

  const confirmArrivalManually = (meetup) => {
    requireName((name) => {
      stopJourney();
      markArrival(meetup, name);
      showToast(t('toast.arrivalConfirmed'));
    });
  };

  useEffect(() => stopJourney, []);

  const deleteMeetup = async (id, scope = 'single') => {
    const target = meetups.find((m) => m.id === id);
    let updated;
    if (scope === 'series' && target && target.seriesId) {
      // Les occurrences futures non closes sont supprimées ; celles qui restent (passées/closes)
      // sont marquées seriesStopped pour empêcher toute extension automatique ultérieure de
      // resusciter une série que l'organisateur a délibérément arrêtée (voir l'effet d'extension).
      updated = meetups
        .filter((m) => !(m.seriesId === target.seriesId && !m.closed && !isPast(m)))
        .map((m) => (m.seriesId === target.seriesId ? { ...m, seriesStopped: true } : m));
    } else {
      updated = meetups.filter((m) => m.id !== id);
    }
    await saveMeetups(updated);
    setConfirmDeleteId(null);
    showToast(scope === 'series' ? t('series.stopped') : t('toast.meetupDeleted'));
    if (chatMeetup && chatMeetup.id === id) setChatMeetup(null);
  };

  // Marque une rencontre comme lue jusqu'à `count` messages (persisté par appareil) : la
  // différence avec le total sondé (chatTotalCounts) devient nulle, donc le badge disparaît.
  const markChatRead = useCallback((meetupId, count) => {
    setChatReadCounts((prev) => {
      if (prev[meetupId] === count) return prev;
      const next = { ...prev, [meetupId]: count };
      window.storage.set('rezo-chat-read-counts', JSON.stringify(next), false).catch(() => {});
      return next;
    });
    setChatTotalCounts((prev) => (prev[meetupId] === count ? prev : { ...prev, [meetupId]: count }));
  }, []);

  const loadChat = useCallback(
    async (meetupId, silent) => {
      if (!silent) setChatLoading(true);
      try {
        const res = await window.storage.get(`chat:${meetupId}`, true);
        const list = res && res.value ? JSON.parse(res.value) : [];
        const messages = Array.isArray(list) ? list : [];
        setChatMessages(messages);
        // Le chat est ouvert (loadChat n'est appelé que dans ce cas) : tout ce qui est chargé est
        // immédiatement considéré comme lu, y compris pendant le sondage toutes les 3,5s.
        markChatRead(meetupId, messages.length);
      } catch (err) {
        setChatMessages([]);
      } finally {
        if (!silent) setChatLoading(false);
      }
    },
    [markChatRead]
  );

  const openChat = (meetup) => {
    setChatMeetup(meetup);
    loadChat(meetup.id, false);
  };

  useEffect(() => {
    if (!chatMeetup) return;
    const interval = setInterval(() => {
      if (!chatSavingRef.current) loadChat(chatMeetup.id, true);
    }, 3500);
    return () => clearInterval(interval);
  }, [chatMeetup, loadChat]);

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || !chatMeetup) return;
    requireName(async (name) => {
      chatSavingRef.current = true;
      setChatSending(true);
      try {
        const freshRes = await window.storage.get(`chat:${chatMeetup.id}`, true).catch(() => null);
        const current = freshRes && freshRes.value ? JSON.parse(freshRes.value) : chatMessages;
        const newMessage = { id: uid(), author: name, text, sentAt: new Date().toISOString() };
        const updated = [...(Array.isArray(current) ? current : []), newMessage];
        const result = await window.storage.set(`chat:${chatMeetup.id}`, JSON.stringify(updated), true);
        if (!result) throw new Error('save failed');
        setChatMessages(updated);
        markChatRead(chatMeetup.id, updated.length);
        setChatInput('');
      } catch (err) {
        showToast(t('toast.chatSendFailed'));
      } finally {
        chatSavingRef.current = false;
        setChatSending(false);
      }
    });
  };

  const isPast = (m) => {
    const d = new Date(m.datetime);
    if (isNaN(d.getTime())) return false;
    return d.getTime() < Date.now() - 2 * 60 * 60 * 1000; // grâce de 2h après le début
  };

  const withDistanceRaw = meetups.map((m) => ({
    ...m,
    _distance: userCoords && m.coords ? distanceKm(userCoords, m.coords) : null,
    _bearing: userCoords && m.coords ? bearingDeg(userCoords, m.coords) : null,
  }));

  // Une série récurrente n'occupe qu'une seule carte dans le flux (la prochaine occurrence à
  // venir) — les occurrences futures déjà générées existent en base mais n'apparaissent qu'à leur
  // tour. Les occurrences passées/clôturées restent toutes visibles (historique, "Mes sorties").
  const nextOccurrenceBySeries = new Map();
  withDistanceRaw.forEach((m) => {
    if (!m.seriesId || m.closed || isPast(m)) return;
    const current = nextOccurrenceBySeries.get(m.seriesId);
    if (!current || new Date(m.datetime) < new Date(current.datetime)) nextOccurrenceBySeries.set(m.seriesId, m);
  });
  const withDistance = withDistanceRaw.filter((m) => {
    if (!m.seriesId || m.closed || isPast(m)) return true;
    return nextOccurrenceBySeries.get(m.seriesId)?.id === m.id;
  });

  const ageFilterActive = ageFilterMin > 16 || ageFilterMax < 99;
  const activeFilterCount =
    (selectedAudience !== 'all' ? 1 : 0) + (mineOnly ? 1 : 0) + (showPast ? 1 : 0) + (ageFilterActive ? 1 : 0);

  const journeyMeetup = journeyMeetupId ? meetups.find((m) => m.id === journeyMeetupId) || null : null;
  const arrivalsList = journeyMeetup
    ? Object.entries(journeyMeetup.arrivals || {})
        .map(([name, at]) => ({ name, at }))
        .sort((a, b) => new Date(a.at) - new Date(b.at))
    : [];

  const resetFilters = () => {
    setSelectedAudience('all');
    setMineOnly(false);
    setShowPast(false);
    setAgeFilterMin(16);
    setAgeFilterMax(99);
  };

  // Critères "cœur" : tout sauf la localisation (zone/rayon). Sert à distinguer un flux
  // "vraiment vide" (aucune rencontre ne correspond, période) d'un flux juste "vide ici"
  // (des rencontres existent mais ailleurs) — pour ne jamais montrer un mur sans solution.
  const matchesCore = (m) => {
    if (mineOnly) {
      // "Mes sorties" est un pur historique des rencontres terminées (voir cycle de vie
      // démarrer/clôturer) où l'utilisateur était impliqué — organisateur ou participant, sans
      // distinction — et rien d'autre : ni les filtres de recherche, ni "Voir les passées" (qui
      // ne s'applique qu'au flux "Découvrir") ne s'y mêlent.
      return !!(userName && m.closed && (m.host === userName || m.participants.includes(userName)));
    }
    const isHostOfM = userName && m.host === userName;
    if ((m.reports || []).length >= REPORT_THRESHOLD && !isHostOfM) return false;
    const matchesActivity = selectedActivity === 'all' ? true : m.activity === selectedActivity;
    if (!matchesActivity) return false;
    // Pas de catégorie choisie via l'autocomplétion : le texte tapé filtre librement sur le titre.
    if (selectedActivity === 'all' && activityQuery.trim()) {
      if (!m.title.toLowerCase().includes(activityQuery.trim().toLowerCase())) return false;
    }
    const matchesAudience = selectedAudience === 'all' ? true : (m.audience || 'mixte') === selectedAudience;
    if (!matchesAudience) return false;
    const meetupAgeMin = m.ageMin || 18;
    const meetupAgeMax = m.ageMax || 99;
    if (meetupAgeMin > ageFilterMax || meetupAgeMax < ageFilterMin) return false;
    if (!showPast && (isPast(m) || m.closed)) return false;
    return true;
  };

  const matchesLocation = (m) => {
    const matchesZoneText = zoneQuery.trim()
      ? m.zone.toLowerCase().includes(zoneQuery.trim().toLowerCase())
      : true;
    // Si on a une position réelle et un rayon actif : les rencontres géolocalisées
    // doivent être dans le rayon ; celles sans coordonnées restent filtrées par le texte de zone.
    if (userCoords && m._distance !== null) {
      return m._distance <= radiusKm && matchesZoneText;
    }
    return matchesZoneText;
  };

  // Toutes les personnes croisées par l'utilisateur (co-participants ou organisateurs de
  // rencontres passées ou en cours) — sert de base à "déjà rencontré" / "amis en commun".
  // La confiance vient de la familiarité, pas de l'anonymat.
  const knownPeople = new Set();
  if (userName) {
    meetups.forEach((m) => {
      const inThisOne = m.host === userName || m.participants.includes(userName);
      if (!inThisOne) return;
      if (m.host !== userName) knownPeople.add(m.host);
      m.participants.forEach((p) => {
        if (p !== userName) knownPeople.add(p);
      });
    });
  }

  // "Organisé par quelqu'un que tu as déjà rencontré" : un vrai lien vécu, pas une co-inscription.
  // Ne compte que les organisateurs d'une rencontre CLÔTURÉE où l'utilisateur figurait comme
  // participant accepté (jamais une rencontre à venir/en cours, ni une simple demande en attente).
  const metHosts = new Set();
  if (userName) {
    meetups.forEach((m) => {
      if (!m.closed || m.host === userName) return;
      if (m.participants.includes(userName)) metHosts.add(m.host);
    });
  }

  // "Cercle proche" : toute personne avec qui l'utilisateur a terminé au moins une rencontre
  // ensemble (côté hôte ou participant, dans les deux sens) — bâti sur l'historique réel, pas
  // un système d'ami déclaratif. Sert au tri léger du flux et à la page "Mon cercle".
  const closeCircle = new Map();
  if (userName) {
    meetups.forEach((m) => {
      if (!m.closed) return;
      const wasThere = m.host === userName || m.participants.includes(userName);
      if (!wasThere) return;
      const others = [m.host, ...m.participants].filter((p) => p && p !== userName);
      const uniqueOthers = [...new Set(others)];
      uniqueOthers.forEach((person) => {
        const entry = closeCircle.get(person) || { count: 0, lastDate: null };
        entry.count += 1;
        if (!entry.lastDate || new Date(m.datetime) > new Date(entry.lastDate)) entry.lastDate = m.datetime;
        closeCircle.set(person, entry);
      });
    });
  }

  // Priorité de tri légère (pas un filtre) : une rencontre où au moins une personne du cercle
  // proche est déjà inscrite remonte, sans jamais masquer les autres.
  const hasCircleMember = (m) => !!(userName && m.participants.some((p) => p !== userName && closeCircle.has(p)));

  // Liste pour la page "Mon cercle" : les personnes les plus rencontrées d'abord.
  const circleList = [...closeCircle.entries()]
    .map(([name, info]) => ({ name, count: info.count, lastDate: info.lastDate }))
    .sort((a, b) => b.count - a.count || new Date(b.lastDate) - new Date(a.lastDate));

  const byDistanceThenDate = (x, y) => {
    const xBoost = hasCircleMember(x) ? 0 : 1;
    const yBoost = hasCircleMember(y) ? 0 : 1;
    if (xBoost !== yBoost) return xBoost - yBoost;
    if (x._distance !== null && y._distance !== null) return x._distance - y._distance;
    if (x._distance !== null) return -1;
    if (y._distance !== null) return 1;
    return new Date(x.datetime) - new Date(y.datetime);
  };

  const coreFiltered = withDistance.filter(matchesCore);
  // "Mes sorties" ignore aussi la recherche de zone : c'est un historique, pas une recherche.
  const filtered = mineOnly ? coreFiltered : coreFiltered.filter(matchesLocation);

  const locationFilterActive = !!zoneQuery.trim() || (!!userCoords && radiusKm < 30);
  // "Ville fantôme" : rien ici, mais des rencontres existent ailleurs -> ne jamais montrer un
  // mur, proposer les plus proches (ou les plus proches dans le temps si pas de position).
  const nearbyFallback =
    filtered.length === 0 && locationFilterActive
      ? [...coreFiltered].sort(byDistanceThenDate).slice(0, 6)
      : [];

  const grouped = ACTIVITIES.map((a) => ({
    ...a,
    items: filtered.filter((m) => m.activity === a.id).sort(byDistanceThenDate),
  })).filter((g) => g.items.length > 0);

  // Tri "près de moi" (voir activateNearMe) : la ville déclarée reste la source de vérité — le GPS,
  // quand disponible, n'affine que l'ordre à l'intérieur de ce groupe (byDistanceThenDate s'appuie
  // sur _distance, calculée seulement si userCoords est renseigné). Aucun filtrage : ce groupe
  // s'ajoute au flux normal ci-dessous, qui reste intact et complet.
  const nearCityMeetups =
    nearMeActive && userCity && !mineOnly
      ? filtered.filter((m) => m.zone && m.zone.toLowerCase().includes(userCity.trim().toLowerCase())).sort(byDistanceThenDate)
      : [];

  const recommended = userPreferences.length
    ? withDistance
        .filter((m) => userPreferences.includes(m.activity) && !isPast(m) && m.host !== userName)
        .sort((x, y) => {
          if (x._distance !== null && y._distance !== null) return x._distance - y._distance;
          return new Date(x.datetime) - new Date(y.datetime);
        })
        .slice(0, 6)
    : [];

  // "De tes abonnements" : rencontres à venir des organisateurs suivis, distinct de "Recommandé
  // pour toi" (basé sur les activités préférées, pas les abonnements).
  const followedOrganizers = userName ? follows[userName] || [] : [];
  const fromFollowed = followedOrganizers.length
    ? withDistance
        .filter((m) => followedOrganizers.includes(m.host) && !isPast(m) && !m.closed)
        .sort(byDistanceThenDate)
        .slice(0, 6)
    : [];

  // Suggestions d'autocomplétion de la barre "Rechercher une activité" — sur le nom des
  // catégories, remplace la rangée d'icônes retirée de cet écran.
  const activitySuggestions = activityQuery.trim()
    ? ACTIVITIES.filter((a) => aLabel(a.id).toLowerCase().includes(activityQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  // Rendu d'une carte de rencontre, partagé entre la liste normale (groupée par activité)
  // et la liste de repli "à proximité" (quand le flux local est vide).
  const renderMeetupCard = (m) => {
    const isIn = userName && m.participants.includes(userName);
    const isPending = userName && (m.pendingRequests || []).some((r) => r.name === userName);
    const audience = m.audience || 'mixte';
    const genderBlocked =
      !isIn &&
      !isPending &&
      userGender &&
      ((audience === 'femmes' && userGender !== 'femme') ||
        (audience === 'hommes' && userGender !== 'homme'));
    const isFull = m.participants.length >= m.maxParticipants && !isIn;
    const isHost = userName && m.host === userName;
    // Rencontre "Équipe REZO" (pas de vrai hôte connectable) : une fois complète, n'importe quel
    // participant peut la démarrer plutôt que d'attendre un hôte qui ne se connectera jamais.
    const canStartAsRezoParticipant =
      !isHost && m.host === REZO_HOST_NAME && isIn && m.participants.length >= m.maxParticipants;
    // Le bouton "Démarrer" n'apparaît qu'à l'heure prévue, jamais avant (voir hint passif ci-dessous).
    const hasReachedStart = new Date(m.datetime).getTime() <= now;
    const hostVerified = !!verifiedMap[m.host];
    // Inutile de signaler "déjà rencontré"/"amis en commun" pour une rencontre qu'on a déjà
    // rejointe (forcément vrai puisqu'on y est) — seulement utile pour décider de rejoindre.
    const alreadyMetHost = !isHost && !isIn && metHosts.has(m.host);
    const mutualCount = !isHost && !isIn && !alreadyMetHost
      ? m.participants.filter((p) => p !== userName && knownPeople.has(p)).length
      : 0;
    // Mention "Avec Sarah, que tu as déjà rencontrée" — priorité à un participant du cercle
    // proche (lien vécu), jamais l'hôte lui-même s'il est déjà signalé via alreadyMetHost.
    const circleMemberInMeetup = !isIn
      ? m.participants.find((p) => p !== userName && closeCircle.has(p))
      : null;
    // Une rencontre clôturée est traitée comme passée partout (badge "Terminée", fin du join,
    // masquage du badge "En cours"...) même si le délai de grâce de 2h n'est pas encore écoulé.
    const past = isPast(m) || m.closed;
    const pendingRequests = m.pendingRequests || [];
    const hostStats = hostRatingStats(m.host);
    const satisfactionStats = meetupSatisfactionStats(m);
    const alreadyRated = userName && (m.ratings || []).some((r) => r.rater === userName);
    const canRate = isIn && !isHost && !alreadyRated && isRatingDue(m, now);
    const unreadChatCount = Math.max(0, (chatTotalCounts[m.id] || 0) - (chatReadCounts[m.id] || 0));
    const activityInfo = activityById(m.activity);
    const ActivityIcon = ACTIVITY_ICONS[m.activity] || Sparkles;
    return (
      <div className={`card ${past ? 'card-past' : ''}`} key={m.id}>
        <div
          className="card-banner"
          style={{ background: `linear-gradient(135deg, ${activityInfo.color}, ${shadeColor(activityInfo.color, -30)})` }}
        >
          <ActivityIcon size={44} className="card-banner-icon" />
          <span className="card-banner-label">{aLabel(m.activity)}</span>
        </div>
        <div className="card-body">
        <div className="card-top">
          <div className="card-top-left">
            <div className="card-title">{m.title}</div>
            {hostStats && (
              <span className="card-rating-pill" title={`${hostStats.avg.toFixed(1)}/5 (${hostStats.count} avis)`}>
                <Star size={11} fill="var(--amber)" color="var(--amber)" />
                {hostStats.avg.toFixed(1)}
              </span>
            )}
          </div>
          {isHost && (
            <div className="card-actions">
              <button
                className="delete-btn"
                title={t('card.edit')}
                onClick={() => {
                  setEditingMeetup(m);
                  setShowCreate(true);
                }}
              >
                <Pencil size={13} />
              </button>
              <button className="delete-btn" title={t('modal.delete.confirm')} onClick={() => setConfirmDeleteId(m.id)}>
                <X size={13} />
              </button>
            </div>
          )}
        </div>
        {audience !== 'mixte' && (
          <span className={`audience-badge audience-${audience}`}>
            {audience === 'femmes' ? t('audience.femmes') : t('audience.hommes')}
          </span>
        )}
        {m.seriesId && SERIES_LABEL_KEY[m.seriesFrequency] && (
          <span className="series-badge">
            🔁 {t(SERIES_LABEL_KEY[m.seriesFrequency])}
          </span>
        )}
        {m.started && !past && (
          <span className="live-badge">
            <span className="pulse"></span> {t('card.live')}
          </span>
        )}
        <div className="card-meta">
          <div className="card-meta-row">
            <MapPin size={12} /> {m.location ? `${m.location} · ${m.zone || ''}` : m.zone || t('card.zoneUnspecified')}
            {m._distance !== null && <span style={{ color: 'var(--live)' }}> · {formatDistance(m._distance)}</span>}
          </div>
          {mapsLinkFor(m) && (
            <a
              className="maps-link"
              href={mapsLinkFor(m)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} /> {t('card.viewOnMap')}
            </a>
          )}
          <div className="card-meta-row"><Clock size={12} /> {formatWhen(m.datetime, language)}{past && ` · ${t('card.ended')}`}</div>
          <div className="card-meta-row"><Cake size={12} /> {formatAgeRange(m.ageMin, m.ageMax, t)}</div>
          <div className="card-meta-row">
            {interpolateNodes(t('card.organizedBy', { host: '{host}' }), {
              host: isHost ? (
                m.host
              ) : (
                <button
                  type="button"
                  className="card-host-link"
                  onClick={(e) => { e.stopPropagation(); setViewedProfileName(m.host); setShowProfilePage(true); }}
                >
                  {m.host}
                </button>
              ),
            })}
            {publicLastNames[m.host] ? ` ${publicLastNames[m.host]}` : ''}
            {publicCities[m.host] ? ` · ${publicCities[m.host]}` : ''}{isHost ? t('card.you') : ''}
            {hostVerified && (
              <span className="card-verified-badge" title={t('card.verified')}>
                <ShieldCheck size={12} /> {t('card.verified')}
              </span>
            )}
            {hostStats && <StarDisplay value={hostStats.avg} count={hostStats.count} size={11} />}
          </div>
          {circleMemberInMeetup && (
            <div className="card-meta-row card-circle-mention">
              <Users size={12} /> {t('card.withCircleMember', { name: circleMemberInMeetup })}
            </div>
          )}
          {satisfactionStats && (
            <div className="card-meta-row">
              {t('card.satisfaction')} <StarDisplay value={satisfactionStats.avg} count={satisfactionStats.count} size={11} />
            </div>
          )}
        </div>
        {(alreadyMetHost || mutualCount > 0) && (
          <div className="trust-row">
            <Users size={12} />
            {alreadyMetHost
              ? t('card.alreadyMet')
              : t(mutualCount > 1 ? 'card.mutualFriendsPlural' : 'card.mutualFriends', { count: mutualCount })}
          </div>
        )}
        {m.note && <div className="card-note">{m.note}</div>}
        <div className="avatars">
          {m.participants.slice(0, 6).map((p) => (
            <Avatar key={p} name={p} avatarUrl={profilesMap[p]} size={22} />
          ))}
          {m.participants.length > 6 && <span className="avatar more">+{m.participants.length - 6}</span>}
        </div>

        {isHost && pendingRequests.length > 0 && (
          <div className="pending-box">
            <div className="pending-title">
              {t(pendingRequests.length > 1 ? 'card.pendingRequestsPlural' : 'card.pendingRequests', { count: pendingRequests.length })}
            </div>
            {pendingRequests.map((r) => (
              <div className="pending-row" key={r.name}>
                <span>
                  {r.name}
                  {r.invitedBy && <span className="pending-invited-by">{t('card.invitedBy', { name: r.invitedBy })}</span>}
                </span>
                <div className="pending-actions">
                  <button
                    className="pending-accept"
                    title={t('card.accept')}
                    onClick={() => respondToRequest(m, r.name, true)}
                  >
                    <Check size={13} />
                  </button>
                  <button
                    className="pending-reject"
                    title={t('card.reject')}
                    onClick={() => respondToRequest(m, r.name, false)}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card-footer">
          <div className="card-count">
            <Users size={12} /> {m.participants.length}/{m.maxParticipants}
          </div>
          <div className="footer-actions">
            {!isHost && (
              <button
                className="chat-icon-btn"
                title={t('card.reportMeetup')}
                onClick={() => setReportingMeetup(m)}
              >
                <Flag size={13} />
              </button>
            )}
            <button
              className="chat-icon-btn"
              disabled={!isIn && !isHost}
              title={isIn || isHost ? t('card.groupChat') : t('card.membersOnly')}
              onClick={() => openChat(m)}
            >
              <MessageCircle size={14} />
              {unreadChatCount > 0 && (
                <span className="chat-unread-badge">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>
              )}
            </button>
            {(isIn || isHost) && (
              <button
                className="chat-icon-btn"
                title={t('card.inviteFriends')}
                onClick={() => {
                  setInvitingMeetup(m);
                  setInviteNameDraft('');
                }}
              >
                <UserPlus size={14} />
              </button>
            )}
            {(isHost || canStartAsRezoParticipant) && !m.started && !past && (
              hasReachedStart ? (
                <button className="rate-btn" title={t('card.start')} onClick={() => startMeetup(m)}>
                  <Radio size={13} />
                  {t('card.start')}
                </button>
              ) : (
                <span className="start-hint" title={t('card.startHint')}>
                  <Clock size={12} />
                  {t('card.startsAt', { time: new Date(m.datetime).toLocaleTimeString(WHEN_LOCALES[language] || 'fr-FR', { hour: '2-digit', minute: '2-digit' }) })}
                </span>
              )
            )}
            {m.started && (isIn || isHost) && (
              <button
                className="chat-icon-btn live-btn"
                title={t('card.journeyTitle')}
                onClick={() => {
                  setJourneyMeetupId(m.id);
                  setJourneyError(null);
                }}
              >
                <Navigation size={14} />
                {Object.keys(m.arrivals || {}).length > 0 && (
                  <span className="arrivals-count">{Object.keys(m.arrivals || {}).length}</span>
                )}
              </button>
            )}
            {canRate && (
              <button
                className="rate-btn"
                onClick={() => {
                  setRatingMeetup(m);
                  setRatingHostStars(0);
                  setRatingSatisfactionStars(0);
                }}
              >
                <Star size={13} />
                {t('card.rate')}
              </button>
            )}
            {/* L'organisateur ne "quitte" pas sa propre rencontre : modifier/supprimer suffisent
                avant le démarrage, et une fois démarrée il la termine plutôt (voir ci-dessous). */}
            {isHost && m.started && !m.closed && !past && (
              <button
                className="join-btn leave"
                title={t('card.endMeetupHint')}
                onClick={() => setOngoingCheckMeetup(m)}
              >
                {t('card.endMeetup')}
              </button>
            )}
            {!isHost && (
              <button
                className={`join-btn ${
                  isFull || genderBlocked ? 'full' : isIn ? 'leave' : isPending ? 'pending' : 'join'
                }`}
                disabled={isFull || genderBlocked}
                title={genderBlocked ? (audience === 'femmes' ? t('card.reservedWomen') : t('card.reservedMen')) : undefined}
                onClick={() => requestOrLeave(m)}
              >
                {isIn
                  ? t('card.leave')
                  : isPending
                  ? t('card.cancelRequest')
                  : isFull
                  ? t('card.full')
                  : genderBlocked
                  ? t('card.notEligible')
                  : t('card.join')}
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rezo-app" dir={dir}>
      <style>{`
        .rezo-app {
          --ink: #F0F2F5;
          --card: #FFFFFF;
          --card-hover: #F7F8FA;
          --border: #DADDE1;
          --border-strong: #C6C9CC;
          --text: #1C1E21;
          --muted: #65676B;
          --live: #1877F2;
          --live-rgb: 24,119,242;
          --online: #31A24C;
          --online-rgb: 49,162,76;
          --amber: #F2A65A;
          --danger: #FA383E;
          --nav-h: 64px;
          --cta-grad: linear-gradient(135deg, #1877F2, #145DBF);
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          background: var(--ink);
          color: var(--text);
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        .rezo-display { font-family: 'Space Grotesk', 'Inter', sans-serif; }

        .splash-screen {
          position: absolute; inset: 0; z-index: 50;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
          background: var(--card);
          transition: opacity 0.4s ease;
        }
        .splash-screen.hide { opacity: 0; pointer-events: none; }
        .splash-badge {
          position: relative;
          width: 84px; height: 84px; border-radius: 26px;
          background: var(--cta-grad);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 14px 30px rgba(24,119,242,0.35);
          animation: splash-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .splash-badge-letter {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 40px; color: #fff;
        }
        .splash-badge-dot {
          position: absolute; top: 13px; right: 13px;
          width: 12px; height: 12px; border-radius: 50%;
          background: var(--online);
          border: 2px solid #fff;
          box-shadow: 0 0 0 0 rgba(var(--online-rgb),0.7);
          animation: pulse-online 1.8s infinite 0.7s;
        }
        @keyframes pulse-online {
          0% { box-shadow: 0 0 0 0 rgba(var(--online-rgb),0.55); }
          70% { box-shadow: 0 0 0 8px rgba(var(--online-rgb),0); }
          100% { box-shadow: 0 0 0 0 rgba(var(--online-rgb),0); }
        }
        @keyframes splash-pop {
          0% { transform: scale(0.55); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .splash-tagline {
          font-size: 12.5px; color: var(--muted);
          opacity: 0; animation: splash-fade-up 0.6s ease 0.35s forwards;
        }
        .splash-loader { display: flex; gap: 5px; margin-top: 4px; opacity: 0; animation: splash-fade-up 0.6s ease 0.5s forwards; }
        .splash-loader span {
          width: 6px; height: 6px; border-radius: 50%; background: var(--border-strong);
          animation: splash-bounce 1s ease-in-out infinite;
        }
        .splash-loader span:nth-child(1) { animation-delay: 0s; }
        .splash-loader span:nth-child(2) { animation-delay: 0.15s; }
        .splash-loader span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes splash-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-bounce {
          0%, 80%, 100% { background: var(--border-strong); transform: scale(1); }
          40% { background: var(--live); transform: scale(1.3); }
        }

        .rezo-header {
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: calc(18px + env(safe-area-inset-top)) 24px 16px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
          background: var(--ink);
          position: relative;
          z-index: 1;
        }
        .rezo-brand {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: 0.01em;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .rezo-brand span.dot { color: var(--live); }
        .rezo-tagline { color: var(--muted); font-size: 12.5px; margin-top: 2px; }

        .rezo-live {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--online);
        }
        .rezo-live .pulse {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--online);
          box-shadow: 0 0 0 0 rgba(var(--online-rgb),0.7);
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(var(--online-rgb),0.55); }
          70% { box-shadow: 0 0 0 8px rgba(var(--online-rgb),0); }
          100% { box-shadow: 0 0 0 0 rgba(var(--online-rgb),0); }
        }

        .rezo-controls {
          display: flex; flex-direction: column; gap: 10px; padding: 14px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--ink);
          position: relative;
          z-index: 1;
        }
        .rezo-search-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .rezo-zone-input {
          display: flex; align-items: center; gap: 8px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 12px;
          flex: 1 1 150px;
          min-width: 0;
          position: relative;
        }
        .rezo-zone-input input {
          background: transparent; border: none; outline: none;
          color: var(--text); font-size: 13.5px; width: 100%; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-family: 'Inter', sans-serif;
        }
        .rezo-zone-input input::placeholder { color: var(--muted); }

        .activity-suggest-list {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 5;
          background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden;
        }
        .activity-suggest-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          background: none; border: none; text-align: left; cursor: pointer;
          padding: 9px 12px; font-size: 13px; color: var(--text); font-family: 'Inter', sans-serif;
        }
        .activity-suggest-item:hover { background: var(--card-hover); }
        .activity-suggest-icon {
          width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }

        .geo-suggest-wrap { position: relative; }
        .geo-suggest-list {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 6;
          background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.14); overflow: hidden; max-height: 260px; overflow-y: auto;
        }
        .geo-suggest-item {
          display: flex; align-items: flex-start; gap: 8px; width: 100%;
          background: none; border: none; border-bottom: 1px solid var(--border);
          text-align: start; cursor: pointer; padding: 9px 12px; font-family: 'Inter', sans-serif;
        }
        .geo-suggest-item:last-of-type { border-bottom: none; }
        .geo-suggest-item:hover { background: var(--card-hover); }
        .geo-suggest-pin { flex-shrink: 0; margin-top: 2px; color: var(--live); }
        .geo-suggest-primary { display: block; font-size: 13px; color: var(--text); font-weight: 600; }
        .geo-suggest-secondary { display: block; font-size: 11.5px; color: var(--muted); margin-top: 1px; }
        .geo-suggest-loading { padding: 10px 12px; font-size: 12px; color: var(--muted); }
        .geo-suggest-attribution { padding: 6px 12px; font-size: 10px; color: var(--muted); border-top: 1px solid var(--border); }
        .geo-suggest-confirmed {
          display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;
          font-size: 11px; color: var(--online); font-weight: 600;
        }

        .geo-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          background: var(--card); border: 1px solid var(--border);
          color: var(--text); border-radius: 10px; padding: 10px 13px;
          font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer;
        }
        .geo-btn:hover { border-color: var(--live); }
        .geo-btn:disabled { opacity: 0.7; cursor: default; }
        .geo-btn.full { width: 100%; }
        .geo-btn.active { background: rgba(var(--online-rgb),0.12); border-color: var(--online); color: var(--online); }

        .toggle-btn {
          background: var(--card); border: 1px solid var(--border);
          color: var(--muted); border-radius: 10px; padding: 8px 13px;
          font-size: 12.5px; font-family: 'Inter', sans-serif; cursor: pointer;
        }
        .toggle-btn:hover { border-color: var(--border-strong); }
        .toggle-btn.active { background: var(--text); color: var(--ink); border-color: var(--text); font-weight: 600; }

        .filters-panel {
          margin: 8px 24px 4px; padding: 14px; background: var(--card);
          border: 1px solid var(--border); border-radius: 12px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .filters-row { display: flex; flex-direction: column; gap: 8px; }
        .filters-row-label { font-size: 11px; font-weight: 600; color: var(--muted); }
        .rezo-chips-inline { display: flex; gap: 8px; flex-wrap: wrap; }
        .filters-row-toggles { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px; }
        .filters-reset {
          background: none; border: none; color: var(--amber); font-size: 12px;
          cursor: pointer; text-decoration: underline; font-family: 'Inter', sans-serif;
        }

        /* Bottom sheet façon Tinder pour les filtres avancés */
        .sheet-overlay {
          position: absolute; inset: 0; background: rgba(8,9,13,0.72);
          display: flex; align-items: flex-end; justify-content: center; z-index: 25;
        }
        .sheet {
          width: 100%; background: var(--card); border-top: 1px solid var(--border);
          border-radius: 20px 20px 0 0; padding: 10px 22px calc(20px + env(safe-area-inset-bottom)); max-height: 85%;
          overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
          box-shadow: 0 -8px 30px rgba(0,0,0,0.12);
          animation: sheet-in 0.2s ease;
        }
        @keyframes sheet-in {
          from { transform: translateY(24px); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        .sheet-handle { width: 36px; height: 4px; border-radius: 999px; background: var(--border); margin: 0 auto 4px; }
        .sheet-header { display: flex; justify-content: space-between; align-items: center; }
        .sheet-section { display: flex; flex-direction: column; gap: 10px; }
        .sheet-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; }
        .sheet-apply { width: auto; flex: 1; margin-top: 0; }

        .segmented {
          display: flex; background: var(--ink); border: 1px solid var(--border);
          border-radius: 10px; padding: 3px; gap: 2px;
        }
        .segmented-item {
          flex: 1; background: none; border: none; color: var(--muted);
          font-size: 12.5px; font-family: 'Inter', sans-serif; padding: 8px 6px;
          border-radius: 8px; cursor: pointer;
        }
        .segmented-item.active { background: var(--live); color: #fff; font-weight: 600; }

        .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .push-toggle-row {
          background: var(--ink); border: 1px solid var(--border); border-radius: 10px;
          padding: 10px 12px; margin-bottom: 14px;
        }
        .streak-card {
          display: flex; align-items: center; gap: 10px;
          background: rgba(242,166,90,0.1); border: 1px solid rgba(242,166,90,0.3);
          border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; color: var(--amber);
        }
        .streak-card.unlocked { background: rgba(242,166,90,0.16); border-color: var(--amber); }
        .streak-card-title { font-size: 13px; font-weight: 700; color: var(--text); }
        .streak-card-subtitle { font-size: 11px; color: var(--muted); margin-top: 1px; }
        .switch-title { font-size: 13.5px; font-weight: 600; }
        .switch-subtitle { font-size: 11px; color: var(--muted); margin-top: 1px; }
        .switch {
          flex-shrink: 0; width: 42px; height: 24px; border-radius: 999px;
          background: var(--border); border: none; cursor: pointer; position: relative;
          transition: background 0.15s ease;
        }
        .switch.on { background: var(--live); }
        .switch-knob {
          position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
          background: var(--text); transition: transform 0.15s ease;
        }
        .switch.on .switch-knob { transform: translateX(18px); }

        .radius-control {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--muted);
        }
        .radius-control input[type="range"] {
          width: 110px; accent-color: var(--live);
        }

        .geo-error {
          padding: 0 24px 10px; color: var(--amber); font-size: 12px;
        }
        .manual-geo {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          margin-top: 8px; color: var(--muted);
        }
        .manual-sep { font-size: 11px; }
        .preset-btn {
          background: var(--card); border: 1px solid var(--border); color: var(--text);
          border-radius: 7px; padding: 5px 10px; font-size: 11.5px; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .preset-btn:hover { border-color: var(--live); }
        .manual-input {
          width: 70px; background: var(--card); border: 1px solid var(--border);
          border-radius: 7px; padding: 5px 8px; font-size: 11.5px; color: var(--text);
          font-family: 'Inter', sans-serif; outline: none;
        }
        .manual-input:focus { border-color: var(--live); }

        .rezo-chips {
          display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 24px 4px;
        }
        .rezo-chips-secondary { padding-top: 4px; align-items: center; }
        .chips-label { font-size: 12px; color: var(--muted); margin-right: 2px; }
        .chip {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12.5px;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex; align-items: center; gap: 6px;
        }
        .chip:hover { border-color: var(--border-strong); }
        .chip.active { background: var(--text); color: var(--ink); border-color: var(--text); font-weight: 600; }
        .chip .swatch { width: 7px; height: 7px; border-radius: 50%; }

        .rezo-scroll {
          flex: 1 1 auto;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
        }
        .rezo-body { padding: 8px 24px calc(24px + var(--nav-h) + env(safe-area-inset-bottom)); }

        .recommended-wrap { padding: 14px 24px 4px; }
        .recommended-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600;
          margin-bottom: 10px; color: var(--amber);
        }
        .recommended-scroll {
          display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
        }
        .recommended-scroll::-webkit-scrollbar { display: none; }
        .recommended-card {
          flex: 0 0 auto; width: 180px; text-align: left; cursor: pointer;
          background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          padding: 12px; display: flex; flex-direction: column; gap: 5px;
          font-family: 'Inter', sans-serif;
        }
        .recommended-card:hover { border-color: var(--amber); }
        .recommended-card .swatch { width: 8px; height: 8px; border-radius: 50%; }
        .recommended-card-title { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.3; }
        .recommended-card-meta { font-size: 11px; color: var(--muted); }
        .near-city-wrap .recommended-title { color: var(--live); }
        .near-city-grid { margin-top: 2px; }
        .near-city-empty {
          font-size: 12.5px; color: var(--muted); background: var(--ink);
          border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;
        }
        .rezo-section { margin-top: 24px; }
        .rezo-section-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
          display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .rezo-section-title .swatch { width: 9px; height: 9px; border-radius: 50%; }

        .rezo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .card:hover { border-color: var(--border-strong); background: var(--card-hover); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
        .card-banner {
          position: relative;
          height: 92px;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column; gap: 4px;
          overflow: hidden;
        }
        .card-banner-icon { color: rgba(255,255,255,0.55); }
        .card-banner-label {
          font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 11px;
          letter-spacing: 0.04em; text-transform: uppercase; color: rgba(255,255,255,0.85);
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .card-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .card-title { font-weight: 600; font-size: 14.5px; line-height: 1.3; }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .card-top-left { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
        .card-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .delete-btn {
          background: none; border: none; color: var(--muted); cursor: pointer;
          padding: 2px; border-radius: 6px; flex-shrink: 0;
        }
        .delete-btn:hover { color: var(--amber); background: rgba(242,166,90,0.1); }
        .card-past { opacity: 0.55; }
        .audience-badge {
          align-self: flex-start;
          font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
        }
        .audience-badge.audience-femmes { background: rgba(239,122,155,0.16); color: #EF7A9B; }
        .audience-badge.audience-hommes { background: rgba(79,209,197,0.16); color: #4FD1C5; }
        .series-badge {
          align-self: flex-start;
          font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
          background: rgba(124,131,253,0.16); color: #8B93FF;
        }
        .live-badge {
          align-self: flex-start; display: flex; align-items: center; gap: 5px;
          font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
          background: rgba(var(--online-rgb),0.14); color: var(--online);
        }
        .live-badge .pulse {
          width: 6px; height: 6px; border-radius: 50%; background: var(--online);
          box-shadow: 0 0 0 0 rgba(var(--online-rgb),0.7); animation: pulse 1.8s infinite;
        }
        .live-btn { border-color: var(--live); color: var(--live); }
        .avatars { display: flex; gap: -4px; }
        .avatars > *:not(:first-child) { margin-left: -6px; }
        .avatar {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--live); color: #fff; font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--card);
        }
        .avatar.more { background: var(--border); color: var(--muted); }
        .card-meta { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--muted); }
        .card-meta-row { display: flex; align-items: center; gap: 6px; }
        .card-host-link {
          background: none; border: none; padding: 0; margin: 0; cursor: pointer;
          color: var(--text); font-weight: 600; font-size: inherit; font-family: inherit;
        }
        .card-host-link:hover { text-decoration: underline; }
        .card-circle-mention { color: var(--live); font-weight: 500; }
        .maps-link {
          display: inline-flex; align-items: center; gap: 4px; width: fit-content;
          font-size: 11px; color: var(--live); text-decoration: none;
        }
        .maps-link:hover { text-decoration: underline; }
        .card-note { font-size: 12px; color: var(--muted); line-height: 1.4; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
        .card-count { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 4px; }
        .join-btn {
          border: none; border-radius: 8px; padding: 6px 13px;
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .join-btn.join { background: var(--live); color: #fff; }
        .join-btn.leave { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .join-btn.full { background: var(--border); color: var(--muted); cursor: not-allowed; }
        .join-btn.pending { background: transparent; border: 1px solid var(--amber); color: var(--amber); }

        .pending-box {
          background: rgba(242,166,90,0.08); border: 1px solid rgba(242,166,90,0.3);
          border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;
        }
        .pending-title { font-size: 11px; font-weight: 600; color: var(--amber); }
        .pending-row { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; }
        .pending-invited-by { color: var(--muted); font-size: 10.5px; }
        .pending-actions { display: flex; gap: 4px; }
        .pending-accept, .pending-reject {
          border: none; border-radius: 6px; width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .pending-accept { background: var(--live); color: #fff; }
        .pending-reject { background: var(--border); color: var(--text); }

        .footer-actions { display: flex; align-items: center; gap: 6px; }
        .chat-icon-btn {
          position: relative;
          background: var(--ink); border: 1px solid var(--border); color: var(--muted);
          border-radius: 8px; padding: 6px 8px; cursor: pointer; display: flex; align-items: center;
        }
        .chat-icon-btn:hover:not(:disabled) { border-color: var(--live); color: var(--live); }
        .chat-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .chat-unread-badge {
          position: absolute; top: -6px; right: -6px; min-width: 16px; height: 16px;
          padding: 0 4px; border-radius: 999px; background: var(--danger); color: #fff;
          font-size: 10px; font-weight: 700; line-height: 16px; text-align: center;
          box-shadow: 0 0 0 2px var(--card);
        }
        .arrivals-count {
          margin-left: 4px; background: rgba(127,207,158,0.2); color: #7FCF9E;
          font-size: 10px; font-weight: 700; border-radius: 999px; padding: 1px 5px;
        }

        .rate-btn {
          display: flex; align-items: center; gap: 5px;
          background: rgba(242,166,90,0.12); border: 1px solid var(--amber); color: var(--amber);
          border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;
          font-family: 'Inter', sans-serif; font-weight: 600;
        }
        .rate-btn:hover { background: rgba(242,166,90,0.22); }

        .start-hint {
          display: flex; align-items: center; gap: 5px;
          color: var(--muted); font-size: 11.5px; font-weight: 600;
          font-family: 'Inter', sans-serif; padding: 6px 2px;
        }

        .star-display { display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; }
        .star-display-value { font-size: 11px; color: var(--text); font-weight: 600; }
        .star-display-count { font-size: 10.5px; color: var(--muted); }

        .star-picker { display: flex; gap: 4px; justify-content: center; }
        .star-picker-btn { background: none; border: none; cursor: pointer; padding: 2px; }

        .rezo-empty {
          text-align: center; padding: 60px 20px 24px; color: var(--muted);
        }
        .rezo-empty-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--text); margin-bottom: 6px; }

        .quick-templates {
          display: flex; flex-direction: column; gap: 8px;
          max-width: 280px; margin: 18px auto 0;
        }
        .quick-template-card {
          display: flex; align-items: center; gap: 10px;
          background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          padding: 12px 14px; cursor: pointer; text-align: left;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .quick-template-card:hover { border-color: var(--live); background: var(--card-hover); }
        .quick-template-emoji { font-size: 20px; flex-shrink: 0; }
        .quick-template-label { font-size: 13.5px; font-weight: 600; color: var(--text); font-family: 'Inter', sans-serif; }

        .rezo-fallback-banner {
          display: flex; align-items: center; gap: 8px;
          background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          padding: 10px 14px; margin-bottom: 14px; font-size: 12.5px; color: var(--muted);
        }
        .rezo-fallback-banner svg { flex-shrink: 0; color: var(--live); }

        .bottom-nav {
          flex-shrink: 0;
          position: relative;
          z-index: 12;
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 2px;
          height: var(--nav-h);
          padding: 4px 6px calc(4px + env(safe-area-inset-bottom));
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-top: 1px solid var(--border);
        }
        .bottom-nav-item {
          flex: 1;
          min-width: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
          background: none; border: none; color: var(--muted);
          font-size: 10px; font-family: 'Inter', sans-serif; cursor: pointer;
          padding: 6px 2px; border-radius: 10px; position: relative;
          transition: color 0.15s ease, transform 0.1s ease;
        }
        .bottom-nav-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .bottom-nav-item:active { transform: scale(0.92); }
        .bottom-nav-item.active { color: var(--live); }
        .bottom-nav-badge {
          position: absolute; top: 0px; left: 50%; transform: translateX(6px);
          background: var(--amber); color: #14161C; font-size: 9px; font-weight: 700;
          border-radius: 999px; min-width: 14px; height: 14px; display: flex;
          align-items: center; justify-content: center; padding: 0 3px;
        }
        .bottom-nav-center {
          flex-shrink: 0;
          width: 54px; height: 54px; border-radius: 50%;
          background: var(--cta-grad);
          color: #fff; border: 4px solid var(--ink);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; margin-top: -30px;
          box-shadow: 0 8px 20px rgba(var(--live-rgb),0.4);
          transition: transform 0.12s ease;
        }
        .bottom-nav-center:active { transform: scale(0.9); }

        .modal-overlay {
          position: absolute; inset: 0; background: rgba(8,9,13,0.72);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 20;
        }
        .modal {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 18px; padding: 22px; width: 100%; max-width: 380px;
          max-height: 90%; overflow-y: auto;
          box-shadow: 0 16px 40px rgba(0,0,0,0.16);
          animation: modal-in 0.18s ease;
        }
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .modal-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 600; }
        .modal-close { background: none; border: none; color: var(--muted); cursor: pointer; }

        /* Modale de profil façon Facebook : bannière de couverture + photo circulaire superposée */
        .profile-modal { padding: 0; }
        .profile-modal-close {
          position: absolute; top: 10px; right: 10px; z-index: 2;
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(0,0,0,0.35); color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .profile-cover {
          height: 84px; border-radius: 18px 18px 0 0;
          background: var(--cta-grad);
          background-size: cover; background-position: center;
        }
        .profile-cover-editable { position: relative; }
        .cover-edit-btn {
          position: absolute; bottom: 8px; right: 10px;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.45); color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .cover-edit-btn:hover { background: rgba(0,0,0,0.6); }
        .cover-remove-btn {
          position: absolute; top: 8px; right: 10px;
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(0,0,0,0.45); color: #fff; border: none;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .profile-avatar-wrap {
          position: relative; width: fit-content; margin: -44px auto 0;
          display: flex; justify-content: center;
        }
        .profile-avatar-wrap .avatar,
        .profile-avatar-wrap img {
          border: 4px solid var(--card) !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .profile-avatar-edit-btn {
          position: absolute; bottom: 2px; right: 2px;
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--card); border: 2px solid var(--card);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text);
        }
        .profile-avatar-edit-btn:hover { background: var(--card-hover); }
        .profile-avatar-remove {
          display: block; margin: 8px auto 0; text-align: center;
        }
        .profile-modal-body { padding: 14px 22px 22px; overflow-y: auto; }

        /* Vraie page de profil (pas une modale) : occupe tout l'espace au-dessus de la nav du bas,
           façon écran d'identité sociale plutôt que formulaire. */
        .profile-page {
          position: absolute; top: 0; left: 0; right: 0; bottom: var(--nav-h);
          background: var(--ink); z-index: 12; display: flex; flex-direction: column;
        }
        .profile-page-scroll { flex: 1; overflow-y: auto; position: relative; }
        .profile-page-cover {
          height: 140px; background: var(--cta-grad); background-size: cover; background-position: center;
        }
        .profile-page-nav-btn {
          position: absolute; top: 14px; width: 34px; height: 34px; border-radius: 50%;
          background: rgba(0,0,0,0.4); color: #fff; border: none;
          display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2;
        }
        .profile-page-back { left: 14px; }
        .profile-page-settings { right: 14px; }
        .profile-page-avatar-wrap {
          position: relative; width: fit-content; margin: -56px auto 0; display: flex; justify-content: center;
        }
        .profile-page-avatar-wrap .avatar,
        .profile-page-avatar-wrap img {
          border: 5px solid var(--ink) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
        }
        .profile-page-body { padding: 10px 22px 32px; text-align: center; }
        .profile-page-name {
          font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
        }
        .profile-page-subtitle {
          margin-top: 4px; font-size: 12.5px; color: var(--muted);
          display: flex; align-items: center; justify-content: center; gap: 4px;
        }
        .profile-stats-row {
          display: flex; margin: 18px 0 4px; border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .profile-stat {
          flex: 1; background: none; border: none; border-right: 1px solid var(--border);
          padding: 12px 4px; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .profile-stat:last-child { border-right: none; }
        .profile-stat:hover { background: var(--card-hover); }
        .profile-stat-value {
          font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: var(--text);
        }
        .profile-stat-label { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .profile-bio {
          margin-top: 16px; font-size: 13.5px; color: var(--text); line-height: 1.5; text-align: left;
        }
        .profile-section { margin-top: 22px; text-align: left; }
        .profile-section-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 700;
        }
        .profile-section-title-row { display: flex; align-items: center; justify-content: space-between; }
        .profile-section-link {
          background: none; border: none; color: var(--live); font-size: 12px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; gap: 2px; font-family: 'Inter', sans-serif;
        }
        .profile-circle-link {
          margin-top: 24px; width: 100%; justify-content: center; padding: 12px;
          border: 1px solid var(--border); border-radius: 12px; font-size: 13px;
        }
        .circle-page-header {
          display: flex; align-items: center; gap: 12px; padding: 16px 18px 4px;
        }
        .circle-page-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700;
        }
        .circle-page-body { padding: 10px 18px 32px; }
        .circle-page-subtitle { font-size: 12.5px; color: var(--muted); line-height: 1.4; margin-bottom: 16px; }
        .circle-list { display: flex; flex-direction: column; gap: 6px; }
        .circle-row {
          display: flex; align-items: center; gap: 12px; width: 100%; text-align: start;
          background: var(--card); border: 1px solid var(--border); border-radius: 14px;
          padding: 10px 12px; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .circle-row:hover { background: var(--card-hover); }
        .circle-row-mid { flex: 1; min-width: 0; }
        .circle-row-name { font-size: 13.5px; font-weight: 700; color: var(--text); }
        .circle-row-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        .circle-row-cta {
          display: flex; align-items: center; gap: 2px; font-size: 11px; font-weight: 600;
          color: var(--live); white-space: nowrap;
        }
        .follow-btn {
          font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700;
          padding: 5px 14px; border-radius: 999px; cursor: pointer;
          background: var(--live); color: #fff; border: 1px solid var(--live);
        }
        .follow-btn.following {
          background: transparent; color: var(--live);
        }
        .profile-activity-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .profile-activity-tag {
          font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px;
          font-family: 'Inter', sans-serif;
        }
        .profile-badges-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px;
        }
        .profile-badge {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 12px 6px; border-radius: 12px; background: var(--card); border: 1px solid var(--border);
          opacity: 0.45; text-align: center;
        }
        .profile-badge.unlocked { opacity: 1; border-color: var(--amber); background: rgba(242,166,90,0.1); }
        .profile-badge-icon {
          width: 38px; height: 38px; border-radius: 50%; background: var(--ink);
          display: flex; align-items: center; justify-content: center; color: var(--muted);
        }
        .profile-badge.unlocked .profile-badge-icon { background: var(--amber); color: #fff; }
        .profile-badge-label { font-size: 10.5px; font-weight: 600; color: var(--text); line-height: 1.25; }
        .profile-badge-progress { font-size: 9.5px; color: var(--muted); }
        .profile-history-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .profile-history-row {
          display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 10px;
          background: var(--card); border: 1px solid var(--border);
        }
        .profile-history-row .swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .profile-history-mid { min-width: 0; }
        .profile-history-title {
          font-size: 12.5px; font-weight: 600; color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .profile-history-meta { font-size: 11px; color: var(--muted); margin-top: 1px; }

        .settings-row {
          width: 100%; display: flex; align-items: center; gap: 10px; text-align: left;
          background: var(--ink); border: 1px solid var(--border); border-radius: 10px;
          padding: 12px 14px; font-size: 13.5px; font-weight: 600; color: var(--text);
          cursor: pointer; margin-bottom: 16px; font-family: 'Inter', sans-serif;
        }
        .settings-row:hover { border-color: var(--border-strong); }
        .settings-row-chevron { margin-left: auto; color: var(--muted); }
        .settings-row-lang { cursor: default; }
        .settings-row-lang .lang-menu-wrap { margin-left: auto; }
        [dir="rtl"] .settings-row-chevron { margin-left: 0; margin-right: auto; }
        [dir="rtl"] .settings-row-lang .lang-menu-wrap { margin-left: 0; margin-right: auto; }
        .settings-section-label {
          font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--muted); margin: 18px 0 8px;
        }
        .settings-logout-btn { margin-top: 20px; color: var(--danger); border-color: var(--danger); }

        .field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field { flex: 1; min-width: 0; }
        .field-hint {
          display: block; font-size: 11px; color: var(--muted); margin: -6px 0 12px;
        }
        .field label { font-size: 12px; color: var(--muted); }
        .field input, .field select, .field textarea {
          background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 11px; color: var(--text); font-size: 13.5px; font-family: 'Inter', sans-serif;
          outline: none;
        }
        .field textarea { resize: vertical; min-height: 56px; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--live); }

        .gender-options { display: flex; gap: 8px; flex-wrap: wrap; }
        .gender-btn {
          flex: 1; min-width: 90px;
          background: var(--ink); border: 1px solid var(--border); color: var(--muted);
          border-radius: 8px; padding: 9px 10px; font-size: 12.5px; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .gender-btn:hover { border-color: var(--border-strong); }
        .gender-btn.active { background: var(--live); color: #fff; border-color: var(--live); font-weight: 600; }

        .pref-options { display: flex; gap: 6px; flex-wrap: wrap; }
        .pref-chip {
          display: flex; align-items: center; gap: 6px;
          background: var(--ink); border: 1px solid var(--border); color: var(--muted);
          border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .pref-chip:hover { border-color: var(--border-strong); }
        .pref-chip.active { background: var(--text); color: var(--ink); border-color: var(--text); font-weight: 600; }
        .pref-chip .swatch { width: 7px; height: 7px; border-radius: 50%; }

        .avatar-upload-btn {
          background: var(--ink); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 8px 12px; font-size: 12.5px; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .avatar-upload-btn:hover { border-color: var(--live); }
        .avatar-remove-btn {
          background: none; border: none; color: var(--muted); font-size: 12px;
          cursor: pointer; text-decoration: underline; font-family: 'Inter', sans-serif;
        }

        .auth-intro { font-size: 12.5px; color: var(--muted); line-height: 1.45; margin-bottom: 14px; }
        .auth-connected-as {
          font-size: 11px; color: var(--live); background: rgba(var(--live-rgb),0.1);
          border: 1px solid rgba(var(--live-rgb),0.25); border-radius: 8px;
          padding: 6px 10px; margin-bottom: 14px; width: fit-content;
        }
        .phone-verify-row { display: flex; gap: 8px; align-items: center; }
        .phone-verify-row input { flex: 1; min-width: 0; }
        .verified-pill {
          display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
          background: rgba(var(--online-rgb),0.14); color: var(--online);
          border: 1px solid rgba(var(--online-rgb),0.35); border-radius: 999px;
          padding: 6px 10px; font-size: 12px; font-weight: 700; white-space: nowrap;
        }
        .verify-code-box {
          margin-top: 8px; padding: 10px; background: var(--ink); border: 1px solid var(--border);
          border-radius: 8px; display: flex; flex-direction: column; gap: 8px;
        }
        .verify-code-hint { font-size: 11.5px; color: var(--muted); }
        .verify-code-hint strong { color: var(--text); letter-spacing: 2px; }
        .card-verified-badge {
          display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
          color: var(--online); font-size: 10.5px; font-weight: 700;
        }
        .card-rating-pill {
          display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
          background: rgba(242,166,90,0.12); border: 1px solid rgba(242,166,90,0.3);
          border-radius: 999px; padding: 3px 8px; font-size: 11.5px; font-weight: 700; color: var(--amber);
        }
        .trust-row {
          display: flex; align-items: center; gap: 5px;
          background: rgba(var(--online-rgb),0.1); color: var(--online);
          border-radius: 8px; padding: 6px 9px; font-size: 11.5px; font-weight: 600;
        }
        .input-with-icon {
          display: flex; align-items: center; gap: 8px;
          background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 0 11px;
        }
        .input-with-icon:focus-within { border-color: var(--live); }
        .input-with-icon.mismatch { border-color: var(--amber); }
        .select-with-swatch {
          display: flex; align-items: center; gap: 9px;
          background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 0 11px;
        }
        .select-with-swatch:focus-within { border-color: var(--live); }
        .select-with-swatch .swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .field .select-with-swatch select {
          border: none; background: transparent; padding: 9px 0; flex: 1; min-width: 0;
          color: var(--text); font-size: 13.5px; font-family: 'Inter', sans-serif; outline: none;
        }
        .age-range-row { display: flex; align-items: center; gap: 8px; }
        .age-range-row input {
          width: 64px; text-align: center; flex: none;
        }
        .age-range-sep { font-size: 12.5px; color: var(--muted); }
        .field .input-with-icon input {
          border: none; background: transparent; padding: 9px 0; flex: 1; min-width: 0;
          color: var(--text); font-size: 13.5px; font-family: 'Inter', sans-serif; outline: none;
        }
        .input-icon-btn {
          background: none; border: none; color: var(--muted); cursor: pointer;
          display: flex; align-items: center; padding: 4px; flex-shrink: 0;
        }
        .input-icon-btn:hover { color: var(--text); }
        .auth-error {
          background: rgba(239,122,155,0.1); border: 1px solid rgba(239,122,155,0.35); color: #EF7A9B;
          border-radius: 8px; padding: 8px 10px; font-size: 12px; margin-bottom: 10px; line-height: 1.4;
        }
        .auth-switch-btn {
          width: 100%; background: none; border: none; color: var(--live); font-size: 12.5px;
          cursor: pointer; text-align: center; margin-top: 12px; font-family: 'Inter', sans-serif;
        }
        .auth-logout-btn { color: var(--muted); margin-top: 8px; }
        .auth-logout-btn:hover { color: var(--amber); }

        .auth-back-link {
          display: flex; align-items: center; gap: 3px; background: none; border: none;
          color: var(--muted); font-size: 12.5px; cursor: pointer; padding: 0; margin-bottom: 10px;
          font-family: 'Inter', sans-serif;
        }
        .auth-back-link:hover { color: var(--text); }
        .phone-dial-row { display: flex; gap: 8px; }
        .dial-code-select {
          flex: 0 0 108px; background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 8px; color: var(--text); font-size: 13.5px; font-family: 'Inter', sans-serif;
          outline: none;
        }
        .dial-code-select:focus { border-color: var(--live); }
        .phone-dial-row input { flex: 1; min-width: 0; }
        .auth-legal-text {
          font-size: 11px; color: var(--muted); line-height: 1.5; margin: 4px 0 14px;
        }
        .auth-legal-link {
          background: none; border: none; padding: 0; color: var(--live); font-size: inherit;
          cursor: pointer; text-decoration: underline; font-family: inherit;
        }
        .auth-forgot-link {
          display: block; width: 100%; text-align: right; background: none; border: none;
          color: var(--live); font-size: 12px; cursor: pointer; margin: -6px 0 10px;
          font-family: 'Inter', sans-serif;
        }
        .phone-channel-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--ink); border: 1px solid var(--border); color: var(--text);
          border-radius: 9px; padding: 11px; font-size: 13.5px; font-weight: 600; cursor: pointer;
          margin-top: 8px; font-family: 'Inter', sans-serif;
        }
        .phone-channel-btn:hover:not(:disabled) { border-color: var(--border-strong); }
        .phone-channel-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .phone-channel-btn.whatsapp {
          background: #25D366; border-color: #25D366; color: #fff; margin-top: 4px;
        }
        .phone-channel-btn.whatsapp:hover:not(:disabled) { background: #20bd5a; }
        .auth-separator {
          display: flex; align-items: center; gap: 10px; margin: 16px 0;
          color: var(--muted); font-size: 11.5px;
        }
        .auth-separator::before, .auth-separator::after {
          content: ''; flex: 1; height: 1px; background: var(--border);
        }
        .auth-oauth-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--card); border: 1px solid var(--border); color: var(--text);
          border-radius: 9px; padding: 11px; font-size: 13.5px; font-weight: 600; cursor: pointer;
          margin-top: 8px; font-family: 'Inter', sans-serif;
        }
        .auth-oauth-btn:hover { border-color: var(--border-strong); background: var(--card-hover); }

        .lang-menu-wrap { position: relative; display: inline-block; }
        .lang-menu-btn {
          background: var(--ink); border: 1px solid var(--border); border-radius: 999px;
          padding: 5px 10px; font-size: 12px; font-weight: 600; color: var(--text);
          cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .lang-menu-btn:hover { border-color: var(--border-strong); }
        .lang-menu-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 10;
          background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.12); padding: 4px; min-width: 140px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .lang-menu-dropdown.align-right { left: auto; right: 0; }
        .lang-menu-item {
          background: none; border: none; text-align: left; padding: 8px 10px; border-radius: 7px;
          font-size: 12.5px; color: var(--text); cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .lang-menu-item:hover { background: var(--card-hover); }
        .lang-menu-item.active { background: rgba(var(--live-rgb),0.12); color: var(--live); font-weight: 600; }
        .auth-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }

        .invite-preview {
          background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 10px 12px; font-size: 12.5px; color: var(--muted); line-height: 1.4;
          margin-bottom: 8px;
        }
        .invite-share-row { display: flex; gap: 8px; }
        .invite-share-row .avatar-upload-btn { flex: 1; text-align: center; }

        .modal-submit {
          width: 100%; padding: 11px; border: none; border-radius: 9px;
          background: var(--cta-grad); color: #fff; font-weight: 600; font-size: 13.5px;
          cursor: pointer; margin-top: 4px; font-family: 'Inter', sans-serif;
          box-shadow: 0 6px 16px rgba(var(--live-rgb),0.28);
        }
        .modal-submit:disabled { opacity: 1; cursor: not-allowed; box-shadow: none; background: var(--border); color: var(--muted); }
        .modal-submit-danger { background: var(--danger); box-shadow: 0 6px 16px rgba(250,56,62,0.28); }
        .modal-cancel {
          width: 100%; padding: 11px; border: 1px solid var(--border); border-radius: 9px;
          background: transparent; color: var(--text); font-weight: 600; font-size: 13.5px;
          cursor: pointer; margin-top: 8px; font-family: 'Inter', sans-serif;
        }
        .modal-cancel:hover { background: rgba(255,255,255,0.04); }

        .chat-modal { display: flex; flex-direction: column; max-height: 78%; padding-bottom: 14px; }

        .live-modal { display: flex; flex-direction: column; gap: 14px; max-height: 85%; overflow-y: auto; }

        .live-host-card {
          display: flex; align-items: center; gap: 10px;
          background: var(--ink); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;
        }
        .live-host-info { flex: 1; min-width: 0; }
        .live-host-name { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13.5px; }
        .live-host-sub { font-size: 11px; color: var(--muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .live-status-chip {
          font-size: 10.5px; font-weight: 700; padding: 4px 9px; border-radius: 999px; flex-shrink: 0;
        }
        .live-status-chip.arrived { background: rgba(127,207,158,0.18); color: #7FCF9E; }

        .live-list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; }
        .live-list-row {
          display: flex; align-items: center; gap: 10px; font-size: 12.5px;
          background: var(--ink); border: 1px solid var(--border); border-left: 3px solid var(--live);
          border-radius: 10px; padding: 8px 10px;
        }
        .live-list-row.arrived { border-left-color: #7FCF9E; }
        .live-list-mid { flex: 1; min-width: 0; }
        .live-list-name { font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .live-list-host-tag { font-size: 9.5px; font-weight: 600; color: var(--amber); }
        .live-list-time { font-size: 10.5px; color: var(--muted); margin-top: 1px; }

        .live-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 13px; border-radius: 12px; border: none; cursor: pointer;
          background: var(--live); color: #fff; font-weight: 700; font-size: 13.5px;
          font-family: 'Inter', sans-serif;
        }
        .live-cta.active { background: rgba(var(--live-rgb),0.16); color: var(--live); border: 1px solid var(--live); }

        .privacy-note {
          font-size: 11px; color: var(--muted); background: var(--ink); border: 1px solid var(--border);
          border-radius: 10px; padding: 8px 10px; line-height: 1.4;
        }
        .journey-status {
          text-align: center; font-size: 12.5px; color: var(--live); font-weight: 600;
          background: rgba(var(--live-rgb),0.08); border: 1px solid rgba(var(--live-rgb),0.3);
          border-radius: 10px; padding: 9px;
        }
        .journey-arrived {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--muted);
        }
        .journey-arrived-row { display: flex; align-items: center; gap: 8px; justify-content: center; }
        .journey-cancel-link {
          background: none; border: none; color: var(--muted); font-size: 11.5px;
          text-decoration: underline; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .journey-cancel-link:hover { color: var(--text); }
        .journey-manual-btn {
          background: none; border: none; color: var(--muted); font-size: 12px;
          text-decoration: underline; cursor: pointer; font-family: 'Inter', sans-serif; text-align: center;
        }

        .chat-subtitle { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        .chat-messages {
          flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
          padding: 4px 2px 10px; min-height: 200px; max-height: 320px;
        }
        .chat-empty { text-align: center; color: var(--muted); font-size: 12.5px; padding: 40px 10px; }
        .chat-bubble-row { display: flex; gap: 6px; align-items: flex-end; }
        .chat-bubble-row.mine { justify-content: flex-end; }
        .chat-bubble {
          max-width: 78%; background: var(--ink); border: 1px solid var(--border);
          border-radius: 12px; padding: 7px 11px; font-size: 13px;
        }
        .chat-bubble-row.mine .chat-bubble { background: var(--live); color: #fff; border-color: var(--live); }
        .chat-author { font-size: 10.5px; font-weight: 700; color: var(--live); margin-bottom: 2px; }
        .chat-bubble-row.mine .chat-author { display: none; }
        .chat-text { line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
        .chat-time { font-size: 9.5px; opacity: 0.6; margin-top: 3px; text-align: right; }

        .chat-input-row { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
        .chat-input {
          flex: 1; background: var(--ink); border: 1px solid var(--border); border-radius: 9px;
          padding: 9px 12px; color: var(--text); font-size: 13.5px; font-family: 'Inter', sans-serif; outline: none;
        }
        .chat-input:focus { border-color: var(--live); }
        .chat-send-btn {
          background: var(--live); border: none; border-radius: 9px; width: 38px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff;
        }
        .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .toast {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          background: var(--text); color: var(--ink); padding: 9px 16px;
          border-radius: 999px; font-size: 12.5px; font-weight: 600; z-index: 30;
        }

        .loading-state { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 80px 0; color: var(--muted); font-size: 13px; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .skeleton-card {
          background: var(--card); border: 1px solid var(--border); border-radius: 12px;
          padding: 14px; display: flex; flex-direction: column; gap: 10px; height: 148px;
        }
        .skeleton-line {
          height: 10px; border-radius: 6px;
          background: linear-gradient(90deg, var(--border) 25%, #FFFFFF 37%, var(--border) 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        .skeleton-line.w-title { width: 65%; height: 14px; }
        .skeleton-line.w-full { width: 92%; }
        .skeleton-line.w-half { width: 48%; }
        .skeleton-line.w-third { width: 34%; }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

        /* Micro-interactions tactiles : léger retour visuel au tap, comme sur une vraie app mobile */
        .card:active, .chip:active, .join-btn:active,
        .toggle-btn:active, .geo-btn:active, .preset-btn:active,
        .pref-chip:active, .gender-btn:active, .segmented-item:active, .recommended-card:active,
        .rate-btn:active, .chat-icon-btn:active, .avatar-upload-btn:active, .modal-submit:active {
          transform: scale(0.96);
        }
        .card, .chip, .join-btn, .toggle-btn, .geo-btn,
        .preset-btn, .pref-chip, .gender-btn, .segmented-item, .recommended-card,
        .rate-btn, .chat-icon-btn, .avatar-upload-btn, .modal-submit {
          transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }

        .rezo-scroll::-webkit-scrollbar { width: 6px; }
        .rezo-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        /* --- Support RTL (arabe) --------------------------------------------------------------
           L'attribut dir=rtl sur .rezo-app inverse déjà nativement le texte, la ponctuation et
           l'ordre des listes ; les flex row suivent aussi l'axe d'écriture (donc gap/icônes
           s'inversent tout seuls). Ce qui NE s'inverse PAS tout seul : les positions absolues
           câblées en left/right, les bordures d'accent directionnelles, et les icônes de
           navigation (retour) dont le sens doit être inversé plutôt que simplement repositionné. */
        [dir="rtl"] .modal-close,
        [dir="rtl"] .profile-modal-close { right: auto; left: 10px; }
        [dir="rtl"] .cover-edit-btn { right: auto; left: 10px; }
        [dir="rtl"] .cover-remove-btn { right: auto; left: 10px; }
        [dir="rtl"] .profile-avatar-edit-btn { right: auto; left: 2px; }
        [dir="rtl"] .profile-page-back { left: auto; right: 14px; }
        [dir="rtl"] .profile-page-settings { right: auto; left: 14px; }
        [dir="rtl"] .chips-label { margin-right: 0; margin-left: 2px; }
        [dir="rtl"] .arrivals-count { margin-left: 0; margin-right: 4px; }
        [dir="rtl"] .star-display { margin-left: 0; margin-right: 4px; }
        [dir="rtl"] .live-list-row { border-left: none; border-right: 3px solid var(--live); }
        [dir="rtl"] .live-list-row.arrived { border-left-color: transparent; border-right-color: #7FCF9E; }
        [dir="rtl"] .lang-menu-dropdown.align-right { right: auto; left: 0; }
      `}</style>

      {showSplash && (
        <div className={`splash-screen ${splashHiding ? 'hide' : ''}`} aria-hidden={splashHiding}>
          <div className="splash-badge">
            <span className="splash-badge-letter">R</span>
            <span className="splash-badge-dot"></span>
          </div>
          <div className="splash-tagline">Rencontres par activité, près de toi</div>
          <div className="splash-loader">
            <span></span><span></span><span></span>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}

      <div className="rezo-header">
        <div>
          <div className="rezo-brand">REZO<span className="dot">·</span></div>
          <div className="rezo-tagline">{t('app.tagline')}</div>
        </div>
        <div className="rezo-live">
          <span className="pulse"></span>
          {t('app.liveSync')}{lastSync ? ` · ${t('app.liveSyncAt', { time: lastSync.toLocaleTimeString(WHEN_LOCALES[language] || 'fr-FR', { hour: '2-digit', minute: '2-digit' }) })}` : ''}
        </div>
      </div>

      <div className="rezo-scroll">
      <div className="rezo-controls">
        <div className="rezo-search-row">
          <div className="rezo-zone-input activity-search">
            <Search size={14} color="var(--muted)" />
            <input
              placeholder={t('search.activityPlaceholder')}
              value={activityQuery}
              onChange={(e) => {
                setActivityQuery(e.target.value);
                setSelectedActivity('all');
                setActivitySuggestOpen(true);
              }}
              onFocus={() => setActivitySuggestOpen(true)}
              onBlur={() => setTimeout(() => setActivitySuggestOpen(false), 150)}
            />
            {activitySuggestOpen && activitySuggestions.length > 0 && (
              <div className="activity-suggest-list">
                {activitySuggestions.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.id] || Sparkles;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="activity-suggest-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedActivity(a.id);
                        setActivityQuery(aLabel(a.id));
                        setActivitySuggestOpen(false);
                      }}
                    >
                      <span className="activity-suggest-icon" style={{ background: a.color }}>
                        <Icon size={13} color="#1C1E21" />
                      </span>
                      {aLabel(a.id)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rezo-zone-input">
            <MapPin size={14} color="var(--muted)" />
            <input
              placeholder={t('search.zonePlaceholder')}
              value={zoneQuery}
              onChange={(e) => setZoneQuery(e.target.value)}
            />
          </div>
        </div>

        <button
          className={`geo-btn full ${nearMeActive ? 'active' : ''}`}
          onClick={nearMeActive ? disableNearMe : activateNearMe}
          disabled={locating}
        >
          {locating ? <Loader2 size={13} className="spin" /> : <Navigation size={13} />}
          {nearMeActive ? t('position.active') : locating ? t('position.locating') : t('position.cta')}
        </button>
      </div>
        {locationError && (
          <div className="geo-error">
            {locationError}
            <div className="manual-geo">
              <span>Ou choisis une position de test :</span>
              {MOROCCO_PRESETS.map((p) => (
                <button key={p.label} className="preset-btn" onClick={() => applyManualCoords(p.coords)}>
                  {p.label}
                </button>
              ))}
              <span className="manual-sep">ou</span>
              <input
                className="manual-input"
                placeholder="lat"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
              />
              <input
                className="manual-input"
                placeholder="lng"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
              />
              <button className="preset-btn" onClick={() => applyManualCoords({ lat: Number(manualLat), lng: Number(manualLng) })}>
                Valider
              </button>
            </div>
          </div>
        )}

      {nearMeActive && userCity && (
        <div className="recommended-wrap near-city-wrap">
          <div className="recommended-title">
            <MapPin size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 5 }} color="var(--live)" />
            {t('position.nearCity', { city: userCity })}
          </div>
          {nearCityMeetups.length > 0 ? (
            <div className="rezo-grid near-city-grid">
              {nearCityMeetups.map((m) => renderMeetupCard(m))}
            </div>
          ) : (
            <div className="near-city-empty">
              {t('position.emptyCity', { city: userCity })}
            </div>
          )}
        </div>
      )}

      {fromFollowed.length > 0 && (
        <div className="recommended-wrap">
          <div className="recommended-title">
            <Users size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 5 }} color="var(--live)" />
            {t('home.fromFollowed')}
          </div>
          <div className="recommended-scroll">
            {fromFollowed.map((m) => {
              const color = activityById(m.activity).color;
              return (
                <button
                  key={m.id}
                  className="recommended-card"
                  onClick={() => setSelectedActivity(m.activity)}
                >
                  <span className="swatch" style={{ background: color }}></span>
                  <div className="recommended-card-title">{m.title}</div>
                  <div className="recommended-card-meta">
                    {m.zone || t('card.zoneUnspecified')} · {formatWhen(m.datetime, language)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="recommended-wrap">
          <div className="recommended-title">
            <Heart size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 5 }} fill="var(--amber)" color="var(--amber)" />
            {t('home.recommendedForYou')}
          </div>
          <div className="recommended-scroll">
            {recommended.map((m) => {
              const color = activityById(m.activity).color;
              return (
                <button
                  key={m.id}
                  className="recommended-card"
                  onClick={() => setSelectedActivity(m.activity)}
                >
                  <span className="swatch" style={{ background: color }}></span>
                  <div className="recommended-card-title">{m.title}</div>
                  <div className="recommended-card-meta">
                    {m.zone || t('card.zoneUnspecified')} · {formatWhen(m.datetime, language)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rezo-body">
        {loading ? (
          <div className="rezo-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="skeleton-card" key={i}>
                <div className="skeleton-line w-title"></div>
                <div className="skeleton-line w-half"></div>
                <div className="skeleton-line w-full"></div>
                <div className="skeleton-line w-third"></div>
              </div>
            ))}
          </div>
        ) : mineOnly && filtered.length === 0 ? (
          <div className="rezo-empty">
            <Bookmark size={38} color="var(--border-strong)" style={{ marginBottom: 10 }} />
            <div className="rezo-empty-title">{t('empty.noHistoryTitle')}</div>
            <div>{t('empty.noHistoryBody')}</div>
          </div>
        ) : grouped.length === 0 && nearbyFallback.length === 0 ? (
          <div className="rezo-empty">
            <Compass size={38} color="var(--border-strong)" style={{ marginBottom: 10 }} />
            <div className="rezo-empty-title">{t('empty.noMeetupsTitle')}</div>
            <div>{t('empty.noMeetupsBody')}</div>
            <div className="quick-templates">
              {QUICK_TEMPLATES.map((qt) => (
                <button
                  key={qt.id}
                  className="quick-template-card"
                  onClick={() => requireName(() => { setTemplateDraft(qt); setShowCreate(true); })}
                >
                  <span className="quick-template-emoji">{qt.emoji}</span>
                  <span className="quick-template-label">{qt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : grouped.length === 0 ? (
          <div className="rezo-fallback">
            <div className="rezo-fallback-banner">
              <Compass size={15} />
              {zoneQuery.trim() ? t('empty.nothingAtZone', { zone: zoneQuery.trim() }) : t('empty.nothingInRadius')}
              {t('empty.hereIs')}{' '}
              {nearbyFallback.length === 1 ? t('empty.closestOne') : t('empty.closestMany', { count: nearbyFallback.length })} :
            </div>
            <div className="rezo-grid">{nearbyFallback.map((m) => renderMeetupCard(m))}</div>
          </div>
        ) : (
          grouped.map((g) => (
            <div className="rezo-section" key={g.id}>
              <div className="rezo-section-title">
                <span className="swatch" style={{ background: g.color }}></span>
                {aLabel(g.id)} · {g.items.length}
              </div>
              <div className="rezo-grid">
                {g.items.map((m) => renderMeetupCard(m))}
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      {filtersOpen && (
        <div className="sheet-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <div className="modal-title"><SlidersHorizontal size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />{t('filters.title')}</div>
              <button className="modal-close" onClick={() => setFiltersOpen(false)}><X size={18} /></button>
            </div>

            <div className="sheet-section">
              <div className="filters-row-label">{t('filters.meetingType')}</div>
              <div className="segmented">
                <button
                  className={`segmented-item ${selectedAudience === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedAudience('all')}
                >
                  {t('audience.all')}
                </button>
                {AUDIENCE_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    className={`segmented-item ${selectedAudience === a.id ? 'active' : ''}`}
                    onClick={() => setSelectedAudience(a.id)}
                  >
                    {audLabel(a.id)}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-section">
              <div className="switch-row">
                <div>
                  <div className="switch-title">{t('filters.mySorties')}</div>
                  <div className="switch-subtitle">
                    {t('filters.mySortiesSub')}
                  </div>
                </div>
                <button
                  className={`switch ${mineOnly ? 'on' : ''}`}
                  role="switch"
                  aria-checked={mineOnly}
                  onClick={() => setMineOnly((v) => !v)}
                >
                  <span className="switch-knob"></span>
                </button>
              </div>
              {!mineOnly && (
                <div className="switch-row">
                  <div>
                    <div className="switch-title">{t('filters.showPast')}</div>
                    <div className="switch-subtitle">{t('filters.showPastSub')}</div>
                  </div>
                  <button
                    className={`switch ${showPast ? 'on' : ''}`}
                    role="switch"
                    aria-checked={showPast}
                    onClick={() => setShowPast((v) => !v)}
                  >
                    <span className="switch-knob"></span>
                  </button>
                </div>
              )}
            </div>

            <div className="sheet-section">
              <FieldLabel icon={Cake}>{t('filters.ageRange')}</FieldLabel>
              <div className="age-range-row">
                <input
                  type="number"
                  min={16}
                  max={99}
                  value={ageFilterMin}
                  onChange={(e) => setAgeFilterMin(Math.min(Number(e.target.value) || 16, ageFilterMax))}
                />
                <span className="age-range-sep">{t('filters.ageSep')}</span>
                <input
                  type="number"
                  min={16}
                  max={99}
                  value={ageFilterMax}
                  onChange={(e) => setAgeFilterMax(Math.max(Number(e.target.value) || 99, ageFilterMin))}
                />
                <span className="age-range-sep">{t('filters.ageUnit')}</span>
              </div>
            </div>

            {userCoords && (
              <div className="sheet-section">
                <FieldLabel icon={Navigation}>{t('filters.searchRadius')}</FieldLabel>
                <div className="radius-control">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                  />
                  <span>{radiusKm} km</span>
                </div>
              </div>
            )}

            <div className="sheet-footer">
              <button className="filters-reset" onClick={resetFilters}>
                {t('filters.reset')}
              </button>
              <button className="modal-submit sheet-apply" onClick={() => setFiltersOpen(false)}>
                {t('filters.seeResults')}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${!mineOnly ? 'active' : ''}`}
          onClick={() => { setShowProfilePage(false); setShowCirclePage(false); setMineOnly(false); }}
        >
          <Home size={20} />
          <span>{t('nav.discover')}</span>
        </button>
        <button
          className={`bottom-nav-item ${mineOnly ? 'active' : ''}`}
          onClick={() => { setShowProfilePage(false); setShowCirclePage(false); setMineOnly(true); }}
        >
          <Bookmark size={20} />
          <span>{t('nav.mySorties')}</span>
        </button>
        <button
          className="bottom-nav-center"
          onClick={() => requireName(() => { setShowProfilePage(false); setShowCirclePage(false); setShowCreate(true); })}
          aria-label={t('nav.create')}
        >
          <Plus size={24} />
        </button>
        <button
          className={`bottom-nav-item ${filtersOpen ? 'active' : ''}`}
          onClick={() => { setShowProfilePage(false); setShowCirclePage(false); setFiltersOpen(true); }}
        >
          <SlidersHorizontal size={20} />
          <span>{t('nav.filters')}</span>
          {activeFilterCount > 0 && <span className="bottom-nav-badge">{activeFilterCount}</span>}
        </button>
        <button
          className={`bottom-nav-item ${showProfilePage || showNameModal || showAuthModal ? 'active' : ''}`}
          onClick={openProfilePage}
        >
          {userName ? <Avatar name={userName} avatarUrl={userAvatar} size={22} /> : <User size={20} />}
          <span>{t('nav.profile')}</span>
          {badgeUnlocked && <span className="bottom-nav-badge">{monthlyCount}</span>}
        </button>
      </nav>

      {showCreate && (
        <CreateModal
          onClose={() => {
            setShowCreate(false);
            setEditingMeetup(null);
            setTemplateDraft(null);
          }}
          onSubmit={handleCreate}
          saving={saving}
          userCoords={userCoords}
          userGender={userGender}
          initial={editingMeetup}
          template={templateDraft}
          defaultZone={zoneQuery}
          t={t}
          aLabel={aLabel}
          audLabel={audLabel}
          language={language}
          dir={dir}
        />
      )}

      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal">
            {authScreen === 'choose' && (
              <>
                <div className="auth-header-row">
                  <LanguageMenu
                    language={language}
                    onChange={setLanguage}
                    open={langMenuOpen}
                    onToggle={() => setLangMenuOpen((v) => !v)}
                  />
                </div>

                <div className="modal-header">
                  <div className="modal-title">
                    <Lock size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />
                    {t('auth.title')}
                  </div>
                  <button className="modal-close" onClick={() => setShowAuthModal(false)}><X size={18} /></button>
                </div>

                <div className="auth-intro">
                  {t('auth.intro')}
                </div>

                {authError && <div className="auth-error" role="alert">{authError}</div>}

                <div className="field">
                  <label>{t('auth.phoneLabel')}</label>
                  <div className="phone-dial-row">
                    <select
                      className="dial-code-select"
                      value={authDialCode}
                      onChange={(e) => {
                        const match = DIAL_CODES.find((d) => d.code === e.target.value);
                        setAuthDialCode(e.target.value);
                        if (match) setAuthDialCountry(match.country);
                      }}
                    >
                      {DIAL_CODES.map((d) => (
                        <option key={d.country} value={d.code}>{d.flag} {d.code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={authPhoneNumber}
                      onChange={(e) => setAuthPhoneNumber(e.target.value)}
                      placeholder="6 12 34 56 78"
                      onKeyDown={(e) => e.key === 'Enter' && requestPhoneAuthCode('sms')}
                    />
                  </div>
                </div>

                <div className="auth-legal-text">
                  {interpolateNodes(t('auth.legalText'), {
                    privacy: (
                      <button type="button" className="auth-legal-link" onClick={() => showLegalPlaceholder(t('auth.privacyPolicy'))}>
                        {t('auth.privacyPolicy')}
                      </button>
                    ),
                    terms: (
                      <button type="button" className="auth-legal-link" onClick={() => showLegalPlaceholder(t('auth.termsOfUse'))}>
                        {t('auth.termsOfUse')}
                      </button>
                    ),
                  })}
                </div>

                <button
                  type="button"
                  className="phone-channel-btn whatsapp"
                  disabled={authPhoneBusy}
                  onClick={() => requestPhoneAuthCode('whatsapp')}
                >
                  {authPhoneBusy && authPhoneChannel === 'whatsapp' ? <Loader2 size={15} className="spin" /> : <MessageCircle size={15} />}
                  {t('auth.whatsapp')}
                </button>
                <button
                  type="button"
                  className="phone-channel-btn"
                  disabled={authPhoneBusy}
                  onClick={() => requestPhoneAuthCode('sms')}
                >
                  {authPhoneBusy && authPhoneChannel === 'sms' ? <Loader2 size={15} className="spin" /> : <Phone size={15} />}
                  {t('auth.sms')}
                </button>

                <div className="auth-separator"><span>{t('auth.orWith')}</span></div>

                <button type="button" className="auth-oauth-btn" onClick={() => handleOAuthStub('Google')}>
                  <GoogleIcon /> {t('auth.continueGoogle')}
                </button>
                <button type="button" className="auth-oauth-btn" onClick={() => handleOAuthStub('Facebook')}>
                  <FacebookIcon /> {t('auth.continueFacebook')}
                </button>
                <button
                  type="button"
                  className="auth-oauth-btn"
                  onClick={() => { setAuthScreen('email'); setAuthMode('login'); setAuthError(null); }}
                >
                  <Mail size={18} color="var(--muted)" /> {t('auth.continueEmail')}
                </button>
              </>
            )}

            {authScreen === 'phone-code' && (
              <>
                <div className="modal-header">
                  <div className="modal-title">
                    <Phone size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />
                    {t('auth.verifyPhone')}
                  </div>
                  <button className="modal-close" onClick={() => setShowAuthModal(false)}><X size={18} /></button>
                </div>

                <button type="button" className="auth-back-link" onClick={() => { setAuthScreen('choose'); setAuthError(null); }}>
                  <ChevronRight size={13} style={{ transform: dir === 'rtl' ? 'none' : 'rotate(180deg)', verticalAlign: '-2px' }} /> {t('auth.back')}
                </button>

                <div className="auth-intro">
                  {t('auth.codeSentVia', {
                    channel: authPhoneChannel === 'whatsapp' ? 'WhatsApp' : 'SMS',
                    phone: `${authDialCode} ${authPhoneNumber}`,
                  })}
                </div>

                {authPhoneDevCode && (
                  <div className="verify-code-hint">
                    {interpolateNodes(t('auth.devCodeHint'), { code: <strong>{authPhoneDevCode}</strong> })}
                  </div>
                )}

                {authError && <div className="auth-error" role="alert">{authError}</div>}

                <div className="field">
                  <label>{t('auth.codeLabel')}</label>
                  <input
                    autoFocus
                    value={authPhoneCode}
                    onChange={(e) => setAuthPhoneCode(e.target.value)}
                    placeholder={t('field.sixDigitCode')}
                    maxLength={6}
                    onKeyDown={(e) => e.key === 'Enter' && confirmPhoneAuthCode()}
                  />
                </div>

                <button className="modal-submit" disabled={authPhoneBusy || !authPhoneCode.trim()} onClick={confirmPhoneAuthCode}>
                  {authPhoneBusy ? `${t('auth.verify')}…` : t('auth.verify')}
                </button>

                <button
                  type="button"
                  className="auth-switch-btn"
                  disabled={authPhoneBusy}
                  onClick={() => requestPhoneAuthCode(authPhoneChannel)}
                >
                  {t('auth.resendCode')}
                </button>
              </>
            )}

            {authScreen === 'email' && (
              <>
                <div className="modal-header">
                  <div className="modal-title">
                    <Mail size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />
                    {authMode === 'signup' ? t('auth.createAccount') : t('auth.emailLoginTitle')}
                  </div>
                  <button className="modal-close" onClick={() => setShowAuthModal(false)}><X size={18} /></button>
                </div>

                <button type="button" className="auth-back-link" onClick={() => { setAuthScreen('choose'); setAuthError(null); }}>
                  <ChevronRight size={13} style={{ transform: dir === 'rtl' ? 'none' : 'rotate(180deg)', verticalAlign: '-2px' }} /> {t('auth.back')}
                </button>

                {authMode === 'signup' && (
                  <div className="auth-intro">
                    {t('auth.intro')}
                  </div>
                )}

                <div className="field">
                  <label>{t('auth.emailLabel')}</label>
                  <div className="input-with-icon">
                    <Mail size={14} color="var(--muted)" />
                    <input
                      type="email"
                      autoFocus
                      autoComplete="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="toi@exemple.com"
                      onKeyDown={(e) => e.key === 'Enter' && (authMode === 'signup' ? submitSignup() : submitLogin())}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>{t('auth.passwordLabel')}</label>
                  <div className="input-with-icon">
                    <Lock size={14} color="var(--muted)" />
                    <input
                      type={authShowPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Au moins 6 caractères"
                      onKeyDown={(e) => e.key === 'Enter' && authMode === 'login' && submitLogin()}
                    />
                    <button
                      type="button"
                      className="input-icon-btn"
                      onClick={() => setAuthShowPassword((v) => !v)}
                      aria-label={authShowPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {authShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {authMode === 'signup' && (
                  <div className="field">
                    <label>{t('auth.confirmPasswordLabel')}</label>
                    <div className={`input-with-icon ${authConfirm && authConfirm !== authPassword ? 'mismatch' : ''}`}>
                      <Lock size={14} color="var(--muted)" />
                      <input
                        type={authShowPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={authConfirm}
                        onChange={(e) => setAuthConfirm(e.target.value)}
                        placeholder="Retape ton mot de passe"
                        onKeyDown={(e) => e.key === 'Enter' && submitSignup()}
                      />
                    </div>
                    {authConfirm && authConfirm !== authPassword && (
                      <span style={{ fontSize: 11, color: 'var(--amber)' }}>Les mots de passe ne correspondent pas.</span>
                    )}
                  </div>
                )}

                {authMode === 'login' && (
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => showLegalPlaceholder(t('auth.forgotPassword'))}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                )}

                {authError && (
                  <div className="auth-error" role="alert">
                    {authError}
                  </div>
                )}

                <button
                  className="modal-submit"
                  disabled={
                    authSubmitting ||
                    !authEmail.trim() ||
                    !authPassword ||
                    (authMode === 'signup' && !authConfirm)
                  }
                  onClick={authMode === 'signup' ? submitSignup : submitLogin}
                >
                  {authSubmitting ? '…' : authMode === 'signup' ? t('auth.createAccount') : t('auth.login')}
                </button>

                <button type="button" className="auth-oauth-btn" onClick={() => handleOAuthStub('Google')}>
                  <GoogleIcon /> {t('auth.googleLogin')}
                </button>

                <div className="auth-legal-text">
                  {interpolateNodes(t('auth.dataMention'), {
                    link: (
                      <button type="button" className="auth-legal-link" onClick={() => showLegalPlaceholder(t('auth.privacyStatement'))}>
                        {t('auth.privacyStatement')}
                      </button>
                    ),
                  })}
                </div>

                <button
                  type="button"
                  className="auth-switch-btn"
                  onClick={() => {
                    setAuthMode((m) => (m === 'signup' ? 'login' : 'signup'));
                    setAuthError(null);
                  }}
                >
                  {authMode === 'signup' ? t('auth.hasAccount') : t('auth.noAccount')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal profile-modal">
            <button className="modal-close profile-modal-close" onClick={() => setShowNameModal(false)}>
              <X size={16} />
            </button>

            <div
              className="profile-cover profile-cover-editable"
              style={coverDraft || userCover ? { backgroundImage: `url(${coverDraft !== null ? coverDraft : userCover})` } : undefined}
            >
              <label className="cover-edit-btn" title={t('field.changeCover')}>
                {coverProcessing ? <Loader2 size={13} className="spin" /> : <ImageIcon size={13} />}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleCoverFile(e.target.files && e.target.files[0])}
                />
              </label>
              {(coverDraft || userCover) && (
                <button type="button" className="cover-remove-btn" title={t('field.removeCover')} onClick={() => setCoverDraft('')}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="profile-avatar-wrap">
              <Avatar
                name={nameDraft || userName || '?'}
                avatarUrl={avatarDraft !== null ? avatarDraft : userAvatar}
                size={84}
              />
              <label className="profile-avatar-edit-btn" title={t('field.changePhoto')}>
                {avatarProcessing ? <Loader2 size={13} className="spin" /> : <Camera size={13} />}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleAvatarFile(e.target.files && e.target.files[0])}
                />
              </label>
            </div>
            {(avatarDraft || userAvatar) && (
              <button type="button" className="avatar-remove-btn profile-avatar-remove" onClick={() => setAvatarDraft('')}>
                {t('field.removePhoto')}
              </button>
            )}

            <div className="profile-modal-body">
              {userEmail && <div className="auth-connected-as" style={{ margin: '0 auto 14px' }}>{t('field.connectedAs', { email: userEmail })}</div>}

              <div className="field-row">
                <div className="field">
                  <FieldLabel icon={User}>{t('field.firstName')}</FieldLabel>
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Ex: Yassine"
                  />
                </div>
                <div className="field">
                  <FieldLabel icon={User}>{t('field.lastName')}</FieldLabel>
                  <input
                    value={lastNameDraft}
                    onChange={(e) => setLastNameDraft(e.target.value)}
                    placeholder="Ex: El Amrani"
                  />
                </div>
              </div>
              <span className="field-hint">
                {t('field.nameVisibilityHint')}
              </span>

              <div className="field-row">
                <div className="field">
                  <FieldLabel icon={Globe}>{t('field.country')}</FieldLabel>
                  <select value={countryDraft} onChange={(e) => { setCountryDraft(e.target.value); setCityDraft(''); }}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <FieldLabel icon={MapPin}>{t('field.city')}</FieldLabel>
                  <input
                    list="rezo-city-options"
                    value={cityDraft}
                    onChange={(e) => setCityDraft(e.target.value)}
                    placeholder="Ex: Casablanca"
                  />
                  <datalist id="rezo-city-options">
                    {(CITIES_BY_COUNTRY[countryDraft] || []).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="field">
                <FieldLabel icon={Phone}>{t('field.phoneOptional')}</FieldLabel>
                <div className="phone-verify-row">
                  <input
                    type="tel"
                    value={phoneDraft}
                    onChange={(e) => onPhoneDraftChange(e.target.value)}
                    placeholder="Ex: 06 12 34 56 78"
                  />
                  {phoneVerifiedDraft ? (
                    <span className="verified-pill">
                      <ShieldCheck size={13} /> {t('card.verified')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="avatar-upload-btn"
                      disabled={!phoneDraft.trim() || verifyBusy}
                      onClick={requestPhoneVerification}
                    >
                      {verifyBusy && !verifyCodeSent ? t('field.sending') : t('field.verify')}
                    </button>
                  )}
                </div>
                {verifyCodeSent && !phoneVerifiedDraft && (
                  <div className="verify-code-box">
                    <div className="verify-code-hint">
                      {t('field.demoCodeNoSms')} <strong>{verifyDevCode}</strong>
                    </div>
                    <div className="phone-verify-row">
                      <input
                        value={verifyCodeInput}
                        onChange={(e) => setVerifyCodeInput(e.target.value)}
                        placeholder={t('field.sixDigitCode')}
                        maxLength={6}
                      />
                      <button
                        type="button"
                        className="avatar-upload-btn"
                        disabled={!verifyCodeInput.trim() || verifyBusy}
                        onClick={confirmPhoneVerification}
                      >
                        {verifyBusy ? t('field.confirming') : t('field.confirmCode')}
                      </button>
                    </div>
                  </div>
                )}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {t('field.verifiedHint')}
                </span>
              </div>

              <div className="field">
                <label>{t('field.gender')}</label>
                <div className="gender-options">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`gender-btn ${genderDraft === g.id ? 'active' : ''}`}
                      onClick={() => setGenderDraft(g.id)}
                    >
                      {gLabel(g.id)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{t('field.activitiesLabel')}</label>
                <div className="pref-options">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`pref-chip ${preferencesDraft.includes(a.id) ? 'active' : ''}`}
                      onClick={() => togglePreference(a.id)}
                    >
                      <span className="swatch" style={{ background: a.color }}></span>
                      {aLabel(a.id)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <FieldLabel icon={AlignLeft}>{t('field.bio')}</FieldLabel>
                <textarea
                  value={bioDraft}
                  maxLength={280}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{bioDraft.length}/280</span>
              </div>

              <button
                className="modal-submit"
                disabled={
                  !nameDraft.trim() ||
                  !lastNameDraft.trim() ||
                  !countryDraft ||
                  !genderDraft ||
                  preferencesDraft.length === 0
                }
                onClick={confirmName}
              >
                <Check size={14} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />
                {t('field.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfilePage && profileTargetName && (
        <div className="profile-page">
          <div className="profile-page-scroll">
            <div
              className="profile-page-cover"
              style={profileCoverUrl ? { backgroundImage: `url(${profileCoverUrl})` } : undefined}
            ></div>
            <button
              className="profile-page-nav-btn profile-page-back"
              onClick={() => (isOwnProfile ? setShowProfilePage(false) : setViewedProfileName(null))}
              title={isOwnProfile ? t('auth.back') : t('profile.backToOwn')}
            >
              <ChevronRight size={18} style={{ transform: dir === 'rtl' ? 'none' : 'rotate(180deg)' }} />
            </button>
            {isOwnProfile && (
              <button className="profile-page-nav-btn profile-page-settings" onClick={() => setShowSettingsSheet(true)} title={t('settings.title')}>
                <Settings size={18} />
              </button>
            )}

            <div className="profile-page-avatar-wrap">
              <Avatar name={profileTargetName} avatarUrl={profileAvatarUrl} size={104} />
            </div>

            <div className="profile-page-body">
              <div className="profile-page-name">
                {profileTargetName} {profileLastName}
                {profileVerified && (
                  <span className="card-verified-badge" title={t('card.verified')}>
                    <ShieldCheck size={13} /> {t('card.verified')}
                  </span>
                )}
              </div>
              {myRatingStats && (
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <StarDisplay value={myRatingStats.avg} count={myRatingStats.count} size={14} />
                  {!isOwnProfile && (
                    <button
                      className={`follow-btn ${isFollowingProfile ? 'following' : ''}`}
                      onClick={() => toggleFollow(profileTargetName)}
                    >
                      {isFollowingProfile ? t('follow.following') : t('follow.follow')}
                    </button>
                  )}
                </div>
              )}
              {!myRatingStats && !isOwnProfile && (
                <div style={{ marginTop: 6 }}>
                  <button
                    className={`follow-btn ${isFollowingProfile ? 'following' : ''}`}
                    onClick={() => toggleFollow(profileTargetName)}
                  >
                    {isFollowingProfile ? t('follow.following') : t('follow.follow')}
                  </button>
                </div>
              )}
              <div className="profile-page-subtitle">
                {profileFollowersCount === 1 ? t('follow.followers', { count: profileFollowersCount }) : t('follow.followersPlural', { count: profileFollowersCount })}
              </div>
              {(profileCity || profileCountry) && (
                <div className="profile-page-subtitle">
                  <MapPin size={12} /> {[profileCity, profileCountry].filter(Boolean).join(', ')}
                </div>
              )}

              <div className="profile-stats-row">
                <button
                  className="profile-stat"
                  onClick={() => { if (!isOwnProfile) return; setShowProfilePage(false); setMineOnly(true); }}
                >
                  <div className="profile-stat-value">{organizedCount}</div>
                  <div className="profile-stat-label">{t('profile.organized')}</div>
                </button>
                <button
                  className="profile-stat"
                  onClick={() => { if (!isOwnProfile) return; setShowProfilePage(false); setMineOnly(true); }}
                >
                  <div className="profile-stat-value">{participatedCount}</div>
                  <div className="profile-stat-label">{t('profile.completed')}</div>
                </button>
                <button
                  className="profile-stat"
                  onClick={() => { if (!isOwnProfile) return; setShowProfilePage(false); setMineOnly(true); }}
                >
                  <div className="profile-stat-value">{myRatingStats ? myRatingStats.avg.toFixed(1) : '—'}</div>
                  <div className="profile-stat-label">{myRatingStats ? t('profile.avgRating') : t('profile.reviewsReceived')}</div>
                </button>
              </div>

              {profileBio && <div className="profile-bio">{profileBio}</div>}

              {profilePreferences.length > 0 && (
                <div className="profile-section">
                  <div className="profile-section-title">{t('profile.preferredActivities')}</div>
                  <div className="profile-activity-tags">
                    {profilePreferences.map((id) => {
                      const a = activityById(id);
                      return (
                        <span
                          key={id}
                          className="profile-activity-tag"
                          style={{ background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}55` }}
                        >
                          {aLabel(id)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="profile-section">
                <div className="profile-section-title">{t('profile.badges')}</div>
                <div className="profile-badges-grid">
                  {PROFILE_BADGES.map((b) => {
                    const BadgeIcon = b.icon;
                    return (
                      <div key={b.id} className={`profile-badge ${b.unlocked ? 'unlocked' : ''}`} title={b.hint}>
                        <div className="profile-badge-icon"><BadgeIcon size={20} /></div>
                        <div className="profile-badge-label">{b.label}</div>
                        {!b.unlocked && <div className="profile-badge-progress">{b.counter}/{b.threshold}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-title-row">
                  <div className="profile-section-title">{t('profile.history')}</div>
                  {isOwnProfile && profileHistory.length > 0 && (
                    <button
                      className="profile-section-link"
                      onClick={() => { setShowProfilePage(false); setMineOnly(true); }}
                    >
                      {t('profile.viewAll')} <ChevronRight size={13} style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
                    </button>
                  )}
                </div>
                {profileHistory.length === 0 ? (
                  <div className="near-city-empty">{t('profile.noHistory')}</div>
                ) : (
                  <div className="profile-history-list">
                    {profileHistory.map((m) => (
                      <div key={m.id} className="profile-history-row">
                        <span className="swatch" style={{ background: activityById(m.activity).color }}></span>
                        <div className="profile-history-mid">
                          <div className="profile-history-title">{m.title}</div>
                          <div className="profile-history-meta">
                            {formatWhen(m.datetime, language)} · {m.host === profileTargetName ? t('profile.organizedRole') : t('profile.participatedRole')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isOwnProfile && (
                <button
                  type="button"
                  className="profile-section-link profile-circle-link"
                  onClick={() => { setShowProfilePage(false); setShowCirclePage(true); }}
                >
                  <Users size={14} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />
                  {t('nav.myCircle')}
                  <ChevronRight size={13} style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : 'none', marginInlineStart: 4 }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCirclePage && userName && (
        <div className="profile-page">
          <div className="profile-page-scroll">
            <div className="circle-page-header">
              <button
                className="profile-page-nav-btn profile-page-back"
                style={{ position: 'static' }}
                onClick={() => setShowCirclePage(false)}
                title={t('auth.back')}
              >
                <ChevronRight size={18} style={{ transform: dir === 'rtl' ? 'none' : 'rotate(180deg)' }} />
              </button>
              <div className="circle-page-title">{t('circle.title')}</div>
            </div>
            <div className="circle-page-body">
              <div className="circle-page-subtitle">{t('circle.subtitle')}</div>
              {circleList.length === 0 ? (
                <div className="near-city-empty">{t('circle.empty')}</div>
              ) : (
                <div className="circle-list">
                  {circleList.map(({ name, count, lastDate }) => (
                    <button
                      key={name}
                      type="button"
                      className="circle-row"
                      onClick={() => { setShowCirclePage(false); setViewedProfileName(name); setShowProfilePage(true); }}
                    >
                      <Avatar name={name} avatarUrl={profilesMap[name]} size={44} />
                      <div className="circle-row-mid">
                        <div className="circle-row-name">{name}</div>
                        <div className="circle-row-meta">
                          {count === 1 ? t('circle.sharedMeetup', { count }) : t('circle.sharedMeetups', { count })}
                          {' · '}{t('circle.lastTogether', { date: formatWhen(lastDate, language) })}
                        </div>
                      </div>
                      <span className="circle-row-cta">
                        {t('circle.seeUpcoming')}
                        <ChevronRight size={13} style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettingsSheet && (
        <div className="modal-overlay" onClick={() => setShowSettingsSheet(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Settings size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7 }} />
                {t('settings.title')}
              </div>
              <button className="modal-close" onClick={() => setShowSettingsSheet(false)}><X size={18} /></button>
            </div>

            <button
              type="button"
              className="settings-row"
              onClick={() => { setShowSettingsSheet(false); openProfile(); }}
            >
              <Pencil size={15} /> {t('settings.editProfile')}
              <ChevronRight size={14} className="settings-row-chevron" style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
            </button>

            <div className="settings-row settings-row-lang">
              <Globe size={15} /> {t('settings.language')}
              <LanguageMenu
                language={language}
                onChange={setLanguage}
                open={langMenuOpen}
                onToggle={() => setLangMenuOpen((v) => !v)}
                align="right"
              />
            </div>

            {isPushSupported() && userEmail && (
              <div className="switch-row">
                <div>
                  <div className="switch-title">
                    {pushEnabled ? <Bell size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} /> : <BellOff size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />}
                    {t('settings.notifications')}
                  </div>
                  <div className="switch-subtitle">{t('settings.notificationsSub')}</div>
                </div>
                <button
                  className={`switch ${pushEnabled ? 'on' : ''}`}
                  role="switch"
                  aria-checked={pushEnabled}
                  disabled={pushBusy}
                  onClick={togglePush}
                >
                  <span className="switch-knob"></span>
                </button>
              </div>
            )}

            <div className="settings-section-label">{t('settings.privacy')}</div>
            <div className="switch-row">
              <div>
                <div className="switch-title">{t('settings.showFullName')}</div>
                <div className="switch-subtitle">{t('settings.showFullNameSub')}</div>
              </div>
              <button
                className={`switch ${userShowLastName ? 'on' : ''}`}
                role="switch"
                aria-checked={userShowLastName}
                onClick={toggleShowLastName}
              >
                <span className="switch-knob"></span>
              </button>
            </div>
            <div className="switch-row">
              <div>
                <div className="switch-title">{t('settings.showCity')}</div>
                <div className="switch-subtitle">{t('settings.showCitySub')}</div>
              </div>
              <button
                className={`switch ${userShowCity ? 'on' : ''}`}
                role="switch"
                aria-checked={userShowCity}
                onClick={toggleShowCity}
              >
                <span className="switch-knob"></span>
              </button>
            </div>

            <button
              type="button"
              className="modal-cancel settings-logout-btn"
              onClick={() => { setShowSettingsSheet(false); logout(); }}
            >
              <LogOut size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />
              {t('settings.logout')}
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId && (() => {
        const targetMeetup = meetups.find((m) => m.id === confirmDeleteId);
        const isSeries = !!(targetMeetup && targetMeetup.seriesId);
        return (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <div className="modal-title"><Trash2 size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--danger)' }} />{isSeries ? t('series.stopConfirmTitle') : t('modal.delete.title')}</div>
                <button className="modal-close" onClick={() => setConfirmDeleteId(null)}><X size={18} /></button>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                {isSeries ? t('series.stopConfirmBody') : t('modal.delete.body')}
              </div>
              {isSeries ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="modal-submit modal-submit-danger" onClick={() => deleteMeetup(confirmDeleteId, 'single')}>
                    {t('series.deleteThisOccurrence')}
                  </button>
                  <button className="modal-submit modal-submit-danger" onClick={() => deleteMeetup(confirmDeleteId, 'series')}>
                    {t('series.deleteWholeSeries')}
                  </button>
                  <button
                    className="modal-submit"
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    {t('modal.cancel')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="modal-submit"
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    {t('modal.cancel')}
                  </button>
                  <button className="modal-submit modal-submit-danger" onClick={() => deleteMeetup(confirmDeleteId, 'single')}>
                    {t('modal.delete.confirm')}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {seriesJoinChoice && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{t('series.joinChoiceTitle', { title: seriesJoinChoice.meetup.title })}</div>
              <button className="modal-close" onClick={() => setSeriesJoinChoice(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="modal-submit"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                onClick={async () => {
                  const { meetup, name, gender } = seriesJoinChoice;
                  setSeriesJoinChoice(null);
                  await performJoin(meetup, name, gender, false);
                }}
              >
                {t('series.joinOnce')}
              </button>
              <button
                className="modal-submit"
                onClick={async () => {
                  const { meetup, name, gender } = seriesJoinChoice;
                  setSeriesJoinChoice(null);
                  await performJoin(meetup, name, gender, true);
                }}
              >
                {t('series.joinAll')}
              </button>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.4 }}>
                {t('series.joinAllHint')}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportingMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title"><Flag size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--amber)' }} />{t('modal.report.title', { title: reportingMeetup.title })}</div>
              <button className="modal-close" onClick={() => setReportingMeetup(null)}><X size={18} /></button>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 14 }}>
              {t('modal.report.body')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  className="modal-submit"
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', textAlign: 'left' }}
                  onClick={() => submitReport(reportingMeetup, reason)}
                >
                  {t(`report.${reason}`)}
                </button>
              ))}
            </div>
            <button className="modal-cancel" onClick={() => setReportingMeetup(null)}>
              {t('modal.cancel')}
            </button>
          </div>
        </div>
      )}

      {invitingMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title"><UserPlus size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />{t('modal.invite.title')}</div>
              <button className="modal-close" onClick={() => setInvitingMeetup(null)}><X size={18} /></button>
            </div>

            <div className="field">
              <label>{t('invite.shareTitle')}</label>
              <div className="invite-preview">{inviteShareText(invitingMeetup)}</div>
              <div className="invite-share-row">
                <button className="avatar-upload-btn" onClick={() => copyInviteText(invitingMeetup)}>
                  <Copy size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />
                  {t('invite.copyMessage')}
                </button>
                <button className="avatar-upload-btn" onClick={() => shareInvite(invitingMeetup)}>
                  <Share2 size={13} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />
                  {t('invite.share')}
                </button>
              </div>
            </div>

            <div className="field">
              <label>{t('invite.addFriendLabel')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={inviteNameDraft}
                  onChange={(e) => setInviteNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && inviteFriendByName(invitingMeetup)}
                  placeholder={t('invite.friendPlaceholder')}
                  style={{ flex: 1 }}
                />
                <button
                  className="modal-submit"
                  style={{ width: 'auto', padding: '0 16px', marginTop: 0 }}
                  disabled={!inviteNameDraft.trim()}
                  onClick={() => inviteFriendByName(invitingMeetup)}
                >
                  {t('invite.inviteBtn')}
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {t('invite.pendingHint')}
              </span>
            </div>
            <button className="modal-cancel" onClick={() => setInvitingMeetup(null)}>
              {t('modal.close')}
            </button>
          </div>
        </div>
      )}

      {ratingMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title"><Star size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--amber)' }} />{t('modal.rate.title', { title: ratingMeetup.title })}</div>
              <button className="modal-close" onClick={() => dismissRatingPrompt(ratingMeetup.id)}><X size={18} /></button>
            </div>

            <div className="field" style={{ alignItems: 'center', textAlign: 'center' }}>
              <label>{t('modal.rate.hostLabel', { host: ratingMeetup.host })}</label>
              <StarPicker value={ratingHostStars} onChange={setRatingHostStars} />
            </div>

            <div className="field" style={{ alignItems: 'center', textAlign: 'center' }}>
              <label>{t('modal.rate.satisfactionLabel')}</label>
              <StarPicker value={ratingSatisfactionStars} onChange={setRatingSatisfactionStars} />
            </div>

            <button
              className="modal-submit"
              disabled={!ratingHostStars || !ratingSatisfactionStars}
              onClick={() => submitRating(ratingMeetup)}
            >
              {t('modal.rate.submit')}
            </button>
            <button className="modal-cancel" onClick={() => dismissRatingPrompt(ratingMeetup.id)}>
              {t('modal.later')}
            </button>
          </div>
        </div>
      )}

      {ongoingCheckMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                <Radio size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />
                {t('modal.ongoing.title', { title: ongoingCheckMeetup.title })}
              </div>
              <button className="modal-close" onClick={() => setOngoingCheckMeetup(null)}><X size={18} /></button>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              {meetupCheckinDueAt(ongoingCheckMeetup) !== null && now >= meetupCheckinDueAt(ongoingCheckMeetup)
                ? t('modal.ongoing.bodyOverdue')
                : t('modal.ongoing.bodyEarly')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="modal-submit"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                onClick={() => confirmStillOngoing(ongoingCheckMeetup)}
              >
                {t('modal.ongoing.stillGoing')}
              </button>
              <button className="modal-submit" onClick={() => closeMeetupNow(ongoingCheckMeetup)}>
                {t('modal.ongoing.finished')}
              </button>
            </div>
            <button className="modal-cancel" onClick={() => setOngoingCheckMeetup(null)}>
              {t('modal.cancel')}
            </button>
          </div>
        </div>
      )}

      {journeyMeetup && (
        <div className="modal-overlay">
          <div className="modal live-modal">
            <div className="modal-header">
              <div>
                <div className="modal-title"><Navigation size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />{t('journey.title')}</div>
                <div className="chat-subtitle">{journeyMeetup.title}</div>
              </div>
              <button
                className="modal-close"
                onClick={() => {
                  setJourneyMeetupId(null);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="live-host-card">
              <Avatar name={journeyMeetup.host} avatarUrl={profilesMap[journeyMeetup.host]} size={40} />
              <div className="live-host-info">
                <div className="live-host-name">
                  {journeyMeetup.host}
                  {hostRatingStats(journeyMeetup.host) && (
                    <StarDisplay value={hostRatingStats(journeyMeetup.host).avg} count={hostRatingStats(journeyMeetup.host).count} size={11} />
                  )}
                </div>
                <div className="live-host-sub">{t('journey.organizer')} · {journeyMeetup.location || journeyMeetup.zone || t('card.locationTBD')}</div>
              </div>
            </div>

            <div className="privacy-note">
              {t('journey.privacyNote')}
            </div>

            {userName && journeyMeetup.arrivals && journeyMeetup.arrivals[userName] ? (
              <div className="journey-arrived">
                <div className="journey-arrived-row">
                  <span className="live-status-chip arrived">{t('journey.arrived')}</span>
                  <span>
                    {t('journey.confirmedAt', {
                      time: new Date(journeyMeetup.arrivals[userName]).toLocaleTimeString(WHEN_LOCALES[language] || 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    })}
                  </span>
                </div>
                <button
                  className="journey-cancel-link"
                  onClick={() => cancelArrival(journeyMeetup, userName)}
                >
                  {t('journey.cancelArrival')}
                </button>
              </div>
            ) : (
              <>
                {journeyActive && (
                  <div className="journey-status">
                    {journeyDistance !== null
                      ? t('journey.enRoute', { distance: formatDistance(journeyDistance) })
                      : journeyMeetup.coords
                      ? t('journey.locating')
                      : t('journey.noExactLocation')}
                  </div>
                )}

                {journeyError && (
                  <div className="geo-error" style={{ padding: 0 }}>
                    {journeyError}
                  </div>
                )}

                <button
                  className={`live-cta ${journeyActive ? 'active' : ''}`}
                  onClick={() => (journeyActive ? stopJourney() : startJourney(journeyMeetup))}
                >
                  <Navigation size={16} />
                  {journeyActive ? t('journey.walking') : t('journey.imLeaving')}
                </button>

                <button className="journey-manual-btn" onClick={() => confirmArrivalManually(journeyMeetup)}>
                  {t('journey.alreadyArrived')}
                </button>
              </>
            )}

            {arrivalsList.length > 0 && (
              <div className="live-list">
                <div className="filters-row-label">
                  {t('journey.alreadyThere', { count: arrivalsList.length, total: journeyMeetup.participants.length })}
                </div>
                {arrivalsList.map((p) => (
                  <div key={p.name} className="live-list-row arrived">
                    <Avatar name={p.name} avatarUrl={profilesMap[p.name]} size={26} />
                    <div className="live-list-mid">
                      <div className="live-list-name">
                        {p.name}
                        {p.name === journeyMeetup.host && <span className="live-list-host-tag">{t('journey.organizer')}</span>}
                      </div>
                      <div className="live-list-time">
                        {t('journey.arrivedAt', { time: new Date(p.at).toLocaleTimeString(WHEN_LOCALES[language] || 'fr-FR', { hour: '2-digit', minute: '2-digit' }) })}
                      </div>
                    </div>
                    <span className="live-status-chip arrived">✓</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {chatMeetup && (
        <div className="modal-overlay">
          <div className="modal chat-modal">
            <div className="modal-header">
              <div>
                <div className="modal-title"><MessageCircle size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--live)' }} />{chatMeetup.title}</div>
                <div className="chat-subtitle">
                  {t(chatMeetup.participants.length > 1 ? 'chat.participants' : 'chat.participant', { count: chatMeetup.participants.length })}
                </div>
              </div>
              <button className="modal-close" onClick={() => setChatMeetup(null)}><X size={18} /></button>
            </div>

            <div className="chat-messages">
              {chatLoading ? (
                <div className="loading-state" style={{ padding: '30px 0' }}>
                  <Loader2 size={16} className="spin" /> {t('chat.loading')}
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="chat-empty">{t('chat.empty')}</div>
              ) : (
                chatMessages.map((msg) => {
                  const mine = userName && msg.author === userName;
                  return (
                    <div key={msg.id} className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
                      {!mine && <Avatar name={msg.author} avatarUrl={profilesMap[msg.author]} size={22} />}
                      <div className="chat-bubble">
                        {!mine && <div className="chat-author">{msg.author}</div>}
                        <div className="chat-text">{msg.text}</div>
                        <div className="chat-time">
                          {new Date(msg.sentAt).toLocaleTimeString(WHEN_LOCALES[language] || 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="chat-input-row">
              <input
                className="chat-input"
                placeholder={t('chat.placeholder')}
                value={chatInput}
                maxLength={500}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !chatSending && sendChatMessage()}
              />
              <button
                className="chat-send-btn"
                disabled={!chatInput.trim() || chatSending}
                onClick={sendChatMessage}
              >
                {chatSending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateModal({ onClose, onSubmit, saving, userCoords, userGender, initial, template, defaultZone, t, aLabel, audLabel, language, dir }) {
  const isEditing = !!initial;
  const [title, setTitle] = useState(initial?.title || template?.title || '');
  const [activity, setActivity] = useState(initial?.activity || template?.activity || ACTIVITIES[0].id);
  const [zone, setZone] = useState(initial?.zone || defaultZone || '');
  const [location, setLocation] = useState(initial?.location || '');
  // Coordonnées capturées via l'autocomplétion d'adresse (voir useGeoSuggest) : prioritaires sur la
  // simple case à cocher "épingler ma position actuelle" car précises même si l'organisateur ne se
  // trouve pas sur les lieux au moment de la création. Réinitialisées dès que le texte est modifié
  // à la main (la coordonnée précédente ne correspond plus forcément à ce qui est tapé).
  const [zoneCoords, setZoneCoords] = useState(null);
  const [locationCoords, setLocationCoords] = useState(null);
  const [zoneFocused, setZoneFocused] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const zoneSuggest = useGeoSuggest(zoneFocused ? zone : '', language);
  const locationSuggest = useGeoSuggest(locationFocused ? location : '', language);
  const [datetime, setDatetime] = useState(initial?.datetime || (template ? toDatetimeLocalValue(template.when()) : ''));
  const [maxParticipants, setMaxParticipants] = useState(initial?.maxParticipants || 8);
  const [note, setNote] = useState(initial?.note || template?.note || '');
  const [audience, setAudience] = useState(initial?.audience || 'mixte');
  const [ageMin, setAgeMin] = useState(initial?.ageMin || 18);
  const [ageMax, setAgeMax] = useState(initial?.ageMax || 99);
  const [useLocation, setUseLocation] = useState(isEditing ? !!initial?.coords : !!userCoords);
  // Récurrence : uniquement proposée à la création (pas en édition d'une occurrence existante) —
  // voir handleCreate pour la génération de la série et REZO_SERIES_CAP pour la limite de volume.
  const [recurrence, setRecurrence] = useState('none'); // 'none' | 'weekly' | 'biweekly' | 'monthly'
  const [recurrenceEndMode, setRecurrenceEndMode] = useState('ongoing'); // 'ongoing' | 'until'
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const minParticipants = Math.max(2, initial?.participants?.length || 2);
  const ageRangeValid = Number(ageMin) >= 16 && Number(ageMax) >= Number(ageMin);

  // Une femme ne peut proposer que Mixte / 100% Femmes ; un homme que Mixte / 100% Hommes.
  // Sexe inconnu (pas encore renseigné) : les 3 options restent visibles.
  const availableAudiences = AUDIENCE_OPTIONS.filter((a) => {
    if (a.id === 'mixte') return true;
    if (userGender === 'femme') return a.id === 'femmes';
    if (userGender === 'homme') return a.id === 'hommes';
    return true;
  });

  const isDateChanged = !isEditing || datetime !== initial?.datetime;
  const dateIsFuture = !datetime || !isDateChanged || new Date(datetime).getTime() > Date.now();
  const canSubmit = title.trim() && zone.trim() && datetime && dateIsFuture && ageRangeValid;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {isEditing ? <Pencil size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7 }} /> : <Sparkles size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 7, color: 'var(--amber)' }} />}
            {isEditing ? t('create.editTitle') : t('create.newTitle')}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="field">
          <FieldLabel icon={TypeIcon}>{t('create.titleLabel')}</FieldLabel>
          <input
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Foot 5 vs 5 en fin de journée"
          />
        </div>

        <div className="field">
          <FieldLabel>{t('create.activityLabel')}</FieldLabel>
          <div className="select-with-swatch">
            <span className="swatch" style={{ background: activityById(activity).color }}></span>
            <select value={activity} onChange={(e) => setActivity(e.target.value)}>
              {ACTIVITIES.map((a) => (
                <option key={a.id} value={a.id}>{aLabel(a.id)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <FieldLabel icon={MapPin}>{t('create.zoneLabel')}</FieldLabel>
          <div className="geo-suggest-wrap">
            <input
              value={zone}
              onChange={(e) => { setZone(e.target.value); setZoneCoords(null); }}
              onFocus={() => setZoneFocused(true)}
              onBlur={() => setTimeout(() => setZoneFocused(false), 150)}
              placeholder="Ex: Maarif, Casablanca"
            />
            {zoneFocused && zone.trim().length >= 3 && (zoneSuggest.loading || zoneSuggest.suggestions.length > 0) && (
              <div className="geo-suggest-list">
                {zoneSuggest.loading && zoneSuggest.suggestions.length === 0 ? (
                  <div className="geo-suggest-loading">{t('create.addressSearching')}</div>
                ) : (
                  <>
                    {zoneSuggest.suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="geo-suggest-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setZone(s.secondary ? `${s.primary}, ${s.secondary}` : s.primary);
                          setZoneCoords({ lat: s.lat, lng: s.lng });
                          setZoneFocused(false);
                        }}
                      >
                        <MapPin size={13} className="geo-suggest-pin" />
                        <span>
                          <span className="geo-suggest-primary">{s.primary}</span>
                          {s.secondary && <span className="geo-suggest-secondary">{s.secondary}</span>}
                        </span>
                      </button>
                    ))}
                    <div className="geo-suggest-attribution">{t('create.geoAttribution')}</div>
                  </>
                )}
              </div>
            )}
          </div>
          {zoneCoords && (
            <span className="geo-suggest-confirmed">
              <Check size={11} style={{ verticalAlign: '-1px' }} /> {t('create.geoCoordsCaptured')}
            </span>
          )}
        </div>

        <div className="field">
          <FieldLabel icon={Crosshair}>{t('create.locationLabel')}</FieldLabel>
          <div className="geo-suggest-wrap">
            <input
              value={location}
              maxLength={120}
              onChange={(e) => { setLocation(e.target.value); setLocationCoords(null); }}
              onFocus={() => setLocationFocused(true)}
              onBlur={() => setTimeout(() => setLocationFocused(false), 150)}
              placeholder="Ex: Terrain Al Amal, complexe sportif Anfa"
            />
            {locationFocused && location.trim().length >= 3 && (locationSuggest.loading || locationSuggest.suggestions.length > 0) && (
              <div className="geo-suggest-list">
                {locationSuggest.loading && locationSuggest.suggestions.length === 0 ? (
                  <div className="geo-suggest-loading">{t('create.addressSearching')}</div>
                ) : (
                  <>
                    {locationSuggest.suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="geo-suggest-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setLocation(s.secondary ? `${s.primary}, ${s.secondary}` : s.primary);
                          setLocationCoords({ lat: s.lat, lng: s.lng });
                          setLocationFocused(false);
                        }}
                      >
                        <MapPin size={13} className="geo-suggest-pin" />
                        <span>
                          <span className="geo-suggest-primary">{s.primary}</span>
                          {s.secondary && <span className="geo-suggest-secondary">{s.secondary}</span>}
                        </span>
                      </button>
                    ))}
                    <div className="geo-suggest-attribution">{t('create.geoAttribution')}</div>
                  </>
                )}
              </div>
            )}
          </div>
          {locationCoords ? (
            <span className="geo-suggest-confirmed">
              <Check size={11} style={{ verticalAlign: '-1px' }} /> {t('create.geoCoordsCaptured')}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {t('create.locationHint')}
            </span>
          )}
        </div>

        <div className="field">
          <FieldLabel icon={Users}>{t('create.typeLabel')}</FieldLabel>
          <div className="gender-options">
            {availableAudiences.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`gender-btn ${audience === a.id ? 'active' : ''}`}
                onClick={() => setAudience(a.id)}
              >
                {audLabel(a.id)}
              </button>
            ))}
          </div>
          {!userGender && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {t('create.genderHint')}
            </span>
          )}
        </div>

        <div className="field">
          <FieldLabel icon={Cake}>{t('create.ageRangeLabel')}</FieldLabel>
          <div className="age-range-row">
            <input
              type="number"
              min={16}
              max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              aria-label={t('create.ageMinLabel')}
            />
            <span className="age-range-sep">{t('filters.ageSep')}</span>
            <input
              type="number"
              min={16}
              max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              aria-label={t('create.ageMaxLabel')}
            />
            <span className="age-range-sep">{t('filters.ageUnit')}</span>
          </div>
          {!ageRangeValid && (
            <span style={{ fontSize: 11, color: 'var(--amber)' }}>
              {t('create.ageRangeError')}
            </span>
          )}
        </div>

        {userCoords && (
          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="useLocation"
              checked={useLocation}
              onChange={(e) => setUseLocation(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <label htmlFor="useLocation" style={{ margin: 0 }}>
              {t('create.pinLocation')}
            </label>
          </div>
        )}

        <div className="field">
          <FieldLabel icon={Clock}>{t('create.dateTimeLabel')}</FieldLabel>
          <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          {!dateIsFuture && (
            <span style={{ fontSize: 11, color: 'var(--amber)' }}>{t('create.dateFutureError')}</span>
          )}
        </div>

        {!isEditing && (
          <div className="field">
            <FieldLabel icon={Radio}>{t('create.repeatLabel')}</FieldLabel>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="none">{t('create.repeatNone')}</option>
              <option value="weekly">{t('create.repeatWeekly')}</option>
              <option value="biweekly">{t('create.repeatBiweekly')}</option>
              <option value="monthly">{t('create.repeatMonthly')}</option>
            </select>
            {recurrence !== 'none' && (
              <>
                <div className="gender-options" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={`gender-btn ${recurrenceEndMode === 'ongoing' ? 'active' : ''}`}
                    onClick={() => setRecurrenceEndMode('ongoing')}
                  >
                    {t('create.repeatOngoing')}
                  </button>
                  <button
                    type="button"
                    className={`gender-btn ${recurrenceEndMode === 'until' ? 'active' : ''}`}
                    onClick={() => setRecurrenceEndMode('until')}
                  >
                    {t('create.repeatUntilDate')}
                  </button>
                </div>
                {recurrenceEndMode === 'until' && (
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'block' }}>
                  {t('create.repeatHint', { cap: SERIES_OCCURRENCE_CAP })}
                </span>
              </>
            )}
          </div>
        )}

        <div className="field">
          <FieldLabel icon={Users}>{t('create.spotsLabel')}</FieldLabel>
          <input
            type="number"
            min={minParticipants}
            max={100}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
          {isEditing && minParticipants > 2 && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {t('create.spotsMinHint', { min: minParticipants })}
            </span>
          )}
        </div>

        <div className="field">
          <FieldLabel icon={AlignLeft}>{t('create.detailsLabel')}</FieldLabel>
          <textarea
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('create.detailsPlaceholder')}
          />
        </div>

        <button
          className="modal-submit"
          disabled={!canSubmit || saving}
          onClick={() => onSubmit({
            title, activity, zone, location, datetime, maxParticipants, note, useLocation, audience, ageMin, ageMax,
            recurrence: isEditing ? 'none' : recurrence,
            recurrenceEndDate: recurrenceEndMode === 'until' ? recurrenceEndDate : '',
            zoneCoords, locationCoords,
          })}
        >
          {saving ? t('create.saving') : isEditing ? t('create.saveEdit') : t('create.submit')}
        </button>
      </div>
    </div>
  );
}
