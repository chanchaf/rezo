import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Users, Clock, Plus, X, Radio, Check, Loader2, Navigation, Crosshair, Pencil, MessageCircle, Send,
  Settings, Flag, SlidersHorizontal, Dumbbell, Palette, Music, Gamepad2, HeartPulse, UtensilsCrossed, Sparkles, LayoutGrid,
  UserPlus, Copy, Share2, Star, ExternalLink,
} from 'lucide-react';

const ACTIVITIES = [
  { id: 'sport', label: 'Sport', color: '#F2A65A' },
  { id: 'culture', label: 'Culture', color: '#B08CE0' },
  { id: 'musique', label: 'Musique', color: '#EF7A9B' },
  { id: 'jeux', label: 'Jeux', color: '#4FD1C5' },
  { id: 'bienetre', label: 'Bien-être', color: '#7FCF9E' },
  { id: 'food', label: 'Food & Boissons', color: '#E8674F' },
  { id: 'autre', label: 'Autre', color: '#9AA0B4' },
];

const ACTIVITY_ICONS = {
  sport: Dumbbell,
  culture: Palette,
  musique: Music,
  jeux: Gamepad2,
  bienetre: HeartPulse,
  food: UtensilsCrossed,
  autre: Sparkles,
};

const activityById = (id) => ACTIVITIES.find((a) => a.id === id) || ACTIVITIES[ACTIVITIES.length - 1];

const MOROCCO_PRESETS = [
  { label: 'Casablanca centre', coords: { lat: 33.5731, lng: -7.5898 } },
  { label: 'Rabat', coords: { lat: 34.0209, lng: -6.8416 } },
  { label: 'Marrakech', coords: { lat: 31.6295, lng: -7.9811 } },
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

const REPORT_REASONS = [
  'Spam ou publicité',
  'Contenu inapproprié',
  'Rencontre suspecte / arnaque',
  'Faux profil ou usurpation',
  'Autre',
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const opts = { hour: '2-digit', minute: '2-digit' };
  if (sameDay) return `Aujourd'hui · ${d.toLocaleTimeString('fr-FR', opts)}`;
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', opts)}`;
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
          border: '2px solid #1C1F29',
          flexShrink: 0,
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
  const [lastSync, setLastSync] = useState(null);
  const [zoneQuery, setZoneQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('all');
  const [userName, setUserName] = useState(null);
  const [userGender, setUserGender] = useState(null);
  const [userPreferences, setUserPreferences] = useState([]);
  const [userAvatar, setUserAvatar] = useState(null);
  const [profilesMap, setProfilesMap] = useState({});
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [genderDraft, setGenderDraft] = useState('');
  const [preferencesDraft, setPreferencesDraft] = useState([]);
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarProcessing, setAvatarProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // fn to run after name is set
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [reportingMeetup, setReportingMeetup] = useState(null);
  const [invitingMeetup, setInvitingMeetup] = useState(null);
  const [inviteNameDraft, setInviteNameDraft] = useState('');
  const [ratingMeetup, setRatingMeetup] = useState(null);
  const [ratingHostStars, setRatingHostStars] = useState(0);
  const [ratingSatisfactionStars, setRatingSatisfactionStars] = useState(0);
  const [journeyMeetupId, setJourneyMeetupId] = useState(null);
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyError, setJourneyError] = useState(null);
  const [journeyDistance, setJourneyDistance] = useState(null);
  const watchIdRef = useRef(null);
  const arrivalsSeenRef = useRef({});
  const arrivalsInitRef = useRef(false);
  const [editingMeetup, setEditingMeetup] = useState(null);
  const [chatMeetup, setChatMeetup] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatSavingRef = useRef(false);
  const savingRef = useRef(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

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
      showToast("Erreur d'enregistrement, réessaie.");
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

  useEffect(() => {
    loadMeetups(false);
    loadProfiles(false);
    const interval = setInterval(() => {
      if (!savingRef.current) loadMeetups(true);
      loadProfiles(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadMeetups, loadProfiles]);

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
          showToast(`📍 ${name} est arrivé·e à "${m.title}"`);
        }
      });
    });
    arrivalsInitRef.current = true;
  }, [meetups, userName]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('rezo-username', false);
        if (res && res.value) setUserName(res.value);
      } catch (err) {
        // no name stored yet
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
        const res = await window.storage.get('rezo-coords', false);
        if (res && res.value) setUserCoords(JSON.parse(res.value));
      } catch (err) {
        // no coords stored yet
      }
    })();
  }, []);

  const applyManualCoords = async (coords) => {
    if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) {
      showToast('Coordonnées invalides.');
      return;
    }
    setUserCoords(coords);
    setLocationError(null);
    try {
      await window.storage.set('rezo-coords', JSON.stringify(coords), false);
    } catch (err) {
      // best effort
    }
    showToast('Position définie manuellement.');
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocating(false);
        try {
          await window.storage.set('rezo-coords', JSON.stringify(coords), false);
        } catch (err) {
          // best effort persistence
        }
        showToast('Position activée.');
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === 1
            ? 'Localisation refusée. Active-la dans les réglages du navigateur.'
            : "Impossible d'obtenir ta position."
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const requireName = (action) => {
    if (userName && userGender && userPreferences.length > 0) {
      action(userName, userGender);
      return;
    }
    setPendingAction(() => action);
    setNameDraft(userName || '');
    setGenderDraft(userGender || '');
    setPreferencesDraft(userPreferences.length > 0 ? userPreferences : []);
    setAvatarDraft(null);
    setShowNameModal(true);
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
      showToast("Impossible d'utiliser cette image.");
    } finally {
      setAvatarProcessing(false);
    }
  };

  const confirmName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !genderDraft || preferencesDraft.length === 0) return;
    const avatarRemoved = avatarDraft === '';
    const finalAvatar = avatarDraft ? avatarDraft : avatarRemoved ? null : userAvatar;
    try {
      await window.storage.set('rezo-username', trimmed, false);
      await window.storage.set('rezo-gender', genderDraft, false);
      await window.storage.set('rezo-preferences', JSON.stringify(preferencesDraft), false);
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
    } catch (err) {
      // continue even if persistence fails
    }
    setUserName(trimmed);
    setUserGender(genderDraft);
    setUserPreferences(preferencesDraft);
    setUserAvatar(finalAvatar);
    setAvatarDraft(null);
    setShowNameModal(false);
    if (pendingAction) {
      pendingAction(trimmed, genderDraft);
      setPendingAction(null);
    }
  };

  const handleCreate = (form) => {
    requireName(async (name, gender) => {
      let audience = form.audience || 'mixte';
      // Sécurité : une femme ne peut pas publier une rencontre 100% Hommes, et inversement,
      // même si le choix a été fait avant que le sexe soit confirmé.
      if (audience === 'hommes' && gender !== 'homme') audience = 'mixte';
      if (audience === 'femmes' && gender !== 'femme') audience = 'mixte';

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
                coords: form.useLocation && userCoords ? userCoords : m.coords,
              }
            : m
        );
        await saveMeetups(updated);
        setShowCreate(false);
        setEditingMeetup(null);
        showToast('Rencontre mise à jour !');
        return;
      }

      const newMeetup = {
        id: uid(),
        title: form.title.trim(),
        activity: form.activity,
        zone: form.zone.trim(),
        location: form.location.trim(),
        datetime: form.datetime,
        maxParticipants: Number(form.maxParticipants) || 8,
        note: form.note.trim(),
        host: name,
        hostGender: gender,
        audience,
        participants: [name],
        participantGenders: { [name]: gender },
        pendingRequests: [],
        createdAt: new Date().toISOString(),
        coords: form.useLocation && userCoords ? userCoords : null,
      };
      const updated = [newMeetup, ...meetups];
      await saveMeetups(updated);
      setShowCreate(false);
      showToast('Rencontre créée !');
    });
  };

  // "Rejoindre" envoie désormais une demande ; seul l'organisateur peut l'accepter.
  // Quitter une rencontre, en revanche, reste immédiat (pas d'approbation nécessaire).
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
        showToast('Tu as quitté la rencontre.');
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
        showToast('Demande annulée.');
        return;
      }

      if (meetup.participants.length >= meetup.maxParticipants) {
        showToast('Cette rencontre est complète.');
        return;
      }
      const audience = meetup.audience || 'mixte';
      if (audience === 'femmes' && gender !== 'femme') {
        showToast('Cette rencontre est réservée aux femmes.');
        return;
      }
      if (audience === 'hommes' && gender !== 'homme') {
        showToast('Cette rencontre est réservée aux hommes.');
        return;
      }

      const updated = meetups.map((m) =>
        m.id === meetup.id
          ? {
              ...m,
              pendingRequests: [...(m.pendingRequests || []), { name, gender, requestedAt: new Date().toISOString() }],
            }
          : m
      );
      await saveMeetups(updated);
      showToast("Demande envoyée à l'organisateur.");
    });
  };

  const respondToRequest = async (meetup, requesterName, accept) => {
    if (accept && meetup.participants.length >= meetup.maxParticipants) {
      showToast('Rencontre complète, impossible d’accepter.');
      return;
    }
    const updated = meetups.map((m) => {
      if (m.id !== meetup.id) return m;
      const request = (m.pendingRequests || []).find((r) => r.name === requesterName);
      const pendingRequests = (m.pendingRequests || []).filter((r) => r.name !== requesterName);
      if (!accept || !request) return { ...m, pendingRequests };
      const participantGenders = { ...(m.participantGenders || {}), [requesterName]: request.gender };
      return { ...m, pendingRequests, participants: [...m.participants, requesterName], participantGenders };
    });
    await saveMeetups(updated);
    showToast(accept ? `${requesterName} a été accepté·e.` : `Demande de ${requesterName} refusée.`);
  };

  const REPORT_THRESHOLD = 3;

  const submitReport = (meetup, reason) => {
    requireName(async (name) => {
      const already = (meetup.reports || []).some((r) => r.reporter === name);
      if (already) {
        showToast('Tu as déjà signalé cette rencontre.');
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
      showToast('Signalement envoyé, merci.');
    });
  };

  const inviteShareText = (meetup) =>
    `Rejoins-moi pour "${meetup.title}" (${activityById(meetup.activity).label}) le ${formatWhen(meetup.datetime)} à ${
      meetup.zone || 'un lieu à confirmer'
    }. Retrouve-moi sur RÉZO !`;

  const copyInviteText = async (meetup) => {
    try {
      await navigator.clipboard.writeText(inviteShareText(meetup));
      showToast('Message copié.');
    } catch (err) {
      showToast('Impossible de copier automatiquement.');
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
        showToast('Cette personne est déjà inscrite ou en attente.');
        return;
      }
      if (meetup.participants.length >= meetup.maxParticipants) {
        showToast('Rencontre complète, impossible d’inviter pour le moment.');
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
      showToast(`${trimmed} a été invité·e — en attente de validation par l'organisateur.`);
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

  const submitRating = (meetup) => {
    if (!ratingHostStars || !ratingSatisfactionStars) {
      showToast('Choisis une note pour les deux critères.');
      return;
    }
    requireName(async (name) => {
      if (name === meetup.host) {
        showToast("Tu ne peux pas te noter toi-même.");
        setRatingMeetup(null);
        return;
      }
      if (!meetup.participants.includes(name)) {
        showToast('Seuls les participants peuvent noter cette rencontre.');
        setRatingMeetup(null);
        return;
      }
      const already = (meetup.ratings || []).some((r) => r.rater === name);
      if (already) {
        showToast('Tu as déjà noté cette rencontre.');
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
      showToast('Merci pour ton avis !');
    });
  };

  const startMeetup = async (meetup) => {
    const updated = meetups.map((m) =>
      m.id === meetup.id ? { ...m, started: true, startedAt: new Date().toISOString() } : m
    );
    await saveMeetups(updated);
    showToast('Rencontre démarrée — chacun peut lancer son trajet.');
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
        const systemMsg = { id: uid(), author: 'RÉZO', text: `📍 ${name} est arrivé·e sur place.`, sentAt: new Date().toISOString(), system: true };
        await window.storage.set(`chat:${meetup.id}`, JSON.stringify([...(Array.isArray(chatList) ? chatList : []), systemMsg]), true);
      } catch (err) {
        // notification chat manquée, l'arrivée reste enregistrée
      }
    } catch (err) {
      showToast("Impossible d'enregistrer ton arrivée, réessaie.");
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
            showToast('Tu es arrivé·e !');
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
      showToast('Arrivée confirmée !');
    });
  };

  useEffect(() => stopJourney, []);

  const deleteMeetup = async (id) => {
    const updated = meetups.filter((m) => m.id !== id);
    await saveMeetups(updated);
    setConfirmDeleteId(null);
    showToast('Rencontre supprimée.');
    if (chatMeetup && chatMeetup.id === id) setChatMeetup(null);
  };

  const loadChat = useCallback(async (meetupId, silent) => {
    if (!silent) setChatLoading(true);
    try {
      const res = await window.storage.get(`chat:${meetupId}`, true);
      const list = res && res.value ? JSON.parse(res.value) : [];
      setChatMessages(Array.isArray(list) ? list : []);
    } catch (err) {
      setChatMessages([]);
    } finally {
      if (!silent) setChatLoading(false);
    }
  }, []);

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
        setChatInput('');
      } catch (err) {
        showToast("Message non envoyé, réessaie.");
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

  const withDistance = meetups.map((m) => ({
    ...m,
    _distance: userCoords && m.coords ? distanceKm(userCoords, m.coords) : null,
    _bearing: userCoords && m.coords ? bearingDeg(userCoords, m.coords) : null,
  }));

  const activeFilterCount = (selectedAudience !== 'all' ? 1 : 0) + (mineOnly ? 1 : 0) + (showPast ? 1 : 0);

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
  };

  const filtered = withDistance.filter((m) => {
    const isHostOfM = userName && m.host === userName;
    if ((m.reports || []).length >= REPORT_THRESHOLD && !isHostOfM) return false;
    const matchesActivity = selectedActivity === 'all' ? true : m.activity === selectedActivity;
    if (!matchesActivity) return false;
    const matchesAudience = selectedAudience === 'all' ? true : (m.audience || 'mixte') === selectedAudience;
    if (!matchesAudience) return false;
    if (!showPast && isPast(m)) return false;
    if (mineOnly && !(userName && (m.host === userName || m.participants.includes(userName)))) return false;
    const matchesZoneText = zoneQuery.trim()
      ? m.zone.toLowerCase().includes(zoneQuery.trim().toLowerCase())
      : true;
    // Si on a une position réelle et un rayon actif : les rencontres géolocalisées
    // doivent être dans le rayon ; celles sans coordonnées restent filtrées par le texte de zone.
    if (userCoords && m._distance !== null) {
      return m._distance <= radiusKm && matchesZoneText;
    }
    return matchesZoneText;
  });

  const grouped = ACTIVITIES.map((a) => ({
    ...a,
    items: filtered
      .filter((m) => m.activity === a.id)
      .sort((x, y) => {
        if (x._distance !== null && y._distance !== null) return x._distance - y._distance;
        if (x._distance !== null) return -1;
        if (y._distance !== null) return 1;
        return new Date(x.datetime) - new Date(y.datetime);
      }),
  })).filter((g) => g.items.length > 0);

  const recommended = userPreferences.length
    ? withDistance
        .filter((m) => userPreferences.includes(m.activity) && !isPast(m) && m.host !== userName)
        .sort((x, y) => {
          if (x._distance !== null && y._distance !== null) return x._distance - y._distance;
          return new Date(x.datetime) - new Date(y.datetime);
        })
        .slice(0, 6)
    : [];

  return (
    <div className="rezo-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

        .rezo-app {
          --ink: #12141C;
          --card: #1C1F29;
          --card-hover: #232735;
          --border: #2C3040;
          --text: #ECEEF3;
          --muted: #8B90A0;
          --live: #4FD1C5;
          --amber: #F2A65A;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          background: var(--ink);
          color: var(--text);
          min-height: 600px;
          border-radius: 16px;
          padding: 0;
          position: relative;
          overflow: hidden;
        }
        .rezo-display { font-family: 'Space Grotesk', 'Inter', sans-serif; }

        .rezo-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 22px 24px 16px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
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
          font-size: 12.5px; color: var(--live);
        }
        .rezo-live .pulse {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--live);
          box-shadow: 0 0 0 0 rgba(79,209,197,0.7);
          animation: pulse 1.8s infinite;
        }
        .header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .profile-btn {
          display: flex; align-items: center; gap: 6px;
          background: var(--card); border: 1px solid var(--border); color: var(--text);
          border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer;
          font-family: 'Inter', sans-serif; max-width: 160px;
        }
        .profile-btn:hover { border-color: var(--live); }
        .profile-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(79,209,197,0.55); }
          70% { box-shadow: 0 0 0 8px rgba(79,209,197,0); }
          100% { box-shadow: 0 0 0 0 rgba(79,209,197,0); }
        }

        .rezo-controls {
          display: flex; gap: 10px; padding: 14px 24px; flex-wrap: wrap;
          border-bottom: 1px solid var(--border);
          align-items: center;
        }
        .rezo-zone-input {
          display: flex; align-items: center; gap: 8px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 12px;
          min-width: 220px;
        }
        .rezo-zone-input input {
          background: transparent; border: none; outline: none;
          color: var(--text); font-size: 13.5px; width: 100%;
          font-family: 'Inter', sans-serif;
        }
        .rezo-zone-input input::placeholder { color: var(--muted); }

        .geo-btn {
          display: flex; align-items: center; gap: 6px;
          background: var(--card); border: 1px solid var(--border);
          color: var(--text); border-radius: 10px; padding: 8px 13px;
          font-size: 12.5px; font-family: 'Inter', sans-serif; cursor: pointer;
        }
        .geo-btn:hover { border-color: var(--live); }
        .geo-btn:disabled { opacity: 0.7; cursor: default; }

        .toggle-btn {
          background: var(--card); border: 1px solid var(--border);
          color: var(--muted); border-radius: 10px; padding: 8px 13px;
          font-size: 12.5px; font-family: 'Inter', sans-serif; cursor: pointer;
        }
        .toggle-btn:hover { border-color: #3A3F52; }
        .toggle-btn.active { background: var(--text); color: var(--ink); border-color: var(--text); font-weight: 600; }

        .filters-toggle {
          display: flex; align-items: center; gap: 6px;
          background: var(--card); border: 1px solid var(--border); color: var(--text);
          border-radius: 10px; padding: 8px 13px; font-size: 12.5px; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .filters-toggle:hover, .filters-toggle.active { border-color: var(--live); color: var(--live); }
        .filters-badge {
          background: var(--live); color: #0B1010; font-size: 10px; font-weight: 700;
          border-radius: 999px; min-width: 16px; height: 16px; display: flex;
          align-items: center; justify-content: center; padding: 0 4px;
        }

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

        /* Rangée de catégories façon Glovo : icônes rondes toujours visibles */
        .category-scroll {
          display: flex; gap: 16px; overflow-x: auto; padding: 14px 24px 6px;
        }
        .category-item {
          flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .category-icon {
          width: 52px; height: 52px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); transition: transform 0.12s ease;
        }
        .category-item:hover .category-icon { transform: translateY(-2px); }
        .category-item.active .category-icon { border-color: transparent; }
        .category-label {
          font-size: 10.5px; color: var(--muted); max-width: 60px; text-align: center;
          line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .category-item.active .category-label { color: var(--text); font-weight: 600; }

        /* Bottom sheet façon Tinder pour les filtres avancés */
        .sheet-overlay {
          position: absolute; inset: 0; background: rgba(8,9,13,0.72);
          display: flex; align-items: flex-end; justify-content: center; z-index: 25;
        }
        .sheet {
          width: 100%; background: var(--card); border-top: 1px solid var(--border);
          border-radius: 20px 20px 0 0; padding: 10px 22px 20px; max-height: 85%;
          overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
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
        .segmented-item.active { background: var(--live); color: #0B1010; font-weight: 600; }

        .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
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
        .switch.on .switch-knob { transform: translateX(18px); background: #0B1010; }

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
        .chip:hover { border-color: #3A3F52; }
        .chip.active { background: var(--text); color: var(--ink); border-color: var(--text); font-weight: 600; }
        .chip .swatch { width: 7px; height: 7px; border-radius: 50%; }

        .rezo-body { padding: 8px 24px 100px; max-height: 560px; overflow-y: auto; }

        .recommended-wrap { padding: 14px 24px 4px; }
        .recommended-title {
          font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600;
          margin-bottom: 10px; color: var(--amber);
        }
        .recommended-scroll {
          display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
        }
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
          padding: 14px;
          display: flex; flex-direction: column; gap: 10px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .card:hover { border-color: #3A3F52; background: var(--card-hover); }
        .card-title { font-weight: 600; font-size: 14.5px; line-height: 1.3; }
        .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
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
        .live-badge {
          align-self: flex-start; display: flex; align-items: center; gap: 5px;
          font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
          background: rgba(79,209,197,0.16); color: var(--live);
        }
        .live-badge .pulse {
          width: 6px; height: 6px; border-radius: 50%; background: var(--live);
          box-shadow: 0 0 0 0 rgba(79,209,197,0.7); animation: pulse 1.8s infinite;
        }
        .live-btn { border-color: var(--live); color: var(--live); }
        .avatars { display: flex; gap: -4px; }
        .avatars > *:not(:first-child) { margin-left: -6px; }
        .avatar {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--live); color: #0B1010; font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--card);
        }
        .avatar.more { background: var(--border); color: var(--muted); }
        .card-meta { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--muted); }
        .card-meta-row { display: flex; align-items: center; gap: 6px; }
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
        .join-btn.join { background: var(--live); color: #0B1010; }
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
        .pending-accept { background: var(--live); color: #0B1010; }
        .pending-reject { background: var(--border); color: var(--text); }

        .footer-actions { display: flex; align-items: center; gap: 6px; }
        .chat-icon-btn {
          background: var(--ink); border: 1px solid var(--border); color: var(--muted);
          border-radius: 8px; padding: 6px 8px; cursor: pointer; display: flex; align-items: center;
        }
        .chat-icon-btn:hover:not(:disabled) { border-color: var(--live); color: var(--live); }
        .chat-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
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

        .star-display { display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; }
        .star-display-value { font-size: 11px; color: var(--text); font-weight: 600; }
        .star-display-count { font-size: 10.5px; color: var(--muted); }

        .star-picker { display: flex; gap: 4px; justify-content: center; }
        .star-picker-btn { background: none; border: none; cursor: pointer; padding: 2px; }

        .rezo-empty {
          text-align: center; padding: 60px 20px; color: var(--muted);
        }
        .rezo-empty-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--text); margin-bottom: 6px; }

        .fab {
          position: absolute; bottom: 22px; right: 24px;
          background: var(--amber); color: #14161C;
          border: none; border-radius: 999px;
          width: 52px; height: 52px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.35);
          transition: transform 0.15s ease;
        }
        .fab:hover { transform: scale(1.06); }

        .modal-overlay {
          position: absolute; inset: 0; background: rgba(8,9,13,0.72);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 20;
        }
        .modal {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px; width: 100%; max-width: 380px;
          max-height: 90%; overflow-y: auto;
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .modal-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 600; }
        .modal-close { background: none; border: none; color: var(--muted); cursor: pointer; }

        .field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
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
        .gender-btn:hover { border-color: #3A3F52; }
        .gender-btn.active { background: var(--live); color: #0B1010; border-color: var(--live); font-weight: 600; }

        .pref-options { display: flex; gap: 6px; flex-wrap: wrap; }
        .pref-chip {
          display: flex; align-items: center; gap: 6px;
          background: var(--ink); border: 1px solid var(--border); color: var(--muted);
          border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .pref-chip:hover { border-color: #3A3F52; }
        .pref-chip.active { background: var(--text); color: var(--ink); border-color: var(--text); font-weight: 600; }
        .pref-chip .swatch { width: 7px; height: 7px; border-radius: 50%; }

        .avatar-picker { display: flex; align-items: center; gap: 12px; }
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

        .invite-preview {
          background: var(--ink); border: 1px solid var(--border); border-radius: 8px;
          padding: 10px 12px; font-size: 12.5px; color: var(--muted); line-height: 1.4;
          margin-bottom: 8px;
        }
        .invite-share-row { display: flex; gap: 8px; }
        .invite-share-row .avatar-upload-btn { flex: 1; text-align: center; }

        .modal-submit {
          width: 100%; padding: 11px; border: none; border-radius: 9px;
          background: var(--amber); color: #14161C; font-weight: 600; font-size: 13.5px;
          cursor: pointer; margin-top: 4px; font-family: 'Inter', sans-serif;
        }
        .modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }

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
          background: var(--live); color: #0B1010; font-weight: 700; font-size: 13.5px;
          font-family: 'Inter', sans-serif;
        }
        .live-cta.active { background: rgba(79,209,197,0.16); color: var(--live); border: 1px solid var(--live); }

        .privacy-note {
          font-size: 11px; color: var(--muted); background: var(--ink); border: 1px solid var(--border);
          border-radius: 10px; padding: 8px 10px; line-height: 1.4;
        }
        .journey-status {
          text-align: center; font-size: 12.5px; color: var(--live); font-weight: 600;
          background: rgba(79,209,197,0.08); border: 1px solid rgba(79,209,197,0.3);
          border-radius: 10px; padding: 9px;
        }
        .journey-arrived {
          display: flex; align-items: center; gap: 8px; justify-content: center;
          font-size: 12.5px; color: var(--muted);
        }
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
        .chat-bubble-row.mine .chat-bubble { background: var(--live); color: #0B1010; border-color: var(--live); }
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
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #0B1010;
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

        .rezo-body::-webkit-scrollbar { width: 6px; }
        .rezo-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="rezo-header">
        <div>
          <div className="rezo-brand">RÉZO<span className="dot">·</span></div>
          <div className="rezo-tagline">Rencontres par activité, près de toi, à l'instant</div>
        </div>
        <div className="header-right">
          <div className="rezo-live">
            <span className="pulse"></span>
            En direct{lastSync ? ` · sync ${lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
          <button
            className="profile-btn"
            title={userName ? `${userName} · Modifier le profil` : 'Créer mon profil'}
            onClick={() => {
              if (userName && userGender && userPreferences.length > 0) {
                setPendingAction(null);
                setNameDraft(userName);
                setGenderDraft(userGender);
                setPreferencesDraft(userPreferences);
                setAvatarDraft(null);
                setShowNameModal(true);
              } else {
                requireName(() => {});
              }
            }}
          >
            {userName ? <Avatar name={userName} avatarUrl={userAvatar} size={16} /> : <Settings size={14} />}
            {userName || 'Profil'}
          </button>
        </div>
      </div>

      <div className="category-scroll">
        <button
          className={`category-item ${selectedActivity === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedActivity('all')}
        >
          <span className="category-icon" style={{ background: selectedActivity === 'all' ? 'var(--live)' : 'var(--card)' }}>
            <LayoutGrid size={20} color={selectedActivity === 'all' ? '#0B1010' : 'var(--muted)'} />
          </span>
          <span className="category-label">Toutes</span>
        </button>
        {ACTIVITIES.map((a) => {
          const Icon = ACTIVITY_ICONS[a.id] || Sparkles;
          const active = selectedActivity === a.id;
          return (
            <button key={a.id} className={`category-item ${active ? 'active' : ''}`} onClick={() => setSelectedActivity(a.id)}>
              <span className="category-icon" style={{ background: active ? a.color : 'var(--card)' }}>
                <Icon size={20} color={active ? '#12141C' : 'var(--muted)'} />
              </span>
              <span className="category-label">{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rezo-controls">
        <div className="rezo-zone-input">
          <MapPin size={14} color="var(--muted)" />
          <input
            placeholder="Filtrer par zone (ex: Maarif, Casablanca)"
            value={zoneQuery}
            onChange={(e) => setZoneQuery(e.target.value)}
          />
        </div>

        {/* Géolocalisation temporairement désactivée — décommenter pour la réactiver
        <button className="geo-btn" onClick={requestLocation} disabled={locating}>
          {locating ? <Loader2 size={13} className="spin" /> : <Navigation size={13} />}
          {userCoords ? 'Position activée' : locating ? 'Localisation…' : 'Activer ma position'}
        </button>
        */}

        {/* Rayon de recherche temporairement désactivé (lié à la géoloc) — décommenter avec la position
        {userCoords && (
          <div className="radius-control">
            <span>Rayon : {radiusKm} km</span>
            <input
              type="range"
              min={1}
              max={30}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            />
          </div>
        )}
        */}

        <button className={`filters-toggle ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={13} />
          Filtres
          {activeFilterCount > 0 && <span className="filters-badge">{activeFilterCount}</span>}
        </button>
      </div>
        {false && locationError && (
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

      {filtersOpen && (
        <div className="sheet-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <div className="modal-title">Filtres</div>
              <button className="modal-close" onClick={() => setFiltersOpen(false)}><X size={18} /></button>
            </div>

            <div className="sheet-section">
              <div className="filters-row-label">Type de rencontre</div>
              <div className="segmented">
                <button
                  className={`segmented-item ${selectedAudience === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedAudience('all')}
                >
                  Tous
                </button>
                {AUDIENCE_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    className={`segmented-item ${selectedAudience === a.id ? 'active' : ''}`}
                    onClick={() => setSelectedAudience(a.id)}
                  >
                    {a.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-section">
              <div className="switch-row">
                <div>
                  <div className="switch-title">Mes rencontres</div>
                  <div className="switch-subtitle">N'afficher que celles que j'organise ou rejoins</div>
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
              <div className="switch-row">
                <div>
                  <div className="switch-title">Voir les passées</div>
                  <div className="switch-subtitle">Inclure les rencontres déjà terminées</div>
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
            </div>

            <div className="sheet-footer">
              <button className="filters-reset" onClick={resetFilters}>
                Réinitialiser
              </button>
              <button className="modal-submit sheet-apply" onClick={() => setFiltersOpen(false)}>
                Voir les résultats
              </button>
            </div>
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div className="recommended-wrap">
          <div className="recommended-title">Recommandé pour toi</div>
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
                    {m.zone || 'Zone non précisée'} · {formatWhen(m.datetime)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rezo-body">
        {loading ? (
          <div className="loading-state">
            <Loader2 size={16} className="spin" /> Chargement des rencontres…
          </div>
        ) : grouped.length === 0 ? (
          <div className="rezo-empty">
            <div className="rezo-empty-title">Aucune rencontre ici pour l'instant</div>
            <div>Sois le premier à lancer une activité dans cette zone.</div>
          </div>
        ) : (
          grouped.map((g) => (
            <div className="rezo-section" key={g.id}>
              <div className="rezo-section-title">
                <span className="swatch" style={{ background: g.color }}></span>
                {g.label} · {g.items.length}
              </div>
              <div className="rezo-grid">
                {g.items.map((m) => {
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
                  const past = isPast(m);
                  const pendingRequests = m.pendingRequests || [];
                  const hostStats = hostRatingStats(m.host);
                  const satisfactionStats = meetupSatisfactionStats(m);
                  const alreadyRated = userName && (m.ratings || []).some((r) => r.rater === userName);
                  const canRate = past && isIn && !isHost && !alreadyRated;
                  return (
                    <div className={`card ${past ? 'card-past' : ''}`} key={m.id}>
                      <div className="card-top">
                        <div className="card-title">{m.title}</div>
                        {isHost && (
                          <div className="card-actions">
                            <button
                              className="delete-btn"
                              title="Modifier"
                              onClick={() => {
                                setEditingMeetup(m);
                                setShowCreate(true);
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button className="delete-btn" title="Supprimer" onClick={() => setConfirmDeleteId(m.id)}>
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                      {audience !== 'mixte' && (
                        <span className={`audience-badge audience-${audience}`}>
                          {audience === 'femmes' ? '100% Femmes' : '100% Hommes'}
                        </span>
                      )}
                      {m.started && !past && (
                        <span className="live-badge">
                          <span className="pulse"></span> En cours
                        </span>
                      )}
                      <div className="card-meta">
                        <div className="card-meta-row">
                          <MapPin size={12} /> {m.location ? `${m.location} · ${m.zone || ''}` : m.zone || 'Zone non précisée'}
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
                            <ExternalLink size={11} /> Voir sur la carte
                          </a>
                        )}
                        <div className="card-meta-row"><Clock size={12} /> {formatWhen(m.datetime)}{past && ' · Terminée'}</div>
                        <div className="card-meta-row">
                          Organisé par {m.host}{isHost ? ' (toi)' : ''}
                          {hostStats && <StarDisplay value={hostStats.avg} count={hostStats.count} size={11} />}
                        </div>
                        {satisfactionStats && (
                          <div className="card-meta-row">
                            Satisfaction <StarDisplay value={satisfactionStats.avg} count={satisfactionStats.count} size={11} />
                          </div>
                        )}
                      </div>
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
                            {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente
                          </div>
                          {pendingRequests.map((r) => (
                            <div className="pending-row" key={r.name}>
                              <span>
                                {r.name}
                                {r.invitedBy && <span className="pending-invited-by"> · invité·e par {r.invitedBy}</span>}
                              </span>
                              <div className="pending-actions">
                                <button
                                  className="pending-accept"
                                  title="Accepter"
                                  onClick={() => respondToRequest(m, r.name, true)}
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  className="pending-reject"
                                  title="Refuser"
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
                              title="Signaler cette rencontre"
                              onClick={() => setReportingMeetup(m)}
                            >
                              <Flag size={13} />
                            </button>
                          )}
                          <button
                            className="chat-icon-btn"
                            disabled={!isIn && !isHost}
                            title={isIn || isHost ? 'Discussion du groupe' : 'Réservé aux membres acceptés'}
                            onClick={() => openChat(m)}
                          >
                            <MessageCircle size={14} />
                          </button>
                          {(isIn || isHost) && (
                            <button
                              className="chat-icon-btn"
                              title="Inviter des amis"
                              onClick={() => {
                                setInvitingMeetup(m);
                                setInviteNameDraft('');
                              }}
                            >
                              <UserPlus size={14} />
                            </button>
                          )}
                          {isHost && !m.started && !past && (
                            <button className="rate-btn" title="Démarrer la rencontre" onClick={() => startMeetup(m)}>
                              <Radio size={13} />
                              Démarrer
                            </button>
                          )}
                          {m.started && (isIn || isHost) && (
                            <button
                              className="chat-icon-btn live-btn"
                              title="Mon trajet vers la rencontre"
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
                              Noter
                            </button>
                          )}
                          <button
                            className={`join-btn ${
                              isFull || genderBlocked ? 'full' : isIn ? 'leave' : isPending ? 'pending' : 'join'
                            }`}
                            disabled={isFull || genderBlocked}
                            title={genderBlocked ? `Réservé ${audience === 'femmes' ? 'aux femmes' : 'aux hommes'}` : undefined}
                            onClick={() => requestOrLeave(m)}
                          >
                            {isIn
                              ? 'Quitter'
                              : isPending
                              ? 'Annuler la demande'
                              : isFull
                              ? 'Complet'
                              : genderBlocked
                              ? 'Non éligible'
                              : 'Demander à rejoindre'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => requireName(() => setShowCreate(true))} aria-label="Créer une rencontre">
        <Plus size={22} />
      </button>

      {showCreate && (
        <CreateModal
          onClose={() => {
            setShowCreate(false);
            setEditingMeetup(null);
          }}
          onSubmit={handleCreate}
          saving={saving}
          userCoords={userCoords}
          userGender={userGender}
          initial={editingMeetup}
        />
      )}

      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Ton profil</div>
              <button className="modal-close" onClick={() => setShowNameModal(false)}><X size={18} /></button>
            </div>
            <div className="field">
              <label>Photo de profil (optionnel)</label>
              <div className="avatar-picker">
                <Avatar
                  name={nameDraft || userName || '?'}
                  avatarUrl={avatarDraft !== null ? avatarDraft : userAvatar}
                  size={52}
                />
                <label className="avatar-upload-btn">
                  {avatarProcessing ? 'Traitement…' : 'Choisir une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleAvatarFile(e.target.files && e.target.files[0])}
                  />
                </label>
                {(avatarDraft || userAvatar) && (
                  <button
                    type="button"
                    className="avatar-remove-btn"
                    onClick={() => setAvatarDraft('')}
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
            <div className="field">
              <label>Ton prénom ou pseudo</label>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Ex: Yassine"
              />
            </div>
            <div className="field">
              <label>Sexe *</label>
              <div className="gender-options">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`gender-btn ${genderDraft === g.id ? 'active' : ''}`}
                    onClick={() => setGenderDraft(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Activités qui t'intéressent * (au moins une)</label>
              <div className="pref-options">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`pref-chip ${preferencesDraft.includes(a.id) ? 'active' : ''}`}
                    onClick={() => togglePreference(a.id)}
                  >
                    <span className="swatch" style={{ background: a.color }}></span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="modal-submit"
              disabled={!nameDraft.trim() || !genderDraft || preferencesDraft.length === 0}
              onClick={confirmName}
            >
              <Check size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Continuer
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Supprimer cette rencontre ?</div>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)}><X size={18} /></button>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Cette action est définitive. Les participants ne seront plus prévenus.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="modal-submit"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
                onClick={() => setConfirmDeleteId(null)}
              >
                Annuler
              </button>
              <button className="modal-submit" onClick={() => deleteMeetup(confirmDeleteId)}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {reportingMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Signaler "{reportingMeetup.title}"</div>
              <button className="modal-close" onClick={() => setReportingMeetup(null)}><X size={18} /></button>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 14 }}>
              Choisis le motif qui correspond le mieux. L'équipe est notifiée dès qu'un signalement est reçu.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  className="modal-submit"
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', textAlign: 'left' }}
                  onClick={() => submitReport(reportingMeetup, reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {invitingMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Inviter des amis</div>
              <button className="modal-close" onClick={() => setInvitingMeetup(null)}><X size={18} /></button>
            </div>

            <div className="field">
              <label>Partager la rencontre</label>
              <div className="invite-preview">{inviteShareText(invitingMeetup)}</div>
              <div className="invite-share-row">
                <button className="avatar-upload-btn" onClick={() => copyInviteText(invitingMeetup)}>
                  <Copy size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                  Copier le message
                </button>
                <button className="avatar-upload-btn" onClick={() => shareInvite(invitingMeetup)}>
                  <Share2 size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                  Partager
                </button>
              </div>
            </div>

            <div className="field">
              <label>Ou ajoute directement un·e ami·e par son prénom</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={inviteNameDraft}
                  onChange={(e) => setInviteNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && inviteFriendByName(invitingMeetup)}
                  placeholder="Prénom de ton ami·e"
                  style={{ flex: 1 }}
                />
                <button
                  className="modal-submit"
                  style={{ width: 'auto', padding: '0 16px', marginTop: 0 }}
                  disabled={!inviteNameDraft.trim()}
                  onClick={() => inviteFriendByName(invitingMeetup)}
                >
                  Inviter
                </button>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Il/elle apparaîtra en attente de validation par l'organisateur, avec la mention "invité·e par toi".
              </span>
            </div>
          </div>
        </div>
      )}

      {ratingMeetup && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Ton avis sur "{ratingMeetup.title}"</div>
              <button className="modal-close" onClick={() => setRatingMeetup(null)}><X size={18} /></button>
            </div>

            <div className="field" style={{ alignItems: 'center', textAlign: 'center' }}>
              <label>Note pour l'organisateur ({ratingMeetup.host})</label>
              <StarPicker value={ratingHostStars} onChange={setRatingHostStars} />
            </div>

            <div className="field" style={{ alignItems: 'center', textAlign: 'center' }}>
              <label>Satisfaction globale de la rencontre</label>
              <StarPicker value={ratingSatisfactionStars} onChange={setRatingSatisfactionStars} />
            </div>

            <button
              className="modal-submit"
              disabled={!ratingHostStars || !ratingSatisfactionStars}
              onClick={() => submitRating(ratingMeetup)}
            >
              Envoyer mon avis
            </button>
          </div>
        </div>
      )}

      {journeyMeetup && (
        <div className="modal-overlay">
          <div className="modal live-modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Mon trajet</div>
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
                <div className="live-host-sub">Organisateur · {journeyMeetup.location || journeyMeetup.zone || 'Lieu à confirmer'}</div>
              </div>
            </div>

            <div className="privacy-note">
              🔒 Ta position n'est jamais partagée avec les autres membres — seule ton arrivée sur place leur est signalée.
            </div>

            {userName && journeyMeetup.arrivals && journeyMeetup.arrivals[userName] ? (
              <div className="journey-arrived">
                <span className="live-status-chip arrived">Arrivé·e</span>
                <span>
                  Confirmé à{' '}
                  {new Date(journeyMeetup.arrivals[userName]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : (
              <>
                {journeyActive && (
                  <div className="journey-status">
                    {journeyDistance !== null
                      ? `En route · encore ${formatDistance(journeyDistance)}`
                      : journeyMeetup.coords
                      ? 'Localisation en cours…'
                      : "L'organisateur n'a pas épinglé le lieu exact : confirme ton arrivée manuellement en bas."}
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
                  {journeyActive ? 'Trajet en cours · Toucher pour arrêter' : 'Je pars'}
                </button>

                <button className="journey-manual-btn" onClick={() => confirmArrivalManually(journeyMeetup)}>
                  Je suis déjà arrivé·e
                </button>
              </>
            )}

            {arrivalsList.length > 0 && (
              <div className="live-list">
                <div className="filters-row-label">
                  Déjà sur place ({arrivalsList.length}/{journeyMeetup.participants.length})
                </div>
                {arrivalsList.map((p) => (
                  <div key={p.name} className="live-list-row arrived">
                    <Avatar name={p.name} avatarUrl={profilesMap[p.name]} size={26} />
                    <div className="live-list-mid">
                      <div className="live-list-name">
                        {p.name}
                        {p.name === journeyMeetup.host && <span className="live-list-host-tag">Organisateur</span>}
                      </div>
                      <div className="live-list-time">
                        Arrivé·e à {new Date(p.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
                <div className="modal-title">{chatMeetup.title}</div>
                <div className="chat-subtitle">
                  {chatMeetup.participants.length} participant{chatMeetup.participants.length > 1 ? 's' : ''}
                </div>
              </div>
              <button className="modal-close" onClick={() => setChatMeetup(null)}><X size={18} /></button>
            </div>

            <div className="chat-messages">
              {chatLoading ? (
                <div className="loading-state" style={{ padding: '30px 0' }}>
                  <Loader2 size={16} className="spin" /> Chargement…
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="chat-empty">Aucun message pour l'instant. Lance la discussion !</div>
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
                          {new Date(msg.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
                placeholder="Écris un message…"
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

function CreateModal({ onClose, onSubmit, saving, userCoords, userGender, initial }) {
  const isEditing = !!initial;
  const [title, setTitle] = useState(initial?.title || '');
  const [activity, setActivity] = useState(initial?.activity || ACTIVITIES[0].id);
  const [zone, setZone] = useState(initial?.zone || '');
  const [location, setLocation] = useState(initial?.location || '');
  const [datetime, setDatetime] = useState(initial?.datetime || '');
  const [maxParticipants, setMaxParticipants] = useState(initial?.maxParticipants || 8);
  const [note, setNote] = useState(initial?.note || '');
  const [audience, setAudience] = useState(initial?.audience || 'mixte');
  const [useLocation, setUseLocation] = useState(isEditing ? !!initial?.coords : !!userCoords);

  const minParticipants = Math.max(2, initial?.participants?.length || 2);

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
  const canSubmit = title.trim() && zone.trim() && datetime && dateIsFuture;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEditing ? 'Modifier la rencontre' : 'Lancer une rencontre'}</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="field">
          <label>Titre</label>
          <input
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Foot 5 vs 5 en fin de journée"
          />
        </div>

        <div className="field">
          <label>Activité</label>
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITIES.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Zone géographique</label>
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Maarif, Casablanca" />
        </div>

        <div className="field">
          <label>Lieu précis (optionnel)</label>
          <input
            value={location}
            maxLength={120}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex: Terrain Al Amal, complexe sportif Anfa"
          />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Génère un lien "Voir sur la carte" pour aider les participants à te trouver.
          </span>
        </div>

        <div className="field">
          <label>Type de rencontre</label>
          <div className="gender-options">
            {availableAudiences.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`gender-btn ${audience === a.id ? 'active' : ''}`}
                onClick={() => setAudience(a.id)}
              >
                {a.short}
              </button>
            ))}
          </div>
          {!userGender && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Ton sexe sera demandé à la validation pour confirmer ce choix.
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
              Épingler ma position GPS actuelle sur cette rencontre
            </label>
          </div>
        )}

        <div className="field">
          <label>Date et heure</label>
          <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          {!dateIsFuture && (
            <span style={{ fontSize: 11, color: 'var(--amber)' }}>La date doit être dans le futur.</span>
          )}
        </div>

        <div className="field">
          <label>Nombre de places</label>
          <input
            type="number"
            min={minParticipants}
            max={100}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          />
          {isEditing && minParticipants > 2 && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Ne peut pas descendre sous {minParticipants} (participants déjà inscrits).
            </span>
          )}
        </div>

        <div className="field">
          <label>Détails (optionnel)</label>
          <textarea
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lieu précis, niveau, matériel à apporter…"
          />
        </div>

        <button
          className="modal-submit"
          disabled={!canSubmit || saving}
          onClick={() => onSubmit({ title, activity, zone, location, datetime, maxParticipants, note, useLocation, audience })}
        >
          {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer les modifications' : 'Créer la rencontre'}
        </button>
      </div>
    </div>
  );
}
