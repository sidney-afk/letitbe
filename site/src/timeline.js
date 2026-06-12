// La timeline : curseur temporel du départ à l'arrivée, lecture automatique
// (embryon du futur Mode Traversée — la timeline lui sert de barre de
// progression, comme prévu au plan).

const DUREE_LECTURE_S = 180; // les ~5 ans rejoués en 3 minutes

const formatDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

export function creerTimeline(voyage) {
  const curseur = document.getElementById('curseur');
  const labelDate = document.getElementById('date-courante');
  const labelLieu = document.getElementById('lieu-courant');
  const boutonLecture = document.getElementById('lecture');

  const duree = voyage.fin - voyage.debut;
  const vitesse = duree / (DUREE_LECTURE_S * 1000);

  let t = voyage.debut;
  let enLecture = false;
  const auditeurs = [];

  function notifie() {
    const f = (t - voyage.debut) / duree;
    curseur.value = f;
    curseur.parentElement.style.setProperty('--avancement', `${f * 100}%`);
    labelDate.textContent = formatDate.format(new Date(t));
    const s = voyage.segmentA(t);
    labelLieu.textContent = s.libelle;
    for (const fn of auditeurs) fn(t);
  }

  function vaA(instant, stopperLecture = false) {
    t = Math.min(Math.max(instant, voyage.debut), voyage.fin);
    if (stopperLecture) lecture(false);
    notifie();
  }

  function lecture(active) {
    enLecture = active ?? !enLecture;
    boutonLecture.classList.toggle('en-lecture', enLecture);
    boutonLecture.title = enLecture ? 'Jeter l’ancre' : 'Larguer les amarres';
    boutonLecture.setAttribute('aria-label', boutonLecture.title);
  }

  curseur.addEventListener('input', () => {
    lecture(false);
    vaA(voyage.debut + Number(curseur.value) * duree);
  });

  boutonLecture.addEventListener('click', () => {
    if (!enLecture && t >= voyage.fin - 1) t = voyage.debut; // on rembarque
    lecture();
  });

  function metAJour(dtMs) {
    if (!enLecture) return;
    t += dtMs * vitesse;
    if (t >= voyage.fin) {
      t = voyage.fin;
      lecture(false);
    }
    notifie();
  }

  notifie();

  return {
    get t() { return t; },
    get enLecture() { return enLecture; },
    vaA,
    metAJour,
    surChangement(fn) { auditeurs.push(fn); },
  };
}
