// Le Mode Traversée (étape 5 du plan) : pendant la lecture, les photos des
// escales « affleurent » au passage du bateau — une carte qui monte
// doucement de l'eau, reste un instant, et se dissout.

const VIE_CARTE_MS = 3600;
const ENTRE_CARTES_MS = 1100;

const formatCourt = new Intl.DateTimeFormat('fr-FR', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

export function creerTraversee({ timeline, voyage, mouillagesParCle }) {
  const couche = document.getElementById('affleure');

  let dernierAffichage = 0;
  let dejaVues = new Set();
  let enCours = 0; // cartes actuellement à l'écran

  function photoDe(escale) {
    const m = mouillagesParCle.get(`${escale.nom}|${escale.date_arrivee}`);
    if (!m) return null;
    for (const a of m.articles ?? []) {
      if (a.images.length) {
        return { src: a.images[0].src, legende: a.images[0].legende, m };
      }
    }
    return null;
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
    cap.textContent = `${escale.nom} · ${formatCourt.format(
      new Date(escale.date_arrivee + 'T12:00:00Z'))}`;
    fig.append(img, cap);
    couche.append(fig);
    setTimeout(() => {
      fig.classList.add('disparait');
      setTimeout(() => { fig.remove(); enCours--; }, 900);
    }, VIE_CARTE_MS);
  }

  timeline.surChangement((t) => {
    if (!timeline.enLecture) return;
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
