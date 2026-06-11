// Le mode Récit (étape 4 du plan) : le défilement pilote le bateau le long
// de la route, chapitre par chapitre. Le « scroll » est mappé sur la suite
// des escales (et non sur le temps brut : les dix-sept mois néo-zélandais
// pèseraient sinon les trois quarts du voyage).

import * as THREE from 'three';

const DISTANCE_RECIT = 2.05;

// Textes d'introduction — le récit du site, nourri des données réelles.
const CHAPITRES = {
  'Les Caraïbes': {
    numero: 'I',
    periode: 'mai – juin 2009',
    texte: 'Tout commence au Marin, à la Martinique, le 28 mai 2009. '
      + 'Éric, Cécile et les enfants larguent les amarres d’un catamaran '
      + 'qui s’appelle déjà Let It Be. Cap à l’ouest : Sainte-Lucie, les '
      + 'eaux turquoise de Los Roques, Aruba — le log commence à compter.',
  },
  'Vers le Pacifique': {
    numero: 'II',
    periode: 'juin – juillet 2009',
    texte: 'Les San Blas, puis l’écluse de Gatún : Let It Be se hisse '
      + 'au-dessus de l’isthme et bascule dans une autre moitié du monde. '
      + 'Aux Galápagos, les iguanes ne se poussent pas pour laisser passer '
      + 'les visiteurs — c’est la porte du grand océan.',
  },
  'Le Grand Pacifique': {
    numero: 'III',
    periode: 'juillet 2009 – novembre 2010',
    texte: 'Dix-neuf jours de mer d’une traite, et les Gambier apparaissent. '
      + 'Puis tout l’éventail polynésien : les Marquises, les atolls des '
      + 'Tuamotu, Tahiti, Bora Bora ; les Cook, Beveridge Reef, Niue, les '
      + 'baleines de Tonga, le dédale des Fidji. Seize mois au cœur du '
      + 'Pacifique, l’école dans le carré et le récif pour cour de récré.',
  },
  'La Nouvelle-Zélande': {
    numero: 'IV',
    periode: 'décembre 2010 – mai 2012',
    texte: 'Mille milles de mer grise et voilà Opua, puis Whangarei, où '
      + 'Let It Be se repose dix-sept mois. La famille troque la voile '
      + 'contre les routes : la Nouvelle-Zélande de fond en comble, et '
      + 'jusqu’à l’Australie et la Tasmanie. Le bateau, lui, attend son heure.',
  },
  'Le retour en Polynésie': {
    numero: 'V',
    periode: 'mai 2012 – mars 2013',
    texte: 'Le chemin du retour passe par les quarantièmes rugissants : '
      + 'vingt-quatre jours de près serré, rafales à plus de 90 km/h, '
      + 'creux de six mètres — la plus rude traversée du voyage. En '
      + 'récompense : les Gambier retrouvés, Tahanea, Makemo, et un long '
      + 'hiver austral aux Marquises.',
  },
  'La remontée vers le nord': {
    numero: 'VI',
    periode: 'mars – juin 2013',
    texte: 'De Nuku Hiva, cap plein nord : l’équateur repasse sous la '
      + 'quille, et Hilo surgit après dix-sept jours. Hawaï se déguste '
      + 'd’île en île — Big Island, Maui, Molokai, Oahu — avant le grand '
      + 'saut vers le continent américain.',
  },
  'Le grand nord': {
    numero: 'VII',
    periode: 'juin – août 2013',
    texte: 'Dix-neuf jours entre Honolulu et Prince Rupert, aux portes de '
      + 'l’Alaska. Puis l’Inside Passage, déroulé mouillage après '
      + 'mouillage : fjords, ours et saumons, brumes du matin. Les alizés '
      + 'sont loin ; on navigue en polaire.',
  },
  'La côte américaine': {
    numero: 'VIII',
    periode: 'août 2013 – janvier 2014',
    texte: 'Victoria, Neah Bay, puis la longue glissade vers le Golden '
      + 'Gate. Pendant que le bateau souffle à San Francisco, un '
      + 'camping-car avale 4 972 miles de parcs nationaux. Les îles '
      + 'Channel ferment la marche : le 13 janvier 2014, à San Diego, '
      + 'le log s’arrête à 24 490 milles.',
  },
};

const EPILOGUE = {
  numero: '∗',
  titre: 'La terre ferme',
  periode: 'et après…',
  texte: 'Let It Be change de mains à San Diego ; la famille, elle, '
    + 'continue : le Mexique, puis le Costa Rica, une finca face aux '
    + 'volcans et des chambres d’hôtes. Le voyage est devenu deux livres '
    + 'signés Éric Laruel et Cécile Van Winnendael — et ce sillage-ci, '
    + 'pour mémoire.',
};

export function creerRecit({ timeline, regleSuivi, routeData, controls }) {
  const bouton = document.getElementById('recit-bouton');
  const carte = document.getElementById('recit-carte');
  const indicateur = document.getElementById('recit-indicateur');
  const aide = document.getElementById('recit-aide');

  // points de contrôle : les arrivées de chaque escale, à part égale de
  // scroll, plus le départ final (la fin du chapitre bateau à San Diego)
  const arrivees = routeData
    .filter(e => e.date_arrivee)
    .map(e => ({
      t: new Date(e.date_arrivee + 'T12:00:00Z').getTime(),
      chapitre: e.chapitre,
    }));
  const derniere = routeData[routeData.length - 1];
  if (derniere.date_depart) {
    arrivees.push({
      t: new Date(derniere.date_depart + 'T12:00:00Z').getTime(),
      chapitre: derniere.chapitre,
    });
  }

  let actif = false;
  let cible = 0;       // fraction de scroll visée [0..1+épilogue]
  let courant = 0;     // fraction lissée
  let chapitreAffiche = null;

  const FIN = 1.06;    // un peu d'élan après San Diego pour l'épilogue

  function fractionVersTemps(f) {
    const x = THREE.MathUtils.clamp(f, 0, 1) * (arrivees.length - 1);
    const i = Math.min(Math.floor(x), arrivees.length - 2);
    return THREE.MathUtils.lerp(arrivees[i].t, arrivees[i + 1].t, x - i);
  }

  function chapitreA(f) {
    if (f >= 1.0) return ['__epilogue__', EPILOGUE];
    const i = Math.round(THREE.MathUtils.clamp(f, 0, 1) * (arrivees.length - 1));
    const nom = arrivees[i].chapitre;
    return [nom, CHAPITRES[nom]];
  }

  function afficheChapitre(nom, c, titre = nom) {
    if (!c || nom === chapitreAffiche) return;
    chapitreAffiche = nom;
    carte.replaceChildren();
    const num = document.createElement('p');
    num.className = 'recit-numero';
    num.textContent = `Chapitre ${c.numero}`;
    const h = document.createElement('h2');
    h.textContent = c.titre ?? titre;
    const per = document.createElement('p');
    per.className = 'recit-periode';
    per.textContent = c.periode;
    const tx = document.createElement('p');
    tx.className = 'recit-texte';
    tx.textContent = c.texte;
    carte.append(num, h, per, tx);
    carte.classList.remove('visible');
    requestAnimationFrame(() => requestAnimationFrame(
      () => carte.classList.add('visible')));
  }

  function entre() {
    actif = true;
    document.body.classList.add('recit-actif');
    bouton.textContent = '✕ Quitter le récit';
    // on reprend là où en est la timeline
    const t = timeline.t;
    let i = arrivees.findIndex(a => a.t > t);
    if (i < 0) i = arrivees.length - 1;
    cible = courant = Math.max(0, (i - 1) / (arrivees.length - 1));
    chapitreAffiche = null;
    regleSuivi(true);
    controls.enabled = false; // la molette appartient au récit
    aide.hidden = false;
    setTimeout(() => { aide.hidden = true; }, 5200);
  }

  function sort() {
    actif = false;
    controls.enabled = true;
    document.body.classList.remove('recit-actif');
    bouton.textContent = '☰ Embarquer dans le récit';
    carte.classList.remove('visible');
    chapitreAffiche = null;
    aide.hidden = true;
  }

  bouton.addEventListener('click', () => (actif ? sort() : entre()));

  addEventListener('wheel', (e) => {
    if (!actif) return;
    e.preventDefault();
    cible = THREE.MathUtils.clamp(cible + e.deltaY * 0.00012, 0, FIN);
  }, { passive: false });

  let toucheY = null;
  addEventListener('touchstart', (e) => { toucheY = e.touches[0].clientY; });
  addEventListener('touchmove', (e) => {
    if (!actif || toucheY === null) return;
    cible = THREE.MathUtils.clamp(
      cible + (toucheY - e.touches[0].clientY) * 0.0008, 0, FIN);
    toucheY = e.touches[0].clientY;
  });

  function metAJour(dt) {
    if (!actif) return;
    courant += (cible - courant) * Math.min(1, dt * 3);
    timeline.vaA(fractionVersTemps(courant), true);
    const [nom, c] = chapitreA(courant);
    afficheChapitre(nom, c);
    indicateur.style.setProperty('--avancement', `${Math.min(1, courant) * 100}%`);
  }

  return {
    metAJour,
    sort,
    get actif() { return actif; },
    get distanceCamera() { return DISTANCE_RECIT; },
  };
}
