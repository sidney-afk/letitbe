// Le Mode Traversée (étape 5 du plan) : pendant la lecture, les photos des
// escales « affleurent » au passage du bateau — une carte qui monte
// doucement de l'eau, reste un instant, et se dissout. Chaque carte porte,
// quand elle existe, la légende écrite par la famille sous la photo.

import { chargeAlbums, albumsDeLEscale } from './albums.js';

const VIE_CARTE_MS = 3600;
const ENTRE_CARTES_MS = 1100;
// A short caption fits the little print; longer ones stay for the journal.
const LEGENDE_MAX = 90;

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

const legendeCourte = legende => typeof legende === 'string'
  && legende.trim().length >= 3 && legende.trim().length <= LEGENDE_MAX;

export function creerTraversee({ timeline, voyage, mouillagesParCle }) {
  const couche = document.getElementById('affleure');

  let dernierAffichage = 0;
  let dejaVues = new Set();
  let enCours = 0; // cartes actuellement à l'écran
  let albums = [];
  let albumsDemandes = false;

  function candidates(escale) {
    const photos = [];
    const m = mouillagesParCle.get(`${escale.nom}|${escale.date_arrivee}`);
    for (const a of m?.articles ?? []) {
      for (const im of a.images ?? []) photos.push({ src: im.src, legende: im.legende });
    }
    for (const album of albumsDeLEscale(albums, escale)) {
      for (const p of album.photos) photos.push({ src: p.src, legende: p.legende });
    }
    return photos;
  }

  function photoDe(escale) {
    const photos = candidates(escale);
    if (!photos.length) return null;
    // the family's own words when there are some; a new pick at every replay
    const legendees = photos.filter(p => legendeCourte(p.legende));
    const parmi = legendees.length ? legendees : photos;
    return parmi[Math.floor(Math.random() * parmi.length)];
  }

  function affleure(escale) {
    const photo = photoDe(escale);
    if (!photo) return;
    enCours++;
    const fig = document.createElement('figure');
    fig.className = 'affleure-carte';
    fig.style.setProperty('--derive', `${(Math.random() * 6 - 3).toFixed(1)}deg`);
    const img = document.createElement('img');
    img.src = `./media/${photo.src.replace(/\.[a-z]+$/i, '.webp')}`;
    img.alt = photo.legende || escale.nom;
    img.addEventListener('error', () => fig.remove());
    const cap = document.createElement('figcaption');
    if (legendeCourte(photo.legende)) {
      const mots = document.createElement('span');
      mots.className = 'affleure-legende';
      mots.textContent = photo.legende.trim();
      cap.append(mots);
    }
    const lieu = document.createElement('span');
    lieu.className = 'affleure-lieu';
    lieu.textContent = `${escale.nom} · ${formatCourt.format(
      new Date(escale.date_arrivee + 'T12:00:00Z'))}`;
    cap.append(lieu);
    fig.append(img, cap);
    couche.append(fig);
    setTimeout(() => {
      fig.classList.add('disparait');
      setTimeout(() => { fig.remove(); enCours--; }, 900);
    }, VIE_CARTE_MS);
  }

  timeline.surChangement((t) => {
    if (!timeline.enLecture) return;
    if (!albumsDemandes) {
      albumsDemandes = true;
      chargeAlbums().then((liste) => { albums = liste; });
    }
    const s = voyage.segmentA(t);
    const e = s.escale;
    if (!e || s.enMer || !e.date_arrivee) return;
    const cle = `${e.nom}|${e.date_arrivee}`;
    const maintenant = performance.now();
    if (dejaVues.has(cle) || enCours >= 2
      || maintenant - dernierAffichage < ENTRE_CARTES_MS) return;
    dejaVues.add(cle);
    dernierAffichage = maintenant;
    affleure(e);
  });

  // au rembarquement depuis le début, on a le droit de tout revoir
  timeline.surChangement((t) => {
    if (t <= voyage.debut + 1) dejaVues = new Set();
  });
}
