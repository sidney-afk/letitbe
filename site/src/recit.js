// Le mode Récit (étape 4 du plan) : un habillage narratif au-dessus de la
// timeline. Les cartes de chapitre s'affichent au fil du voyage, la caméra
// se rapproche et suit le bateau — et c'est le curseur (ou la lecture ⏵)
// qui fait avancer l'histoire : la molette reste dédiée au zoom, partout
// (demande de Sidney).

const DISTANCE_RECIT = 2.05;

// Textes d'introduction. Chaque fait vient de l'archive (articles du blog
// `content/articles.json`, tables de log, pages du site laruel.be) ; les
// citations sont mot pour mot, avec la date du billet. Vérifié le 10/10/2026.
export const CHAPITRES = {
  'Les Caraïbes': {
    numero: 'I',
    periode: 'mai – juin 2009',
    texte: 'Le 28 mai 2009, au Marin, à la Martinique, Let It Be lève l’ancre : '
      + 'un Bahia 46 de 2004, ancien bateau de location devenu celui de la '
      + 'famille le 1er avril. À bord, Éric, Cécile, Kenya, Sidney et Syr Daria. '
      + 'Cap au sud vers Sainte-Lucie, puis plein ouest : Los Roques, Aruba, '
      + 'les San Blas. Le log commence à compter.',
    citation: 'C’est à la fine pointe de l’aube, quand les rayons du soleil '
      + 'naissant rasent les flots assoupis par la nuit étoilée que nous avons '
      + 'levé l’ancre.',
    source: '28 mai 2009',
  },
  'Vers le Pacifique': {
    numero: 'II',
    periode: 'juin – juillet 2009',
    texte: 'Fin juin, dans le sillage d’un cargo slovène, Let It Be gravit les '
      + 'trois écluses de Gatún : de l’autre côté de l’isthme commence une autre '
      + 'moitié du monde. Les Perlas, puis les Galápagos. Le 23 juillet, cap sur '
      + 'le grand large.',
    citation: 'Nous avons pris un ticket avant de nous insérer dans la file, '
      + 'juste derrière un lion des mers (mais devant le booby à pattes bleues '
      + 'qui tentait de resquiller).',
    source: 'Galápagos, 17 juillet 2009',
  },
  'Le Grand Pacifique': {
    numero: 'III',
    periode: 'juillet 2009 – novembre 2010',
    texte: 'Vingt jours de mer d’une traite, et les Gambier apparaissent. Puis '
      + 'tout l’éventail polynésien : les Marquises, les atolls des Tuamotu, '
      + 'Tahiti, Bora Bora ; les Cook, Beveridge Reef, Niue, les baleines de '
      + 'Tonga, les Fidji. Seize mois au cœur du Pacifique, et l’école à bord.',
    citation: 'A l’heure où j’écris ces lignes, le bateau dort. Seul dans le '
      + 'carré silencieux, j’entends à peine le bruit du vent dans le génois…',
    source: 'Traversée du Pacifique, 5 août 2009',
  },
  'La Nouvelle-Zélande': {
    numero: 'IV',
    periode: 'décembre 2010 – mai 2012',
    texte: 'Un peu plus de mille milles, des creux de six mètres, et voilà '
      + 'Opua, puis Whangarei, où Let It Be se repose dix-sept mois. La famille '
      + 'troque la voile contre la route : la Nouvelle-Zélande en campervan, puis '
      + 'deux mois et 11 000 km en Australie, jusqu’en Tasmanie. Le bateau, lui, '
      + 'attend son heure.',
  },
  'Le retour en Polynésie': {
    numero: 'V',
    periode: 'mai 2012 – février 2013',
    texte: 'Le chemin du retour passe aux portes des quarantièmes : 3 250 milles '
      + 'en vingt-trois jours et demi, des surfs à plus de 15 nœuds, puis le près, '
      + 'des rafales à 55 nœuds et des creux estimés à huit mètres. La plus rude '
      + 'traversée du voyage. Suivent l’hiver aux Gambier, Tahiti et les îles de '
      + 'la Société, les mantas de Tahanea, et la saison des cyclones à l’abri '
      + 'des Marquises.',
    citation: 'A vrai dire, nous avons tous, je pense, une petite larme à '
      + 'l’oeil… On est arrivé !!!',
    source: 'Les Gambier, 9 juin 2012',
  },
  'La remontée vers le nord': {
    numero: 'VI',
    periode: 'février – juin 2013',
    texte: 'Le 19 février 2013, cap plein nord depuis Nuku Hiva. L’équateur '
      + 'repasse sous la quille, 196 milles en 24 heures, leur record, et Hilo '
      + 'surgit après treize jours de mer : 2 100 milles au près, bâbord amures. '
      + 'Puis Hawaï d’île en île : Big Island, Maui, Molokai, Oahu.',
    citation: 'Après un séjour de près de 4 ans dans l’hémisphère sud, nous '
      + 'allons maintenant écumer le Pacifique Nord.',
    source: 'Équateur, 22 février 2013',
  },
  'Le grand nord': {
    numero: 'VII',
    periode: 'juin – août 2013',
    texte: 'Dix-neuf jours d’une traversée « fort calme et bien motorisée » '
      + 'entre Honolulu et Prince Rupert, aux portes de l’Alaska. Puis la côte '
      + 'de la Colombie-Britannique, mouillage après mouillage, entre fjords, '
      + 'aigles à tête blanche et otaries, jusqu’à Vancouver et Victoria.',
    citation: 'Au loin, les saumons font des cabrioles et les otaries soupirent.',
    source: '13 juillet 2013',
  },
  'La côte américaine': {
    numero: 'VIII',
    periode: 'août 2013 – janvier 2014',
    texte: 'Port Angeles, Neah Bay, puis la descente vers San Francisco, sous le '
      + 'Golden Gate à la voile. Pendant que le bateau attend, un camping-car '
      + 'avale près de 5 000 miles de parcs nationaux, en plein « shutdown ». '
      + 'Les îles Channel ferment la marche : le 15 novembre 2013, à San Diego, '
      + 'le log s’arrête à 24 490 milles.',
  },
};

const EPILOGUE = {
  numero: '∗',
  titre: 'La terre ferme',
  periode: 'et après…',
  texte: 'Le 13 janvier 2014, la famille quitte Let It Be pour de bon ; le '
    + 'bateau voguera désormais sous la houlette d’un nouveau capitaine. Elle '
    + 's’envole pour le Costa Rica : une finca de 40 hectares près de Bijagua, '
    + 'entre les volcans Tenorio et Miravalles, et de futures chambres d’hôtes. '
    + 'Le voyage est devenu deux livres, Les p’tites bites et 95° de latitude '
    + 'Nord, et ce sillage-ci, pour mémoire.',
  citation: 'Let It Be, c’est fini. Et dire que c’était mon premier bateau…',
  source: 'Costa Rica, 17 janvier 2014',
};

const JOUR_MS = 86400e3;

export function creerRecit({ timeline, regleSuivi, voyage }) {
  const bouton = document.getElementById('recit-bouton');
  const carte = document.getElementById('recit-carte');
  const indicateur = document.getElementById('recit-indicateur');
  const aide = document.getElementById('recit-aide');

  let actif = false;
  let chapitreAffiche = null;

  function nommeBouton() {
    const action = actif ? 'Quitter le récit' : 'Embarquer dans le récit';
    bouton.querySelector('span').textContent = action;
    bouton.querySelector('.bouton-court').textContent = actif ? 'Quitter' : 'Récit';
    bouton.setAttribute('aria-label', action);
    bouton.setAttribute('aria-expanded', String(actif));
    bouton.title = action;
  }

  function chapitreA(t) {
    if (t >= voyage.fin - 2 * JOUR_MS) return ['__epilogue__', EPILOGUE];
    const e = voyage.segmentA(t)?.escale;
    const nom = e?.chapitre;
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
    if (c.citation) {
      // Les mots mêmes du carnet de bord, datés.
      const citation = document.createElement('figure');
      citation.className = 'recit-citation';
      const bloc = document.createElement('blockquote');
      bloc.textContent = `«\u00a0${c.citation}\u00a0»`;
      const signe = document.createElement('figcaption');
      signe.textContent = `Carnet de bord, ${c.source}`;
      citation.append(bloc, signe);
      carte.append(citation);
    }
    if (nom !== '__epilogue__') {
      // the chapter's own posts, in the table of contents
      const lire = document.createElement('button');
      lire.type = 'button';
      lire.className = 'lien-sommaire';
      lire.dataset.chapitre = nom;
      lire.setAttribute('aria-haspopup', 'dialog');
      lire.textContent = 'Lire les billets de ce chapitre';
      carte.append(lire);
    }
    if (nom === '__epilogue__') {
      const lien = document.createElement('button');
      lien.type = 'button';
      lien.className = 'lien-a-propos';
      lien.setAttribute('aria-haspopup', 'dialog');
      lien.textContent = 'À propos du site, des livres et des crédits';
      carte.append(lien);
    }
    carte.classList.remove('visible');
    requestAnimationFrame(() => requestAnimationFrame(
      () => carte.classList.add('visible')));
  }

  function applique(t) {
    if (!actif) return;
    const [nom, c] = chapitreA(t);
    afficheChapitre(nom, c);
    const f = (t - voyage.debut) / (voyage.fin - voyage.debut);
    indicateur.style.setProperty('--avancement', `${f * 100}%`);
  }

  function entre({ aide: montrerAide = true } = {}) {
    actif = true;
    document.getElementById('interlude')?.classList.remove('visible');
    document.body.classList.add('recit-actif');
    nommeBouton();
    chapitreAffiche = null;
    regleSuivi(true);
    applique(timeline.t);
    if (!montrerAide) return;
    aide.hidden = false;
    setTimeout(() => { aide.hidden = true; }, 5200);
  }

  function sort() {
    actif = false;
    document.body.classList.remove('recit-actif');
    nommeBouton();
    carte.classList.remove('visible');
    chapitreAffiche = null;
    aide.hidden = true;
  }

  // During the replayed crossing (outside story mode), each new chapter is
  // announced by a brief title over the sky, so the three minutes read as a
  // story with its chapters.
  const interlude = document.getElementById('interlude');
  let chapitreLecture = null;
  let minuterieInterlude = null;
  function annonceChapitre(c, titre) {
    if (!interlude) return;
    interlude.replaceChildren();
    const num = document.createElement('p');
    num.className = 'interlude-numero';
    num.textContent = `Chapitre ${c.numero}`;
    const h = document.createElement('p');
    h.className = 'interlude-titre';
    h.textContent = c.titre ?? titre;
    const per = document.createElement('p');
    per.className = 'interlude-periode';
    per.textContent = c.periode;
    interlude.append(num, h, per);
    interlude.hidden = false;
    interlude.classList.remove('visible');
    requestAnimationFrame(() => requestAnimationFrame(() => interlude.classList.add('visible')));
    clearTimeout(minuterieInterlude);
    minuterieInterlude = setTimeout(() => interlude.classList.remove('visible'), 4200);
  }
  timeline.surChangement((t) => {
    if (!timeline.enLecture || actif) return;
    const [nom, c] = chapitreA(t);
    if (nom === chapitreLecture) return;
    chapitreLecture = nom;
    if (c && nom !== '__epilogue__') annonceChapitre(c, nom);
  });

  bouton.addEventListener('click', () => (actif ? sort() : entre()));
  addEventListener('keydown', (e) => {
    if (!actif || e.key !== 'Escape') return;
    e.preventDefault();
    sort();
    bouton.focus({ preventScroll: true });
  });
  nommeBouton();
  timeline.surChangement(applique);

  return {
    entre,
    sort,
    get actif() { return actif; },
    get distanceCamera() { return DISTANCE_RECIT; },
  };
}
